"""REST endpoints for game pack management (marketplace)."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.pack import GamePack, PackRound
from app.schemas.pack import (
    PackCreate,
    PackDetail,
    PackInfo,
    PackRoundCreate,
    PackRoundInfo,
    PackRoundUpdate,
    PackUpdate,
)
from app.utils import get_photo_urls

router = APIRouter(prefix="/api/v1/packs", tags=["packs"])


def _round_info(r: PackRound) -> PackRoundInfo:
    urls = get_photo_urls(r.photo_path)
    return PackRoundInfo(
        id=r.id,
        round_number=r.round_number,
        photo_path=r.photo_path,
        photo_urls=urls,
        correct_lat=r.correct_lat,
        correct_lng=r.correct_lng,
        location_name=r.location_name,
        music_url=f"/photos/{r.music_path}" if r.music_path else None,
    )


def _get_pack(pack_id: str, db: Session) -> GamePack:
    pack = db.query(GamePack).filter_by(id=pack_id).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Набор не найден")
    return pack


@router.get("", response_model=list[PackInfo])
def list_packs(db: Session = Depends(get_db)):
    """List all available game packs."""
    packs = db.query(GamePack).order_by(GamePack.created_at).all()
    return [
        PackInfo(
            id=p.id,
            name=p.name,
            description=p.description,
            round_count=len(p.rounds),
        )
        for p in packs
    ]


@router.post("", response_model=PackDetail, status_code=201)
def create_pack(body: PackCreate, db: Session = Depends(get_db)):
    """Create a new empty game pack."""
    pack = GamePack(name=body.name, description=body.description)
    db.add(pack)
    db.commit()
    db.refresh(pack)
    return PackDetail(id=pack.id, name=pack.name, description=pack.description, rounds=[])


@router.get("/{pack_id}", response_model=PackDetail)
def get_pack(pack_id: str, db: Session = Depends(get_db)):
    """Get pack details with all rounds."""
    pack = _get_pack(pack_id, db)
    rounds = []
    for r in pack.rounds:
        rounds.append(_round_info(r))
    return PackDetail(id=pack.id, name=pack.name, description=pack.description, rounds=rounds)


@router.patch("/{pack_id}", response_model=PackDetail)
def update_pack(pack_id: str, body: PackUpdate, db: Session = Depends(get_db)):
    """Update pack name/description."""
    pack = _get_pack(pack_id, db)
    if body.name is not None:
        pack.name = body.name
    if body.description is not None:
        pack.description = body.description
    db.commit()
    db.refresh(pack)
    return get_pack(pack_id, db)


@router.delete("/{pack_id}", status_code=204)
def delete_pack(pack_id: str, db: Session = Depends(get_db)):
    """Delete a game pack and all its rounds."""
    pack = _get_pack(pack_id, db)
    db.delete(pack)
    db.commit()


@router.post("/{pack_id}/rounds/upload-photo")
async def upload_pack_photo(pack_id: str, file: UploadFile):
    """Upload a photo for a pack round."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")
    ext = Path(file.filename or "photo.jpg").suffix or ".jpg"
    filename = f"{uuid.uuid4().hex[:12]}{ext}"
    filepath = Path(settings.photos_dir) / filename
    content = await file.read()
    filepath.write_bytes(content)
    return {"filename": filename}


@router.post("/{pack_id}/rounds/upload-music")
async def upload_pack_music(pack_id: str, file: UploadFile):
    """Upload a music/audio file for a pack round."""
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Файл должен быть аудио")
    ext = Path(file.filename or "music.mp3").suffix or ".mp3"
    filename = f"music_{uuid.uuid4().hex[:12]}{ext}"
    filepath = Path(settings.photos_dir) / filename
    content = await file.read()
    filepath.write_bytes(content)
    return {"filename": filename}


@router.post("/{pack_id}/rounds", response_model=PackRoundInfo, status_code=201)
def add_round(pack_id: str, body: PackRoundCreate, db: Session = Depends(get_db)):
    """Add a round to a pack."""
    pack = _get_pack(pack_id, db)
    round_number = len(pack.rounds)
    r = PackRound(
        pack_id=pack.id,
        round_number=round_number,
        photo_path=body.photo_path,
        correct_lat=body.correct_lat,
        correct_lng=body.correct_lng,
        location_name=body.location_name,
        music_path=body.music_path,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _round_info(r)


@router.patch("/{pack_id}/rounds/{round_id}", response_model=PackRoundInfo)
def update_round(pack_id: str, round_id: str, body: PackRoundUpdate, db: Session = Depends(get_db)):
    """Update a round in a pack."""
    _get_pack(pack_id, db)
    r = db.query(PackRound).filter_by(id=round_id, pack_id=pack_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Раунд не найден")
    if body.photo_path is not None:
        r.photo_path = body.photo_path
    if body.correct_lat is not None:
        r.correct_lat = body.correct_lat
    if body.correct_lng is not None:
        r.correct_lng = body.correct_lng
    if body.location_name is not None:
        r.location_name = body.location_name
    if body.music_path is not None:
        r.music_path = body.music_path
    db.commit()
    db.refresh(r)
    return _round_info(r)


@router.post("/{pack_id}/rounds/{round_id}/move")
def move_round(pack_id: str, round_id: str, body: dict, db: Session = Depends(get_db)):
    """Move a round up or down. Body: {"direction": "up" | "down"}."""
    _get_pack(pack_id, db)
    r = db.query(PackRound).filter_by(id=round_id, pack_id=pack_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Раунд не найден")

    direction = body.get("direction")
    if direction == "up" and r.round_number > 0:
        other = db.query(PackRound).filter_by(pack_id=pack_id, round_number=r.round_number - 1).first()
        if other:
            other.round_number, r.round_number = r.round_number, other.round_number
    elif direction == "down":
        other = db.query(PackRound).filter_by(pack_id=pack_id, round_number=r.round_number + 1).first()
        if other:
            other.round_number, r.round_number = r.round_number, other.round_number
    else:
        raise HTTPException(status_code=400, detail="Невозможно переместить")

    db.commit()
    return {"ok": True}


@router.delete("/{pack_id}/rounds/{round_id}", status_code=204)
def delete_round(pack_id: str, round_id: str, db: Session = Depends(get_db)):
    """Delete a round from a pack and renumber remaining rounds."""
    _get_pack(pack_id, db)
    r = db.query(PackRound).filter_by(id=round_id, pack_id=pack_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Раунд не найден")
    deleted_num = r.round_number
    db.delete(r)
    # Renumber rounds after the deleted one
    remaining = db.query(PackRound).filter(
        PackRound.pack_id == pack_id, PackRound.round_number > deleted_num
    ).all()
    for rem in remaining:
        rem.round_number -= 1
    db.commit()
