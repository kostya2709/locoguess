"""Pydantic schemas for guess and scoreboard endpoints."""

from pydantic import BaseModel, Field


class GuessCreate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    session_id: str


class GuessResponse(BaseModel):
    team_id: str
    team_name: str
    team_color: str
    lat: float
    lng: float
    distance_km: float
    score: int

    model_config = {"from_attributes": True}


class ScoreboardEntry(BaseModel):
    rank: int
    team_id: str
    team_name: str
    team_color: str
    total_score: int
    round_scores: list[int | None]
