"""Application configuration loaded from environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with defaults suitable for local development."""

    app_name: str = "LocoGuess"
    database_url: str = "sqlite:///./locoguess.db"
    photos_dir: str = str(Path(__file__).resolve().parent.parent / "photos")
    round_duration: int = 60  # seconds
    reveal_duration: int = 10  # seconds between reveal and next round
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_prefix": "LOCOGUESS_"}


settings = Settings()
