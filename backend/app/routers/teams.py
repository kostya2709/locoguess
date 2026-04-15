"""REST endpoints for team and player management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Game, GameStatus, Player, Team
from app.schemas.team import PlayerJoin, PlayerResponse, PlayerSwitch, TeamCreate, TeamResponse

router = APIRouter(prefix="/api/v1/games/{join_code}/teams", tags=["teams"])


def _get_game_in_lobby(join_code: str, db: Session) -> Game:
    game = db.query(Game).filter_by(join_code=join_code.upper()).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.status != GameStatus.LOBBY:
        raise HTTPException(status_code=400, detail="Game is not in lobby")
    return game


def _ensure_captain(team_id: str, db: Session):
    """Ensure a team has exactly one captain. If none, promote the first player."""
    players = db.query(Player).filter_by(team_id=team_id).all()
    if not players:
        return
    captains = [p for p in players if p.is_captain]
    if len(captains) == 0:
        players[0].is_captain = True
    elif len(captains) > 1:
        # Keep only the first captain
        for c in captains[1:]:
            c.is_captain = False


def _move_player_to_team(player: Player, new_team: Team, db: Session):
    """Move a player to a new team, ensuring both teams have a captain."""
    old_team_id = player.team_id

    player.is_captain = False
    player.team_id = new_team.id
    db.flush()

    _ensure_captain(old_team_id, db)
    _ensure_captain(new_team.id, db)

    db.commit()
    db.refresh(player)


@router.post("", response_model=TeamResponse, status_code=201)
def create_team(join_code: str, body: TeamCreate, db: Session = Depends(get_db)):
    """Create a new team in a game that is in the lobby."""
    game = _get_game_in_lobby(join_code, db)
    team = Team(game_id=game.id, name=body.name, color=body.color)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.post("/{team_id}/join", response_model=PlayerResponse, status_code=201)
def join_team(join_code: str, team_id: str, body: PlayerJoin, db: Session = Depends(get_db)):
    """Join an existing team as a player. First player becomes captain."""
    game = _get_game_in_lobby(join_code, db)
    team = db.query(Team).filter_by(id=team_id, game_id=game.id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check if this nickname already exists in the game
    existing = (
        db.query(Player)
        .join(Team)
        .filter(Team.game_id == game.id, Player.nickname == body.nickname)
        .first()
    )
    if existing:
        if existing.team_id == team.id:
            # Same team — ensure captain status is correct and return
            _ensure_captain(team.id, db)
            db.commit()
            db.refresh(existing)
            return existing
        else:
            # Different team — move them (switch)
            _move_player_to_team(existing, team, db)
            return existing

    is_captain = len(team.players) == 0
    player = Player(team_id=team.id, nickname=body.nickname, is_captain=is_captain)
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


@router.post("/{team_id}/switch", response_model=PlayerResponse)
def switch_team(join_code: str, team_id: str, body: PlayerSwitch, db: Session = Depends(get_db)):
    """Move a player to a different team by session_id."""
    game = _get_game_in_lobby(join_code, db)
    new_team = db.query(Team).filter_by(id=team_id, game_id=game.id).first()
    if not new_team:
        raise HTTPException(status_code=404, detail="Team not found")

    player = db.query(Player).filter_by(session_id=body.session_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if player.team_id == team_id:
        raise HTTPException(status_code=400, detail="Already on this team")

    _move_player_to_team(player, new_team, db)
    return player


@router.post("/{team_id}/captain/{player_id}", response_model=PlayerResponse)
def set_captain(join_code: str, team_id: str, player_id: str, db: Session = Depends(get_db)):
    """Set a specific player as the team captain (host action)."""
    game = _get_game_in_lobby(join_code, db)
    team = db.query(Team).filter_by(id=team_id, game_id=game.id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    player = db.query(Player).filter_by(id=player_id, team_id=team.id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found on this team")

    # Remove captain from current captain
    current_captain = db.query(Player).filter_by(team_id=team.id, is_captain=True).first()
    if current_captain:
        current_captain.is_captain = False

    player.is_captain = True
    db.commit()
    db.refresh(player)
    return player
