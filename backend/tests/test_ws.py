"""Tests for WebSocket connection manager and endpoint."""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ws.manager import ConnectionManager


class TestConnectionManager:
    def test_connect_and_room_size(self):
        mgr = ConnectionManager()

        class FakeWS:
            pass

        mgr.connect("ABC123", "sess1", FakeWS())
        assert mgr.get_room_size("ABC123") == 1

        mgr.connect("ABC123", "sess2", FakeWS())
        assert mgr.get_room_size("ABC123") == 2

    def test_disconnect(self):
        mgr = ConnectionManager()

        class FakeWS:
            pass

        conn_id = mgr.connect("ABC123", "sess1", FakeWS())
        mgr.disconnect("ABC123", conn_id)
        assert mgr.get_room_size("ABC123") == 0

    def test_disconnect_unknown(self):
        mgr = ConnectionManager()
        mgr.disconnect("UNKNOWN", "sess1")  # Should not raise


class TestWebSocketEndpoint:
    def test_connect_and_ping_pong(self, override_db):
        client = TestClient(app)
        with client.websocket_connect("/ws/TEST01?session_id=sess1") as ws:
            ws.send_text(json.dumps({"type": "ping"}))
            data = json.loads(ws.receive_text())
            assert data["type"] == "pong"
