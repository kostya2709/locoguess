"""REST endpoints for game management."""

import random
import string

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.admin import verify_admin_token
from app.database import get_db
from app.models import Game, GamePack, GameStatus
from app.models.game import Round
from app.models.team import Team
from app.schemas.game import (
    ClaimHost,
    ClaimHostResponse,
    GameCreate,
    GameCreateResponse,
    GameResponse,
    GameStatusResponse,
    GameUpdate,
    PlayerStatusInfo,
    TeamStatusInfo,
)
from app.schemas.guess import ScoreboardEntry
from app.schemas.team import TeamResponse
from app.services import game_service

router = APIRouter(prefix="/api/v1", tags=["games"])

# Auto-generated team names and colors
TEAM_PRESETS = [
    ("Красные", "#ef4444"),
    ("Синие", "#3b82f6"),
    ("Оранжевые", "#f97316"),
    ("Фиолетовые", "#a855f7"),
    ("Розовые", "#ec4899"),
    ("Голубые", "#06b6d4"),
    ("Бирюзовые", "#14b8a6"),
    ("Серые", "#6b7280"),
]


SINGLE_ROOM_CODE = "GAME01"


def _generate_join_code(db: Session) -> str:
    """Return the single room code. Deletes any existing game first."""
    existing = db.query(Game).filter_by(join_code=SINGLE_ROOM_CODE).first()
    if existing:
        db.delete(existing)
        db.commit()
    return SINGLE_ROOM_CODE


def _get_game(join_code: str, db: Session) -> Game:
    """Look up a game by join code or raise 404."""
    game = db.query(Game).filter_by(join_code=join_code.upper()).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.post("/games", response_model=GameCreateResponse, status_code=201, dependencies=[Depends(verify_admin_token)])
def create_game(body: GameCreate, db: Session = Depends(get_db)):
    """Create a new game. If pack_id is provided, rounds are auto-created from the pack."""
    db_pack = None
    if body.pack_id:
        db_pack = db.query(GamePack).filter_by(id=body.pack_id).first()
        if not db_pack:
            raise HTTPException(status_code=400, detail=f"Набор не найден: {body.pack_id}")
        total_rounds = len(db_pack.rounds)
    else:
        total_rounds = body.total_rounds

    game = Game(
        join_code=_generate_join_code(db),
        name=body.name,
        total_rounds=total_rounds,
        round_duration=body.round_duration,
    )
    db.add(game)
    db.flush()

    # Create teams
    if body.team_names and len(body.team_names) != body.team_count:
        raise HTTPException(
            status_code=400,
            detail=f"team_names length ({len(body.team_names)}) must match team_count ({body.team_count})",
        )
    for i in range(body.team_count):
        default_name, color = TEAM_PRESETS[i % len(TEAM_PRESETS)]
        name = body.team_names[i] if body.team_names else default_name
        db.add(Team(game_id=game.id, name=name, color=color))

    # Create rounds from pack if provided
    if db_pack:
        for r in db_pack.rounds:
            db.add(Round(
                game_id=game.id,
                round_number=r.round_number,
                photo_path=r.photo_path,
                correct_lat=r.correct_lat,
                correct_lng=r.correct_lng,
                location_name=r.location_name,
                music_path=r.music_path,
            ))

    db.commit()
    db.refresh(game)
    return game


@router.get("/games/{join_code}", response_model=GameResponse)
def get_game(join_code: str, db: Session = Depends(get_db)):
    """Get game info by join code."""
    return _get_game(join_code, db)


@router.patch("/games/{join_code}", response_model=GameResponse, dependencies=[Depends(verify_admin_token)])
def update_game(join_code: str, body: GameUpdate, db: Session = Depends(get_db)):
    """Update game settings while in lobby (before starting)."""
    game = _get_game(join_code, db)
    if game.status != GameStatus.LOBBY:
        raise HTTPException(status_code=400, detail="Can only update in lobby")

    if body.round_duration is not None:
        game.round_duration = body.round_duration

    if body.street_view_enabled is not None:
        game.street_view_enabled = body.street_view_enabled
    if body.music_host is not None:
        game.music_host = body.music_host
    if body.music_guests is not None:
        game.music_guests = body.music_guests

    if body.team_count is not None:
        current_teams = list(game.teams)
        current_count = len(current_teams)

        if body.team_names and len(body.team_names) != body.team_count:
            raise HTTPException(
                status_code=400,
                detail=f"team_names length ({len(body.team_names)}) must match team_count ({body.team_count})",
            )

        if body.team_count > current_count:
            # Add new teams
            for i in range(current_count, body.team_count):
                default_name, color = TEAM_PRESETS[i % len(TEAM_PRESETS)]
                name = body.team_names[i] if body.team_names else default_name
                db.add(Team(game_id=game.id, name=name, color=color))
        elif body.team_count < current_count:
            # Remove teams from the end (only if they have no players)
            for team in reversed(current_teams[body.team_count:]):
                if len(team.players) > 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Нельзя удалить команду «{team.name}» — в ней есть игроки",
                    )
                db.delete(team)

        # Update names for remaining teams
        if body.team_names:
            teams_after = db.query(Team).filter_by(game_id=game.id).all()
            for i, team in enumerate(teams_after):
                if i < len(body.team_names):
                    team.name = body.team_names[i]

    elif body.team_names:
        # Only renaming, no count change
        for i, team in enumerate(game.teams):
            if i < len(body.team_names):
                team.name = body.team_names[i]

    db.commit()
    db.refresh(game)
    return game


@router.get("/games/{join_code}/status", response_model=GameStatusResponse)
def get_game_status(join_code: str, db: Session = Depends(get_db)):
    """Get full game status including teams, player counts, and readiness."""
    game = _get_game(join_code, db)
    rounds_configured = db.query(Round).filter_by(game_id=game.id).count()

    team_infos = []
    all_teams_have_players = True
    for team in game.teams:
        player_infos = [
            PlayerStatusInfo(id=p.id, nickname=p.nickname, is_captain=p.is_captain)
            for p in team.players
        ]
        if len(player_infos) == 0:
            all_teams_have_players = False
        team_infos.append(TeamStatusInfo(
            id=team.id,
            name=team.name,
            color=team.color,
            player_count=len(player_infos),
            players=player_infos,
        ))

    ready = (
        game.status == GameStatus.LOBBY
        and rounds_configured >= game.total_rounds
        and len(team_infos) >= 1
        and all_teams_have_players
    )

    return GameStatusResponse(
        id=game.id,
        join_code=game.join_code,
        name=game.name,
        status=game.status,
        round_duration=game.round_duration,
        street_view_enabled=game.street_view_enabled,
        music_host=game.music_host,
        music_guests=game.music_guests,
        total_rounds=game.total_rounds,
        rounds_configured=rounds_configured,
        teams=team_infos,
        ready_to_start=ready,
    )


@router.post("/games/{join_code}/claim-host", response_model=ClaimHostResponse)
def claim_host(join_code: str, body: ClaimHost, db: Session = Depends(get_db)):
    """Verify a host_secret and return host status."""
    game = _get_game(join_code, db)
    if body.host_secret != game.host_secret:
        raise HTTPException(status_code=403, detail="Invalid host secret")
    rounds_configured = db.query(Round).filter_by(game_id=game.id).count()
    return ClaimHostResponse(is_host=True, rounds_configured=rounds_configured)


@router.post("/games/{join_code}/start", response_model=GameResponse, dependencies=[Depends(verify_admin_token)])
async def start_game(join_code: str, db: Session = Depends(get_db)):
    """Start a game, transitioning from LOBBY to PLAYING."""
    game = _get_game(join_code, db)
    try:
        await game_service.start_game(game.id, game.join_code, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.refresh(game)
    return game


@router.post("/games/{join_code}/next-round", response_model=GameResponse, dependencies=[Depends(verify_admin_token)])
async def next_round(join_code: str, db: Session = Depends(get_db)):
    """Advance to the next round (host action). Starts the next round or finishes the game."""
    game = _get_game(join_code, db)
    try:
        await game_service.advance_to_next_round(game.id, game.join_code, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.refresh(game)
    return game


@router.post("/games/{join_code}/end-game", response_model=GameResponse, dependencies=[Depends(verify_admin_token)])
async def end_game(join_code: str, db: Session = Depends(get_db)):
    """End the game early (host action). Redirects all clients to home."""
    game = _get_game(join_code, db)
    try:
        await game_service.end_game_early(game.id, game.join_code, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.refresh(game)
    return game


@router.post("/games/{join_code}/set-photo", dependencies=[Depends(verify_admin_token)])
async def set_photo_index(join_code: str, body: dict, db: Session = Depends(get_db)):
    """Host changes which photo is displayed (for rounds with multiple photos)."""
    from app.utils import get_photo_urls
    game = _get_game(join_code, db)
    index = body.get("index", 0)

    # Include the photo URL directly so clients don't need photo_urls array
    photo_url = None
    if game.current_round is not None:
        round_ = db.query(Round).filter_by(game_id=game.id, round_number=game.current_round).first()
        if round_:
            urls = get_photo_urls(round_.photo_path)
            if 0 <= index < len(urls):
                photo_url = urls[index]

    await game_service.manager.broadcast(game.join_code, {
        "type": "photo_change",
        "data": {"index": index, "photo_url": photo_url},
    })
    return {"ok": True}


@router.post("/games/{join_code}/timer/pause", dependencies=[Depends(verify_admin_token)])
def pause_timer(join_code: str, db: Session = Depends(get_db)):
    """Pause the round timer (host action)."""
    game = _get_game(join_code, db)
    if not game_service.pause_timer(game.id):
        raise HTTPException(status_code=400, detail="Timer is not running")
    return {"ok": True}


@router.post("/games/{join_code}/timer/resume", dependencies=[Depends(verify_admin_token)])
def resume_timer(join_code: str, db: Session = Depends(get_db)):
    """Resume the round timer (host action)."""
    game = _get_game(join_code, db)
    if not game_service.resume_timer(game.id):
        raise HTTPException(status_code=400, detail="Timer is not paused")
    return {"ok": True}


@router.post("/games/{join_code}/timer/reset", dependencies=[Depends(verify_admin_token)])
def reset_timer(join_code: str, db: Session = Depends(get_db)):
    """Reset the round timer to original duration (host action)."""
    game = _get_game(join_code, db)
    if not game_service.reset_timer(game.id):
        raise HTTPException(status_code=400, detail="No active timer")
    return {"ok": True}


@router.post("/games/{join_code}/replay-round", response_model=GameResponse, dependencies=[Depends(verify_admin_token)])
async def replay_round(join_code: str, db: Session = Depends(get_db)):
    """Replay the current round (host action). Deletes guesses and restarts."""
    game = _get_game(join_code, db)
    try:
        await game_service.replay_round(game.id, game.join_code, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.refresh(game)
    return game


@router.post("/games/{join_code}/replay-game", response_model=GameResponse, dependencies=[Depends(verify_admin_token)])
async def replay_game(join_code: str, db: Session = Depends(get_db)):
    """Replay the entire game from round 1 (host action). Deletes all guesses."""
    game = _get_game(join_code, db)
    try:
        await game_service.replay_game(game.id, game.join_code, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.refresh(game)
    return game


@router.get("/games/{join_code}/teams", response_model=list[TeamResponse])
def get_teams(join_code: str, db: Session = Depends(get_db)):
    """Get all teams and their players for a game."""
    game = _get_game(join_code, db)
    return game.teams


@router.get("/games/{join_code}/scoreboard", response_model=list[ScoreboardEntry])
def get_scoreboard(join_code: str, db: Session = Depends(get_db)):
    """Get the cumulative scoreboard for a game."""
    game = _get_game(join_code, db)
    entries = []
    for team in game.teams:
        round_scores: list[int | None] = []
        total = 0
        for round_ in game.rounds:
            guess = next((g for g in round_.guesses if g.team_id == team.id), None)
            if guess:
                round_scores.append(guess.score)
                total += guess.score
            else:
                round_scores.append(None)
        entries.append(
            ScoreboardEntry(
                rank=0,
                team_id=team.id,
                team_name=team.name,
                team_color=team.color,
                total_score=total,
                round_scores=round_scores,
            )
        )
    entries.sort(key=lambda e: e.total_score, reverse=True)
    for i, entry in enumerate(entries):
        entry.rank = i + 1
    return entries
