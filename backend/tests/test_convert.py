import pytest
from fastapi import HTTPException

from app.services.convert import parse_feature_collection


def test_parses_geojson_feature_collection() -> None:
    value = parse_feature_collection(b'{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[3,6]}}]}')
    assert value["features"][0]["geometry"]["type"] == "Point"


def test_rejects_empty_feature_collection() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_feature_collection(b'{"type":"FeatureCollection","features":[]}')
    assert exc.value.status_code == 422
