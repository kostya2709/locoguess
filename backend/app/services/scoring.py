"""Distance and scoring calculations using the Haversine formula."""

import math

EARTH_RADIUS_KM = 6371.0
MAX_SCORE = 5000
DECAY_CONSTANT = 2000.0  # km — controls how quickly score drops with distance


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points on Earth.

    Args:
        lat1, lng1: Latitude and longitude of point 1 in degrees.
        lat2, lng2: Latitude and longitude of point 2 in degrees.

    Returns:
        Distance in kilometers.
    """
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_KM * c


def calculate_score(distance_km: float) -> int:
    """Convert distance to a score using exponential decay.

    - 0 km → 5000 points
    - ~500 km → ~3894 points
    - ~2000 km → ~1839 points
    - ~10000 km → ~34 points

    Args:
        distance_km: Distance from the correct location in kilometers.

    Returns:
        Integer score between 0 and MAX_SCORE.
    """
    raw = MAX_SCORE * math.exp(-distance_km / DECAY_CONSTANT)
    return max(0, round(raw))
