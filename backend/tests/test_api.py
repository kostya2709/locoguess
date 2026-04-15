"""Integration tests for REST API endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import GameStatus, RoundStatus


@pytest.fixture
def client(override_db):
    """HTTP test client with overridden database."""
    return TestClient(app)


def _get_first_pack_id(client) -> str:
    """Helper to get the first seeded pack ID."""
    packs = client.get("/api/v1/packs").json()
    return packs[0]["id"]


class TestPackEndpoints:
    def test_list_packs(self, client):
        resp = client.get("/api/v1/packs")
        assert resp.status_code == 200
        packs = resp.json()
        assert len(packs) >= 2

    def test_pack_has_round_count(self, client):
        resp = client.get("/api/v1/packs")
        pack = resp.json()[0]
        assert "round_count" in pack
        assert pack["round_count"] > 0

    def test_get_pack_detail(self, client):
        pack_id = _get_first_pack_id(client)
        resp = client.get(f"/api/v1/packs/{pack_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["rounds"]) == 5

    def test_create_and_delete_pack(self, client):
        resp = client.post("/api/v1/packs", json={"name": "Тест", "description": "тестовый набор"})
        assert resp.status_code == 201
        pack_id = resp.json()["id"]
        resp = client.delete(f"/api/v1/packs/{pack_id}")
        assert resp.status_code == 204


class TestGameEndpoints:
    def test_create_game_with_pack(self, client):
        pack_id = _get_first_pack_id(client)
        resp = client.post(
            "/api/v1/games",
            json={"name": "Test", "pack_id": pack_id, "team_count": 3, "round_duration": 45},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test"
        assert data["total_rounds"] == 5
        assert data["round_duration"] == 45
        assert data["status"] == GameStatus.LOBBY
        assert "host_secret" in data

    def test_create_game_custom(self, client):
        resp = client.post(
            "/api/v1/games",
            json={"name": "Custom", "team_count": 2, "round_duration": 30, "total_rounds": 3},
        )
        assert resp.status_code == 201
        assert resp.json()["total_rounds"] == 3

    def test_create_game_auto_creates_teams(self, client):
        pack_id = _get_first_pack_id(client)
        game = client.post(
            "/api/v1/games",
            json={"pack_id": pack_id, "team_count": 3},
        ).json()
        teams = client.get(f"/api/v1/games/{game['join_code']}/teams").json()
        assert len(teams) == 3
        assert teams[0]["name"] == "Красные"

    def test_create_game_invalid_pack(self, client):
        resp = client.post(
            "/api/v1/games",
            json={"pack_id": "nonexistent-id", "team_count": 2},
        )
        assert resp.status_code == 400

    def test_get_game(self, client):
        create = client.post(
            "/api/v1/games", json={"team_count": 2, "total_rounds": 1}
        ).json()
        resp = client.get(f"/api/v1/games/{create['join_code']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == create["id"]

    def test_get_game_not_found(self, client):
        resp = client.get("/api/v1/games/XXXXXX")
        assert resp.status_code == 404

    def test_game_status(self, client):
        pack_id = _get_first_pack_id(client)
        game = client.post(
            "/api/v1/games",
            json={"pack_id": pack_id, "team_count": 2},
        ).json()
        resp = client.get(f"/api/v1/games/{game['join_code']}/status")
        assert resp.status_code == 200
        status = resp.json()
        assert status["rounds_configured"] == 5
        assert len(status["teams"]) == 2
        assert status["ready_to_start"] is False

    def test_claim_host(self, client):
        pack_id = _get_first_pack_id(client)
        game = client.post(
            "/api/v1/games",
            json={"pack_id": pack_id, "team_count": 2},
        ).json()
        resp = client.post(
            f"/api/v1/games/{game['join_code']}/claim-host",
            json={"host_secret": game["host_secret"]},
        )
        assert resp.status_code == 200
        assert resp.json()["is_host"] is True

    def test_claim_host_bad_secret(self, client):
        pack_id = _get_first_pack_id(client)
        game = client.post(
            "/api/v1/games",
            json={"pack_id": pack_id, "team_count": 2},
        ).json()
        resp = client.post(
            f"/api/v1/games/{game['join_code']}/claim-host",
            json={"host_secret": "wrong"},
        )
        assert resp.status_code == 403


class TestTeamEndpoints:
    def _create_game(self, client) -> dict:
        return client.post(
            "/api/v1/games", json={"team_count": 2, "total_rounds": 1}
        ).json()

    def test_auto_created_teams(self, client):
        game = self._create_game(client)
        teams = client.get(f"/api/v1/games/{game['join_code']}/teams").json()
        assert len(teams) == 2
        assert {t["name"] for t in teams} == {"Красные", "Синие"}

    def test_join_team_first_player_is_captain(self, client):
        game = self._create_game(client)
        teams = client.get(f"/api/v1/games/{game['join_code']}/teams").json()
        player = client.post(
            f"/api/v1/games/{game['join_code']}/teams/{teams[0]['id']}/join",
            json={"nickname": "Alice"},
        ).json()
        assert player["is_captain"] is True

    def test_second_player_not_captain(self, client):
        game = self._create_game(client)
        teams = client.get(f"/api/v1/games/{game['join_code']}/teams").json()
        tid = teams[0]["id"]
        client.post(
            f"/api/v1/games/{game['join_code']}/teams/{tid}/join",
            json={"nickname": "Alice"},
        )
        p2 = client.post(
            f"/api/v1/games/{game['join_code']}/teams/{tid}/join",
            json={"nickname": "Bob"},
        ).json()
        assert p2["is_captain"] is False


class TestRoundEndpoints:
    def _setup_game_with_pack(self, client) -> tuple[dict, list]:
        pack_id = _get_first_pack_id(client)
        game = client.post(
            "/api/v1/games",
            json={"pack_id": pack_id, "team_count": 2},
        ).json()
        teams = client.get(f"/api/v1/games/{game['join_code']}/teams").json()
        players = []
        for team in teams:
            p = client.post(
                f"/api/v1/games/{game['join_code']}/teams/{team['id']}/join",
                json={"nickname": f"Player_{team['name'][:3]}"},
            ).json()
            players.append(p)
        return game, players

    def test_pack_creates_rounds(self, client):
        pack_id = _get_first_pack_id(client)
        game = client.post(
            "/api/v1/games",
            json={"pack_id": pack_id, "team_count": 2},
        ).json()
        resp = client.get(f"/api/v1/games/{game['join_code']}/rounds/0")
        assert resp.status_code == 200
        assert resp.json()["photo_url"] == "/photos/moscow.jpg"

    def test_add_round_custom(self, client):
        game = client.post(
            "/api/v1/games", json={"team_count": 2, "total_rounds": 2}
        ).json()
        resp = client.post(
            f"/api/v1/games/{game['join_code']}/rounds",
            json={"photo_path": "test.jpg", "correct_lat": 10.0, "correct_lng": 20.0},
        )
        assert resp.status_code == 201
        assert resp.json()["round_number"] == 0

    def test_submit_guess_requires_playing_game(self, client):
        game, players = self._setup_game_with_pack(client)
        resp = client.post(
            f"/api/v1/games/{game['join_code']}/rounds/0/guess",
            json={"lat": 49.0, "lng": 2.5, "session_id": players[0]["session_id"]},
        )
        assert resp.status_code == 400

    def test_scoreboard(self, client):
        pack_id = _get_first_pack_id(client)
        game = client.post(
            "/api/v1/games",
            json={"pack_id": pack_id, "team_count": 2},
        ).json()
        resp = client.get(f"/api/v1/games/{game['join_code']}/scoreboard")
        assert resp.status_code == 200
        board = resp.json()
        assert len(board) == 2
        assert all(entry["total_score"] == 0 for entry in board)

    def test_status_ready_to_start(self, client):
        game, _ = self._setup_game_with_pack(client)
        status = client.get(f"/api/v1/games/{game['join_code']}/status").json()
        assert status["ready_to_start"] is True
