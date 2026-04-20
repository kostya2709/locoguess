"""In-memory storage for draft marker positions during a round.

Drafts are ephemeral — they exist only while a round is active.
Each player can update their draft position; teammates can see each other's.
Only the captain's position matters for the final guess.
"""

from dataclasses import dataclass

@dataclass
class DraftMarker:
    player_id: str
    nickname: str
    is_captain: bool
    lat: float
    lng: float


# {round_id: {player_id: DraftMarker}}
_drafts: dict[str, dict[str, DraftMarker]] = {}


def set_draft(round_id: str, player_id: str, nickname: str, is_captain: bool, lat: float, lng: float):
    """Set or update a player's draft marker for a round."""
    if round_id not in _drafts:
        _drafts[round_id] = {}
    _drafts[round_id][player_id] = DraftMarker(
        player_id=player_id,
        nickname=nickname,
        is_captain=is_captain,
        lat=lat,
        lng=lng,
    )


def get_team_drafts(round_id: str, team_player_ids: set[str]) -> list[DraftMarker]:
    """Get all draft markers for a set of player IDs (i.e., a team) in a round."""
    round_drafts = _drafts.get(round_id, {})
    return [m for pid, m in round_drafts.items() if pid in team_player_ids]


def get_round_drafts(round_id: str) -> dict[str, DraftMarker]:
    """Return all drafts for a round keyed by player_id. Empty dict if none."""
    return dict(_drafts.get(round_id, {}))


def clear_round(round_id: str):
    """Clear all drafts for a round (called when round ends)."""
    _drafts.pop(round_id, None)
