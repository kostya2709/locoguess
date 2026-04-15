"""Tests for game service state machine logic."""

import pytest
from unittest.mock import AsyncMock, patch

from app.models import Game, GameStatus, Round, RoundStatus, Team, Player
from app.services import game_service


class TestStartGame:
    @pytest.mark.asyncio
    async def test_start_game_requires_lobby(self, sample_game, db_session):
        sample_game.status = GameStatus.PLAYING
        db_session.commit()
        with pytest.raises(ValueError, match="not in lobby"):
            await game_service.start_game(sample_game.id, sample_game.join_code, db_session)

    @pytest.mark.asyncio
    async def test_start_game_requires_rounds(self, db_session):
        game = Game(join_code="NORND1", name="No Rounds", total_rounds=3, round_duration=30)
        db_session.add(game)
        db_session.flush()
        team1 = Team(game_id=game.id, name="A")
        team2 = Team(game_id=game.id, name="B")
        db_session.add_all([team1, team2])
        db_session.flush()
        db_session.add(Player(team_id=team1.id, nickname="p1", is_captain=True))
        db_session.add(Player(team_id=team2.id, nickname="p2", is_captain=True))
        db_session.commit()

        with pytest.raises(ValueError, match="rounds configured"):
            await game_service.start_game(game.id, game.join_code, db_session)

    @pytest.mark.asyncio
    async def test_start_game_requires_players(self, db_session):
        """A game with teams but no players should not start."""
        game = Game(join_code="NOPLR1", name="No Players", total_rounds=1, round_duration=30)
        db_session.add(game)
        db_session.flush()
        db_session.add(Team(game_id=game.id, name="Empty"))
        db_session.add(Round(
            game_id=game.id, round_number=0, photo_path="x.jpg",
            correct_lat=0, correct_lng=0,
        ))
        db_session.commit()

        with pytest.raises(ValueError, match="1 team"):
            await game_service.start_game(game.id, game.join_code, db_session)

    @pytest.mark.asyncio
    @patch.object(game_service, "manager")
    async def test_start_game_success(self, mock_manager, sample_game, db_session):
        mock_manager.broadcast = AsyncMock()
        await game_service.start_game(sample_game.id, sample_game.join_code, db_session)

        db_session.refresh(sample_game)
        assert sample_game.status == GameStatus.PLAYING
        assert sample_game.current_round == 0

        round0 = db_session.query(Round).filter_by(
            game_id=sample_game.id, round_number=0
        ).one()
        assert round0.status == RoundStatus.GUESSING
        assert mock_manager.broadcast.called


class TestEndRound:
    @pytest.mark.asyncio
    @patch.object(game_service, "manager")
    async def test_end_round_reveals(self, mock_manager, sample_game, db_session):
        mock_manager.broadcast = AsyncMock()
        # Manually set round to GUESSING
        round0 = sample_game.rounds[0]
        round0.status = RoundStatus.GUESSING
        sample_game.status = GameStatus.PLAYING
        sample_game.current_round = 0
        db_session.commit()

        await game_service.end_round(
            sample_game.id, sample_game.join_code, 0, db_session
        )

        db_session.refresh(round0)
        assert round0.status == RoundStatus.COMPLETE

        # Find the round_reveal broadcast
        calls = mock_manager.broadcast.call_args_list
        reveal_calls = [c for c in calls if c[0][1].get("type") == "round_reveal"]
        assert len(reveal_calls) == 1

    @pytest.mark.asyncio
    @patch.object(game_service, "manager")
    async def test_end_round_idempotent(self, mock_manager, sample_game, db_session):
        """Ending a round that is not GUESSING should be a no-op."""
        mock_manager.broadcast = AsyncMock()
        round0 = sample_game.rounds[0]
        round0.status = RoundStatus.COMPLETE
        db_session.commit()

        await game_service.end_round(
            sample_game.id, sample_game.join_code, 0, db_session
        )
        # Should not broadcast anything
        assert not mock_manager.broadcast.called
