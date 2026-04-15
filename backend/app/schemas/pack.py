"""Pydantic schemas for pack CRUD endpoints."""

from pydantic import BaseModel, Field


class PackRoundInfo(BaseModel):
    id: str
    round_number: int
    photo_path: str
    photo_urls: list[str] = []
    correct_lat: float
    correct_lng: float
    location_name: str | None
    music_url: str | None = None

    model_config = {"from_attributes": True}


class PackInfo(BaseModel):
    id: str
    name: str
    description: str
    round_count: int


class PackDetail(BaseModel):
    id: str
    name: str
    description: str
    rounds: list[PackRoundInfo]


class PackCreate(BaseModel):
    name: str = Field(max_length=100)
    description: str = Field(default="", max_length=500)


class PackUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class PackRoundCreate(BaseModel):
    photo_path: str
    correct_lat: float = Field(ge=-90, le=90)
    correct_lng: float = Field(ge=-180, le=180)
    location_name: str | None = None
    music_path: str | None = None


class PackRoundUpdate(BaseModel):
    photo_path: str | None = None
    correct_lat: float | None = Field(default=None, ge=-90, le=90)
    correct_lng: float | None = Field(default=None, ge=-180, le=180)
    location_name: str | None = None
    music_path: str | None = None
