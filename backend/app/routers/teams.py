"""REST endpoints for team and player management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Game, GameStatus, Player, Team
from app.schemas.team import PlayerJoin, PlayerRename, PlayerResponse, PlayerSwitch, TeamCreate, TeamResponse

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


def _update_existing_player(
    player: Player, target_team: Team, nickname: str, game_id: str, db: Session
) -> Player:
    """Update an existing player's name/team in place; return the player."""
    if player.nickname != nickname:
        conflict = (
            db.query(Player).join(Team)
            .filter(
                Team.game_id == game_id,
                Player.nickname == nickname,
                Player.id != player.id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(status_code=409, detail="Nickname already taken")
        player.nickname = nickname
    if player.team_id != target_team.id:
        _move_player_to_team(player, target_team, db)
    else:
        _ensure_captain(target_team.id, db)
        db.commit()
        db.refresh(player)
    return player


@router.post("/{team_id}/join", response_model=PlayerResponse, status_code=201)
def join_team(join_code: str, team_id: str, body: PlayerJoin, db: Session = Depends(get_db)):
    """Join an existing team. If caller provides a session_id of an existing
    player in this game, update that player in place instead of creating a new
    one (prevents duplicates when a tab re-joins after rename)."""
    game = _get_game_in_lobby(join_code, db)
    team = db.query(Team).filter_by(id=team_id, game_id=game.id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    nickname = body.nickname.strip()
    if not nickname:
        raise HTTPException(status_code=400, detail="Nickname cannot be empty")

    # 1. If caller identifies themselves, update their existing player in place.
    if body.session_id:
        mine = db.query(Player).filter_by(session_id=body.session_id).first()
        if mine and mine.team.game_id == game.id:
            return _update_existing_player(mine, team, nickname, game.id, db)

    # 2. Otherwise dedup by nickname within this game.
    existing = (
        db.query(Player).join(Team)
        .filter(Team.game_id == game.id, Player.nickname == nickname)
        .first()
    )
    if existing:
        return _update_existing_player(existing, team, nickname, game.id, db)

    # 3. New player.
    is_captain = len(team.players) == 0
    player = Player(team_id=team.id, nickname=nickname, is_captain=is_captain)
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


@router.post("/rename", response_model=PlayerResponse)
def rename_player(join_code: str, body: PlayerRename, db: Session = Depends(get_db)):
    """Rename a player by session_id. Only allowed while the game is in lobby."""
    game = _get_game_in_lobby(join_code, db)
    player = db.query(Player).filter_by(session_id=body.session_id).first()
    if not player or player.team.game_id != game.id:
        raise HTTPException(status_code=404, detail="Player not found")

    new_nick = body.nickname.strip()
    if not new_nick:
        raise HTTPException(status_code=400, detail="Nickname cannot be empty")
    if new_nick == player.nickname:
        return player

    conflict = (
        db.query(Player).join(Team)
        .filter(Team.game_id == game.id, Player.nickname == new_nick, Player.id != player.id)
        .first()
    )
    if conflict:
        raise HTTPException(status_code=409, detail="Nickname already taken")

    player.nickname = new_nick
    db.commit()
    db.refresh(player)
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
