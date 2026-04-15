"""Pydantic schemas for game and round endpoints."""

from pydantic import BaseModel, Field

from app.models.game import GameStatus, RoundStatus


class GameCreate(BaseModel):
    name: str = Field(default="New Game", max_length=100)
    pack_id: str | None = None  # If set, auto-creates rounds from this pack
    team_count: int = Field(default=2, ge=1, le=8)
    team_names: list[str] | None = None  # Optional custom names; length must match team_count
    round_duration: int = Field(default=60, ge=10, le=300)
    # Only used when pack_id is None (custom game)
    total_rounds: int = Field(default=5, ge=1, le=20)


class GameUpdate(BaseModel):
    """Update game settings before starting (lobby phase)."""
    team_count: int | None = Field(default=None, ge=1, le=8)
    team_names: list[str] | None = None
    round_duration: int | None = Field(default=None, ge=10, le=300)
    street_view_enabled: bool | None = None
    music_host: bool | None = None
    music_guests: bool | None = None


class RoundInfo(BaseModel):
    round_number: int
    photo_url: str
    photo_urls: list[str] = []
    music_url: str | None = None
    location_name: str | None
    status: RoundStatus

    model_config = {"from_attributes": True}


class GameResponse(BaseModel):
    id: str
    join_code: str
    name: str
    status: GameStatus
    round_duration: int
    street_view_enabled: bool = True
    music_host: bool = True
    music_guests: bool = False
    current_round: int | None
    total_rounds: int

    model_config = {"from_attributes": True}


class GameCreateResponse(GameResponse):
    """Returned only on game creation — includes the host_secret."""

    host_secret: str


class GameStatusResponse(BaseModel):
    """Full game status for host/join lobby polling."""

    id: str
    join_code: str
    name: str
    status: GameStatus
    round_duration: int
    street_view_enabled: bool = True
    music_host: bool = True
    music_guests: bool = False
    total_rounds: int
    rounds_configured: int
    teams: list["TeamStatusInfo"]
    ready_to_start: bool


class PlayerStatusInfo(BaseModel):
    id: str
    nickname: str
    is_captain: bool


class TeamStatusInfo(BaseModel):
    id: str
    name: str
    color: str
    player_count: int
    players: list[PlayerStatusInfo]


class ClaimHost(BaseModel):
    host_secret: str


class ClaimHostResponse(BaseModel):
    is_host: bool
    rounds_configured: int


class PackInfo(BaseModel):
    id: str
    name: str
    description: str
    round_count: int


class RoundCreate(BaseModel):
    photo_path: str
    correct_lat: float = Field(ge=-90, le=90)
    correct_lng: float = Field(ge=-180, le=180)
    location_name: str | None = None
