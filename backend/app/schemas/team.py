"""Pydantic schemas for team and player endpoints."""

from pydantic import BaseModel, Field


class TeamCreate(BaseModel):
    name: str = Field(max_length=50)
    color: str = Field(default="#3388ff", pattern=r"^#[0-9a-fA-F]{6}$")


class PlayerJoin(BaseModel):
    nickname: str = Field(max_length=30)


class PlayerSwitch(BaseModel):
    session_id: str


class PlayerResponse(BaseModel):
    id: str
    nickname: str
    is_captain: bool
    session_id: str
    team_id: str

    model_config = {"from_attributes": True}


class TeamResponse(BaseModel):
    id: str
    name: str
    color: str
    players: list[PlayerResponse] = []

    model_config = {"from_attributes": True}
