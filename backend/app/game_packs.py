"""Seed default game packs into the database on first startup."""

import json

from sqlalchemy.orm import Session

from app.models.pack import GamePack, PackRound


# Default packs to seed if DB is empty
_DEFAULT_PACKS = [
    {
        "name": "Достопримечательности России",
        "description": "5 знаковых мест по всей России",
        "rounds": [
            (["moscow.jpg", "kazan.jpg"], 55.7539, 37.6208, "Красная площадь, Москва"),
            (["saint_petersburg.jpg", "kaliningrad.jpg"], 59.9401, 30.3289, "Эрмитаж, Санкт-Петербург"),
            (["kazan.jpg"], 55.7985, 49.1064, "Мечеть Кул-Шариф, Казань"),
            (["vladivostok.jpg", "sochi.jpg", "novosibirsk.jpg"], 43.1155, 131.8855, "Владивосток"),
            (["sochi.jpg"], 43.5854, 39.7231, "Сочи"),
        ],
    },
    {
        "name": "Города России",
        "description": "5 городов из разных частей страны",
        "rounds": [
            (["novosibirsk.jpg", "yekaterinburg.jpg"], 55.0302, 82.9204, "Новосибирск"),
            (["yekaterinburg.jpg"], 56.8389, 60.6057, "Екатеринбург"),
            (["kaliningrad.jpg", "nizhny.jpg"], 54.7104, 20.4522, "Калининград"),
            (["nizhny.jpg"], 56.2965, 43.9361, "Нижний Новгород"),
            (["irkutsk.png", "moscow.jpg", "saint_petersburg.jpg"], 52.2870, 104.3050, "Иркутск"),
        ],
    },
]


def _encode_photos(paths: list[str]) -> str:
    return paths[0] if len(paths) == 1 else json.dumps(paths)


def seed_default_packs(db: Session):
    """Seed default packs into DB if no packs exist yet."""
    if db.query(GamePack).count() > 0:
        return

    for pack_data in _DEFAULT_PACKS:
        pack = GamePack(name=pack_data["name"], description=pack_data["description"])
        db.add(pack)
        db.flush()
        for i, (photos, lat, lng, name) in enumerate(pack_data["rounds"]):
            db.add(PackRound(
                pack_id=pack.id,
                round_number=i,
                photo_path=_encode_photos(photos),
                correct_lat=lat,
                correct_lng=lng,
                location_name=name,
            ))
    db.commit()
