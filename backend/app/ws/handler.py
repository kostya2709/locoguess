"""WebSocket endpoint for real-time game communication."""

import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.ws.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/{join_code}")
async def websocket_endpoint(
    websocket: WebSocket,
    join_code: str,
    session_id: str = Query(...),
):
    """WebSocket connection for receiving game broadcasts."""
    await websocket.accept()
    conn_id = manager.connect(join_code.upper(), session_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(join_code.upper(), conn_id)
