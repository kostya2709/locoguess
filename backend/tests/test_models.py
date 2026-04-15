"""Tests for database models."""

from app.models import Game, GameStatus, Guess, Player, Round, RoundStatus, Team


class TestGameModel:
    def test_create_game(self, db_session):
        game = Game(join_code="XYZ789", name="My Game", total_rounds=5)
        db_session.add(game)
        db_session.commit()

        loaded = db_session.query(Game).filter_by(join_code="XYZ789").one()
        assert loaded.name == "My Game"
        assert loaded.status == GameStatus.LOBBY
        assert loaded.total_rounds == 5
        assert loaded.current_round is None
        assert loaded.round_duration == 60

    def test_join_code_unique(self, db_session):
        g1 = Game(join_code="DUP001", name="Game 1", total_rounds=1)
        g2 = Game(join_code="DUP001", name="Game 2", total_rounds=1)
        db_session.add(g1)
        db_session.commit()
        db_session.add(g2)
        try:
            db_session.commit()
            assert False, "Should have raised IntegrityError"
        except Exception:
            db_session.rollback()


class TestTeamModel:
    def test_create_team(self, sample_game, db_session):
        teams = db_session.query(Team).filter_by(game_id=sample_game.id).all()
        assert len(teams) == 2
        assert {t.name for t in teams} == {"Team Alpha", "Team Beta"}

    def test_team_game_relationship(self, sample_game):
        assert len(sample_game.teams) == 2
        assert sample_game.teams[0].game.id == sample_game.id


class TestPlayerModel:
    def test_players_on_team(self, sample_game, db_session):
        alpha = db_session.query(Team).filter_by(name="Team Alpha").one()
        assert len(alpha.players) == 2
        captains = [p for p in alpha.players if p.is_captain]
        assert len(captains) == 1
        assert captains[0].nickname == "Alice"

    def test_session_id_unique(self, sample_game, db_session):
        players = db_session.query(Player).all()
        session_ids = [p.session_id for p in players]
        assert len(session_ids) == len(set(session_ids))


class TestRoundModel:
    def test_rounds_created(self, sample_game, db_session):
        rounds = db_session.query(Round).filter_by(game_id=sample_game.id).all()
        assert len(rounds) == 3
        assert all(r.status == RoundStatus.PENDING for r in rounds)

    def test_round_ordering(self, sample_game):
        assert [r.round_number for r in sample_game.rounds] == [0, 1, 2]


class TestGuessModel:
    def test_create_guess(self, sample_game, db_session):
        round_ = sample_game.rounds[0]
        team = sample_game.teams[0]
        guess = Guess(
            round_id=round_.id,
            team_id=team.id,
            lat=49.0,
            lng=2.5,
            distance_km=18.3,
            score=4955,
        )
        db_session.add(guess)
        db_session.commit()

        loaded = db_session.query(Guess).filter_by(round_id=round_.id).one()
        assert loaded.score == 4955
        assert loaded.team.name == "Team Alpha"

    def test_one_guess_per_team_per_round(self, sample_game, db_session):
        round_ = sample_game.rounds[0]
        team = sample_game.teams[0]
        g1 = Guess(round_id=round_.id, team_id=team.id, lat=1.0, lng=1.0, distance_km=100, score=100)
        g2 = Guess(round_id=round_.id, team_id=team.id, lat=2.0, lng=2.0, distance_km=200, score=200)
        db_session.add(g1)
        db_session.commit()
        db_session.add(g2)
        try:
            db_session.commit()
            assert False, "Should have raised IntegrityError"
        except Exception:
            db_session.rollback()
