"""Game state machine orchestrator."""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Game, GameStatus, Guess, Round, RoundStatus
from app.schemas.guess import GuessResponse, ScoreboardEntry
from app.services.drafts import clear_round, get_round_drafts
from app.services.scoring import calculate_score, haversine_km
from app.utils import get_photo_urls
from app.ws.manager import manager

logger = logging.getLogger(__name__)


class GameTimer:
    """Async countdown timer with pause/resume/reset support."""

    def __init__(self, game_id: str, join_code: str, round_number: int, duration: int, db: Session):
        self.game_id = game_id
        self.join_code = join_code
        self.round_number = round_number
        self.duration = duration
        self.remaining = duration
        self.db = db
        self.paused = False
        self._task: asyncio.Task | None = None

    def start(self):
        self._task = asyncio.create_task(self._run())

    async def _run(self):
        while self.remaining > 0:
            await manager.broadcast(self.join_code, {
                "type": "timer_tick",
                "data": {"seconds_remaining": self.remaining, "paused": self.paused},
            })
            await asyncio.sleep(1)
            if not self.paused:
                self.remaining -= 1

        await end_round(self.game_id, self.join_code, self.round_number, self.db)

    def pause(self):
        self.paused = True

    def resume(self):
        self.paused = False

    def reset(self, duration: int | None = None):
        self.remaining = duration or self.duration
        self.paused = False

    def cancel(self):
        if self._task:
            self._task.cancel()


# Active timers keyed by game ID
_timers: dict[str, GameTimer] = {}


async def start_game(game_id: str, join_code: str, db: Session):
    """Transition a game from LOBBY to PLAYING and start the first round."""
    game = db.query(Game).filter_by(id=game_id).one()
    if game.status != GameStatus.LOBBY:
        raise ValueError("Game is not in lobby")

    rounds = db.query(Round).filter_by(game_id=game.id).count()
    if rounds < game.total_rounds:
        raise ValueError(f"Only {rounds}/{game.total_rounds} rounds configured")

    teams_with_players = [t for t in game.teams if len(t.players) > 0]
    if len(teams_with_players) < 1:
        raise ValueError("Need at least 1 team with players")

    game.status = GameStatus.PLAYING
    game.current_round = 0
    db.commit()

    await _start_round(game, 0, db)


async def _start_round(game: Game, round_number: int, db: Session):
    """Begin a round: set status, broadcast, and start timer."""
    round_ = db.query(Round).filter_by(game_id=game.id, round_number=round_number).one()
    round_.status = RoundStatus.GUESSING
    round_.started_at = datetime.now(timezone.utc)
    db.commit()

    photo_urls = get_photo_urls(round_.photo_path)
    music_url = f"/photos/{round_.music_path}" if round_.music_path else None
    await manager.broadcast(game.join_code, {
        "type": "round_start",
        "data": {
            "round_number": round_number,
            "photo_url": photo_urls[0],
            "photo_urls": photo_urls,
            "music_url": music_url,
            "duration": game.round_duration,
            "total_rounds": game.total_rounds,
            "music_host": game.music_host,
            "music_guests": game.music_guests,
        },
    })

    timer = GameTimer(game.id, game.join_code, round_number, game.round_duration, db)
    _timers[game.id] = timer
    timer.start()


async def notify_guess(join_code: str, team_id: str, team_name: str):
    """Broadcast that a team has locked in their guess (no coords revealed)."""
    await manager.broadcast(join_code, {
        "type": "team_guessed",
        "data": {"team_id": team_id, "team_name": team_name},
    })


async def check_all_guessed(game_id: str, join_code: str, round_number: int, db: Session):
    """If all teams have guessed, end the round early."""
    game = db.query(Game).filter_by(id=game_id).one()
    round_ = db.query(Round).filter_by(game_id=game.id, round_number=round_number).one()
    teams_count = len(game.teams)
    guesses_count = db.query(Guess).filter_by(round_id=round_.id).count()

    if guesses_count >= teams_count:
        timer = _timers.pop(game_id, None)
        if timer:
            timer.cancel()
        await end_round(game_id, join_code, round_number, db)


def _autosubmit_from_drafts(game: Game, round_: Round, db: Session):
    """For teams without a submitted guess, use captain's last draft marker."""
    drafts = get_round_drafts(round_.id)
    if not drafts:
        return
    submitted_team_ids = {g.team_id for g in round_.guesses}
    for team in game.teams:
        if team.id in submitted_team_ids:
            continue
        captain = next((p for p in team.players if p.is_captain), None)
        if not captain:
            continue
        marker = drafts.get(captain.id)
        if not marker:
            continue
        distance = haversine_km(marker.lat, marker.lng, round_.correct_lat, round_.correct_lng)
        db.add(Guess(
            round_id=round_.id,
            team_id=team.id,
            lat=marker.lat,
            lng=marker.lng,
            distance_km=round(distance, 2),
            score=calculate_score(distance),
        ))
    db.commit()
    db.refresh(round_)


async def end_round(game_id: str, join_code: str, round_number: int, db: Session):
    """Reveal results for a round."""
    _timers.pop(game_id, None)

    game = db.query(Game).filter_by(id=game_id).one()
    round_ = db.query(Round).filter_by(game_id=game.id, round_number=round_number).one()

    if round_.status != RoundStatus.GUESSING:
        return

    _autosubmit_from_drafts(game, round_, db)

    round_.status = RoundStatus.REVEALING
    db.commit()

    guesses_data = []
    for guess in round_.guesses:
        team = guess.team
        guesses_data.append({
            "team_id": team.id,
            "team_name": team.name,
            "team_color": team.color,
            "lat": guess.lat,
            "lng": guess.lng,
            "distance_km": guess.distance_km,
            "score": guess.score,
        })

    await manager.broadcast(join_code, {
        "type": "round_reveal",
        "data": {
            "round_number": round_number,
            "correct": {
                "lat": round_.correct_lat,
                "lng": round_.correct_lng,
                "name": round_.location_name,
            },
            "guesses": guesses_data,
        },
    })

    round_.status = RoundStatus.COMPLETE
    db.commit()


async def advance_to_next_round(game_id: str, join_code: str, db: Session):
    """Host triggers advancing to the next round, or finishing if it was the last."""
    game = db.query(Game).filter_by(id=game_id).one()
    if game.status != GameStatus.PLAYING:
        raise ValueError("Game is not in progress")

    current = game.current_round
    if current is None:
        raise ValueError("No current round")

    round_ = db.query(Round).filter_by(game_id=game.id, round_number=current).one()
    if round_.status != RoundStatus.COMPLETE:
        raise ValueError("Current round is not complete yet")

    next_round = current + 1
    if next_round < game.total_rounds:
        game.current_round = next_round
        db.commit()
        await _start_round(game, next_round, db)
    else:
        await _finish_game(game, db)


async def _finish_game(game: Game, db: Session):
    """Mark the game as finished and broadcast the final scoreboard."""
    game.status = GameStatus.FINISHED
    db.commit()

    entries = []
    for team in game.teams:
        total = 0
        round_scores = []
        for round_ in game.rounds:
            guess = next((g for g in round_.guesses if g.team_id == team.id), None)
            round_scores.append(guess.score if guess else None)
            total += guess.score if guess else 0
        entries.append({
            "team_id": team.id,
            "team_name": team.name,
            "team_color": team.color,
            "total_score": total,
            "round_scores": round_scores,
        })

    entries.sort(key=lambda e: e["total_score"], reverse=True)
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1

    await manager.broadcast(game.join_code, {
        "type": "game_end",
        "data": {"scoreboard": entries},
    })


async def end_game_early(game_id: str, join_code: str, db: Session):
    """Host ends the game early."""
    game = db.query(Game).filter_by(id=game_id).one()
    timer = _timers.pop(game_id, None)
    if timer:
        timer.cancel()
    game.status = GameStatus.FINISHED
    db.commit()
    await manager.broadcast(join_code, {"type": "game_cancelled", "data": {}})


def pause_timer(game_id: str) -> bool:
    """Pause the current round's timer. Returns True if successful."""
    timer = _timers.get(game_id)
    if not timer or timer.paused:
        return False
    timer.pause()
    return True


def resume_timer(game_id: str) -> bool:
    """Resume the current round's timer. Returns True if successful."""
    timer = _timers.get(game_id)
    if not timer or not timer.paused:
        return False
    timer.resume()
    return True


def reset_timer(game_id: str) -> bool:
    """Reset the current round's timer to the original duration. Returns True if successful."""
    timer = _timers.get(game_id)
    if not timer:
        return False
    timer.reset()
    return True


async def replay_round(game_id: str, join_code: str, db: Session):
    """Reset the current round: delete guesses, clear drafts, restart it."""
    game = db.query(Game).filter_by(id=game_id).one()
    if game.status != GameStatus.PLAYING:
        raise ValueError("Game is not in progress")

    current = game.current_round
    if current is None:
        raise ValueError("No current round")

    round_ = db.query(Round).filter_by(game_id=game.id, round_number=current).one()

    timer = _timers.pop(game_id, None)
    if timer:
        timer.cancel()

    db.query(Guess).filter_by(round_id=round_.id).delete()
    round_.status = RoundStatus.PENDING
    round_.started_at = None
    db.commit()

    clear_round(round_.id)
    await _start_round(game, current, db)


async def replay_game(game_id: str, join_code: str, db: Session):
    """Reset the entire game: delete all guesses, reset all rounds, start from round 0."""
    game = db.query(Game).filter_by(id=game_id).one()
    if game.status not in (GameStatus.PLAYING, GameStatus.FINISHED):
        raise ValueError("Game is not in progress or finished")

    timer = _timers.pop(game_id, None)
    if timer:
        timer.cancel()

    for round_ in game.rounds:
        db.query(Guess).filter_by(round_id=round_.id).delete()
        round_.status = RoundStatus.PENDING
        round_.started_at = None
        clear_round(round_.id)

    game.status = GameStatus.PLAYING
    game.current_round = 0
    db.commit()

    await _start_round(game, 0, db)
