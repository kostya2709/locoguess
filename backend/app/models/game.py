"""Game and Round database models."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GameStatus(str, enum.Enum):
    LOBBY = "lobby"
    PLAYING = "playing"
    FINISHED = "finished"


class RoundStatus(str, enum.Enum):
    PENDING = "pending"
    GUESSING = "guessing"
    REVEALING = "revealing"
    COMPLETE = "complete"


class Game(Base):
    """A game session containing multiple rounds played by teams."""

    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    join_code: Mapped[str] = mapped_column(String(6), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    status: Mapped[GameStatus] = mapped_column(Enum(GameStatus), default=GameStatus.LOBBY)
    round_duration: Mapped[int] = mapped_column(Integer, default=60)
    street_view_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    music_host: Mapped[bool] = mapped_column(Boolean, default=True)
    music_guests: Mapped[bool] = mapped_column(Boolean, default=False)
    current_round: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    total_rounds: Mapped[int] = mapped_column(Integer)
    host_secret: Mapped[str] = mapped_column(
        String(36), default=lambda: str(uuid.uuid4())
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    teams = relationship("Team", back_populates="game", cascade="all, delete-orphan")
    rounds = relationship(
        "Round", back_populates="game", cascade="all, delete-orphan", order_by="Round.round_number"
    )


class Round(Base):
    """A single round within a game, associated with one photo and its correct location."""

    __tablename__ = "rounds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id: Mapped[str] = mapped_column(String(36), ForeignKey("games.id"), index=True)
    round_number: Mapped[int] = mapped_column(Integer)
    photo_path: Mapped[str] = mapped_column(String(2000))  # JSON array of paths or single path
    correct_lat: Mapped[float] = mapped_column(Float)
    correct_lng: Mapped[float] = mapped_column(Float)
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    music_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[RoundStatus] = mapped_column(Enum(RoundStatus), default=RoundStatus.PENDING)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)

    game = relationship("Game", back_populates="rounds")
    guesses = relationship("Guess", back_populates="round", cascade="all, delete-orphan")
