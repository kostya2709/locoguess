"""Tests for distance and scoring calculations."""

import pytest

from app.services.scoring import calculate_score, haversine_km


class TestHaversine:
    """Test haversine distance with known city pairs."""

    def test_same_point(self):
        assert haversine_km(0, 0, 0, 0) == 0.0

    def test_paris_to_london(self):
        # Paris (48.8566, 2.3522) to London (51.5074, -0.1278) ≈ 343 km
        dist = haversine_km(48.8566, 2.3522, 51.5074, -0.1278)
        assert 340 < dist < 346

    def test_new_york_to_los_angeles(self):
        # NYC (40.7128, -74.0060) to LA (34.0522, -118.2437) ≈ 3944 km
        dist = haversine_km(40.7128, -74.0060, 34.0522, -118.2437)
        assert 3935 < dist < 3955

    def test_tokyo_to_sydney(self):
        # Tokyo (35.6762, 139.6503) to Sydney (-33.8688, 151.2093) ≈ 7823 km
        dist = haversine_km(35.6762, 139.6503, -33.8688, 151.2093)
        assert 7815 < dist < 7835

    def test_antipodal_points(self):
        # North pole to south pole ≈ 20015 km (half circumference)
        dist = haversine_km(90, 0, -90, 0)
        assert 20010 < dist < 20020

    def test_symmetry(self):
        d1 = haversine_km(48.8566, 2.3522, 51.5074, -0.1278)
        d2 = haversine_km(51.5074, -0.1278, 48.8566, 2.3522)
        assert abs(d1 - d2) < 0.001


class TestCalculateScore:
    """Test score calculation from distance."""

    def test_perfect_guess(self):
        assert calculate_score(0) == 5000

    def test_close_guess(self):
        score = calculate_score(10)
        assert 4950 < score <= 5000

    def test_medium_distance(self):
        score = calculate_score(500)
        assert 3800 < score < 4000

    def test_far_distance(self):
        score = calculate_score(5000)
        assert 0 < score < 500

    def test_very_far(self):
        score = calculate_score(20000)
        assert score == 0

    def test_score_decreases_with_distance(self):
        scores = [calculate_score(d) for d in [0, 100, 500, 1000, 5000, 10000]]
        assert scores == sorted(scores, reverse=True)

    @pytest.mark.parametrize(
        "distance,min_score,max_score",
        [
            (0, 5000, 5000),
            (100, 4700, 4800),
            (1000, 3000, 3100),
            (2000, 1800, 1900),
        ],
    )
    def test_score_ranges(self, distance, min_score, max_score):
        score = calculate_score(distance)
        assert min_score <= score <= max_score
