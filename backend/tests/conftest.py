"""Shared test fixtures."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Game, GameStatus, Player, Round, RoundStatus, Team


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database session for testing."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def override_db(db_session):
    """Override the FastAPI get_db dependency to use the test session. Seeds default packs."""
    from app.game_packs import seed_default_packs
    seed_default_packs(db_session)

    def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    yield db_session
    app.dependency_overrides.clear()


@pytest.fixture
def sample_game(db_session) -> Game:
    """Create a sample game with 2 teams, players, and 3 rounds."""
    game = Game(join_code="ABC123", name="Test Game", total_rounds=3, round_duration=60)
    db_session.add(game)
    db_session.flush()

    team1 = Team(game_id=game.id, name="Team Alpha", color="#ff0000")
    team2 = Team(game_id=game.id, name="Team Beta", color="#0000ff")
    db_session.add_all([team1, team2])
    db_session.flush()

    p1 = Player(team_id=team1.id, nickname="Alice", is_captain=True)
    p2 = Player(team_id=team1.id, nickname="Bob")
    p3 = Player(team_id=team2.id, nickname="Charlie", is_captain=True)
    db_session.add_all([p1, p2, p3])

    for i in range(3):
        r = Round(
            game_id=game.id,
            round_number=i,
            photo_path=f"round_{i}.jpg",
            correct_lat=48.8566 + i,
            correct_lng=2.3522 + i,
            location_name=f"Location {i}",
        )
        db_session.add(r)

    db_session.commit()
    db_session.refresh(game)
    return game
