"""GamePack and PackRound database models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GamePack(Base):
    """A reusable set of rounds (photos + locations) that can be used to create games."""

    __tablename__ = "game_packs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    rounds = relationship(
        "PackRound", back_populates="pack", cascade="all, delete-orphan",
        order_by="PackRound.round_number",
    )


class PackRound(Base):
    """A single round within a game pack."""

    __tablename__ = "pack_rounds"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pack_id: Mapped[str] = mapped_column(String(36), ForeignKey("game_packs.id"), index=True)
    round_number: Mapped[int] = mapped_column(Integer)
    photo_path: Mapped[str] = mapped_column(String(2000))  # Single path or JSON array
    correct_lat: Mapped[float] = mapped_column(Float)
    correct_lng: Mapped[float] = mapped_column(Float)
    location_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    music_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    pack = relationship("GamePack", back_populates="rounds")
