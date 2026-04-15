"""Utility functions."""

import json


def get_photo_urls(photo_path: str) -> list[str]:
    """Parse photo_path field into a list of URLs.
    Supports both JSON arrays and plain filenames (backward compat).
    """
    try:
        paths = json.loads(photo_path)
        if isinstance(paths, list):
            return [f"/photos/{p}" for p in paths]
    except (json.JSONDecodeError, TypeError):
        pass
    return [f"/photos/{photo_path}"]


def make_photo_path(filenames: list[str]) -> str:
    """Encode a list of filenames into the photo_path field."""
    if len(filenames) == 1:
        return filenames[0]
    return json.dumps(filenames)
