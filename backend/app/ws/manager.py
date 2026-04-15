"""WebSocket connection manager with per-game rooms."""

import json
import logging
import uuid
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by game join code.

    Each connection gets a unique ID to avoid overwrites when the same
    session_id reconnects (e.g. page reload, component remount).
    """

    def __init__(self):
        self._rooms: dict[str, dict[str, WebSocket]] = {}  # join_code -> {conn_id: ws}

    def connect(self, join_code: str, session_id: str, websocket: WebSocket) -> str:
        """Register a connection in a game room. Returns a unique connection ID."""
        if join_code not in self._rooms:
            self._rooms[join_code] = {}
        conn_id = f"{session_id}_{uuid.uuid4().hex[:8]}"
        self._rooms[join_code][conn_id] = websocket
        logger.info("WS connected: %s (%s) in game %s", session_id, conn_id, join_code)
        return conn_id

    def disconnect(self, join_code: str, conn_id: str):
        """Remove a connection from a game room."""
        if join_code in self._rooms:
            self._rooms[join_code].pop(conn_id, None)
            if not self._rooms[join_code]:
                del self._rooms[join_code]
        logger.info("WS disconnected: %s from game %s", conn_id, join_code)

    async def broadcast(self, join_code: str, message: dict[str, Any]):
        """Send a JSON message to all connections in a game room."""
        room = self._rooms.get(join_code, {})
        data = json.dumps(message)
        dead: list[str] = []
        for conn_id, ws in room.items():
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(conn_id)
        for conn_id in dead:
            self.disconnect(join_code, conn_id)

    def get_room_size(self, join_code: str) -> int:
        """Return the number of connections in a game room."""
        return len(self._rooms.get(join_code, {}))


manager = ConnectionManager()
