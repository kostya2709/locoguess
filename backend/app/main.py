"""FastAPI application entry point."""

import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.routers import games, packs, rounds, teams
from app.ws.handler import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup and seed default packs."""
    Base.metadata.create_all(bind=engine)
    # Seed default packs if DB is empty
    from app.database import SessionLocal
    from app.game_packs import seed_default_packs
    db = SessionLocal()
    try:
        seed_default_packs(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Unique ID generated on each server start — clients use this to detect restarts
BOOT_ID = str(uuid.uuid4())


@app.get("/api/v1/boot-id")
def get_boot_id():
    return {"boot_id": BOOT_ID}

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router)
app.include_router(packs.router)
app.include_router(teams.router)
app.include_router(rounds.router)
app.include_router(ws_router)

# Serve photos as static files
photos_path = Path(settings.photos_dir)
photos_path.mkdir(parents=True, exist_ok=True)
app.mount("/photos", StaticFiles(directory=str(photos_path)), name="photos")
