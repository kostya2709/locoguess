"""Seed script to create a sample game using a built-in pack.

Usage:
    cd backend
    .venv/bin/python seed.py
"""

from app.database import Base, engine, SessionLocal
from app.game_packs import get_pack
from app.models import Game, Round, Team, Player

TEAM_PRESETS = [
    ("Red Team", "#ef4444"),
    ("Blue Team", "#3b82f6"),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    existing = db.query(Game).filter_by(join_code="DEMO01").first()
    if existing:
        print(f"Demo game already exists (id={existing.id})")
        print(f"  Host secret: {existing.host_secret}")
        return

    pack = get_pack("russian_landmarks")
    assert pack is not None

    game = Game(
        join_code="DEMO01",
        name="Demo Game",
        total_rounds=len(pack.rounds),
        round_duration=60,
    )
    db.add(game)
    db.flush()

    for i, r in enumerate(pack.rounds):
        db.add(Round(
            game_id=game.id,
            round_number=i,
            photo_path=r.photo_path_encoded,
            correct_lat=r.lat,
            correct_lng=r.lng,
            location_name=r.location_name,
        ))

    for name, color in TEAM_PRESETS:
        db.add(Team(game_id=game.id, name=name, color=color))

    db.commit()
    print(f"Seeded demo game: DEMO01")
    print(f"  Host secret: {game.host_secret}")
    print(f"  {len(pack.rounds)} rounds ({pack.name}), {len(TEAM_PRESETS)} teams")


if __name__ == "__main__":
    seed()
