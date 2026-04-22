"""REST endpoints for round management and guess submission."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.admin import verify_admin_token
from app.config import settings
from app.database import get_db
from app.models import Game, GameStatus, Guess, Player, Round, RoundStatus
from app.schemas.game import RoundCreate, RoundInfo
from app.schemas.guess import GuessCreate, GuessResponse
from app.services import game_service
from app.services.drafts import set_draft, get_team_drafts
from app.services.scoring import calculate_score, haversine_km
from app.utils import get_photo_urls, make_photo_path

router = APIRouter(prefix="/api/v1/games/{join_code}/rounds", tags=["rounds"])


def _get_game(join_code: str, db: Session) -> Game:
    game = db.query(Game).filter_by(join_code=join_code.upper()).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.post("/upload-photo", dependencies=[Depends(verify_admin_token)])
async def upload_photo(join_code: str, file: UploadFile):
    """Upload a photo file. Returns the filename to use when adding a round."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")

    ext = Path(file.filename or "photo.jpg").suffix or ".jpg"
    filename = f"{uuid.uuid4().hex[:12]}{ext}"
    filepath = Path(settings.photos_dir) / filename

    content = await file.read()
    filepath.write_bytes(content)

    return {"filename": filename}


@router.post("", response_model=RoundInfo, status_code=201, dependencies=[Depends(verify_admin_token)])
def add_round(join_code: str, body: RoundCreate, db: Session = Depends(get_db)):
    """Add a round to a game (admin/setup endpoint)."""
    game = _get_game(join_code, db)
    if game.status != GameStatus.LOBBY:
        raise HTTPException(status_code=400, detail="Can only add rounds in lobby")

    existing = db.query(Round).filter_by(game_id=game.id).count()
    if existing >= game.total_rounds:
        raise HTTPException(status_code=400, detail="All rounds already added")

    round_ = Round(
        game_id=game.id,
        round_number=existing,
        photo_path=body.photo_path,
        correct_lat=body.correct_lat,
        correct_lng=body.correct_lng,
        location_name=body.location_name,
    )
    db.add(round_)
    db.commit()
    db.refresh(round_)
    urls = get_photo_urls(round_.photo_path)
    return RoundInfo(
        round_number=round_.round_number,
        photo_url=urls[0],
        photo_urls=urls,
        music_url=f"/photos/{round_.music_path}" if round_.music_path else None,
        location_name=round_.location_name,
        status=round_.status,
    )


@router.get("/{round_number}", response_model=RoundInfo)
def get_round(join_code: str, round_number: int, db: Session = Depends(get_db)):
    """Get info for a specific round."""
    game = _get_game(join_code, db)
    round_ = db.query(Round).filter_by(game_id=game.id, round_number=round_number).first()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")
    urls = get_photo_urls(round_.photo_path)
    return RoundInfo(
        round_number=round_.round_number,
        photo_url=urls[0],
        photo_urls=urls,
        music_url=f"/photos/{round_.music_path}" if round_.music_path else None,
        location_name=round_.location_name,
        status=round_.status,
    )


@router.get("/{round_number}/results")
def get_round_results(join_code: str, round_number: int, db: Session = Depends(get_db)):
    """Get reveal data for a completed round (correct location + all guesses)."""
    game = _get_game(join_code, db)
    round_ = db.query(Round).filter_by(game_id=game.id, round_number=round_number).first()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")
    if round_.status not in (RoundStatus.REVEALING, RoundStatus.COMPLETE):
        raise HTTPException(status_code=400, detail="Round results not available yet")

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

    return {
        "round_number": round_.round_number,
        "correct": {
            "lat": round_.correct_lat,
            "lng": round_.correct_lng,
            "name": round_.location_name,
        },
        "guesses": guesses_data,
    }


@router.post("/{round_number}/guess", response_model=GuessResponse, status_code=201)
async def submit_guess(
    join_code: str, round_number: int, body: GuessCreate, db: Session = Depends(get_db)
):
    """Submit a guess for the current round. Only the team captain can submit."""
    game = _get_game(join_code, db)
    if game.status != GameStatus.PLAYING:
        raise HTTPException(status_code=400, detail="Game is not in progress")

    round_ = db.query(Round).filter_by(game_id=game.id, round_number=round_number).first()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")
    if round_.status != RoundStatus.GUESSING:
        raise HTTPException(status_code=400, detail="Round is not accepting guesses")

    player = db.query(Player).filter_by(session_id=body.session_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if not player.is_captain:
        raise HTTPException(status_code=403, detail="Only the team captain can submit guesses")

    team = player.team
    if team.game_id != game.id:
        raise HTTPException(status_code=400, detail="Player is not in this game")

    existing = db.query(Guess).filter_by(round_id=round_.id, team_id=team.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Team already submitted a guess")

    distance = haversine_km(body.lat, body.lng, round_.correct_lat, round_.correct_lng)
    score = calculate_score(distance)

    guess = Guess(
        round_id=round_.id,
        team_id=team.id,
        lat=body.lat,
        lng=body.lng,
        distance_km=round(distance, 2),
        score=score,
    )
    db.add(guess)
    db.commit()
    db.refresh(guess)

    response = GuessResponse(
        team_id=team.id,
        team_name=team.name,
        team_color=team.color,
        lat=guess.lat,
        lng=guess.lng,
        distance_km=guess.distance_km,
        score=guess.score,
    )

    await game_service.notify_guess(game.join_code, team.id, team.name)
    await game_service.check_all_guessed(game.id, game.join_code, round_number, db)

    return response


@router.post("/{round_number}/draft")
def post_draft(
    join_code: str, round_number: int, body: GuessCreate, db: Session = Depends(get_db)
):
    """Save a draft marker position for any team member (not just captain)."""
    game = _get_game(join_code, db)
    if game.status != GameStatus.PLAYING:
        raise HTTPException(status_code=400, detail="Game is not in progress")

    round_ = db.query(Round).filter_by(game_id=game.id, round_number=round_number).first()
    if not round_ or round_.status != RoundStatus.GUESSING:
        raise HTTPException(status_code=400, detail="Round is not accepting guesses")

    player = db.query(Player).filter_by(session_id=body.session_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    set_draft(round_.id, player.id, player.nickname, player.is_captain, body.lat, body.lng)
    return {"ok": True}


@router.get("/{round_number}/drafts")
def get_drafts(
    join_code: str, round_number: int, session_id: str, db: Session = Depends(get_db)
):
    """Get draft markers for the requesting player's team."""
    game = _get_game(join_code, db)
    round_ = db.query(Round).filter_by(game_id=game.id, round_number=round_number).first()
    if not round_:
        raise HTTPException(status_code=404, detail="Round not found")

    player = db.query(Player).filter_by(session_id=session_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Get all player IDs on this team
    team_player_ids = {p.id for p in player.team.players}
    drafts = get_team_drafts(round_.id, team_player_ids)

    return [
        {
            "player_id": d.player_id,
            "nickname": d.nickname,
            "is_captain": d.is_captain,
            "lat": d.lat,
            "lng": d.lng,
        }
        for d in drafts
    ]
