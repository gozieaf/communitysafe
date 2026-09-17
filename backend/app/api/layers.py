import json
import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import text

from app.api.deps import DbSession, require_admin
from app.core.config import get_settings
from app.db.models import Layer, User
from app.schemas.layer import LayerOut, LayerUploadResponse
from app.services.convert import read_upload_as_feature_collection

router = APIRouter(tags=["layers"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])
IDENTIFIER = re.compile(r"^layer_[a-f0-9]{12}$")


def quoted_table_name(table_name: str) -> str:
    if not IDENTIFIER.fullmatch(table_name):
        raise ValueError("Unsafe generated table name")
    return f'"{table_name}"'


@router.get("/layers", response_model=list[LayerOut])
def list_layers(db: DbSession) -> list[Layer]:
    return list(db.query(Layer).order_by(Layer.created_at.desc()).all())


@router.get("/features/{layer_id}")
def get_features(layer_id: uuid.UUID, db: DbSession, bbox: Annotated[str | None, Query()] = None) -> dict:
    layer = db.get(Layer, layer_id)
    if layer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layer not found")
    table = quoted_table_name(layer.table_name)
    query = f"SELECT jsonb_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(geom)::jsonb, 'properties', properties) AS feature FROM {table}"
    parameters: dict[str, float] = {}
    if bbox:
        try:
            west, south, east, north = (float(value) for value in bbox.split(","))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="bbox must be west,south,east,north") from exc
        query += " WHERE geom && ST_MakeEnvelope(:west, :south, :east, :north, :srid)"
        parameters = {"west": west, "south": south, "east": east, "north": north, "srid": layer.srid}
    features = [row.feature for row in db.execute(text(query), parameters)]
    return {"type": "FeatureCollection", "features": features}


@admin_router.post("/layers", response_model=LayerUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_layer(db: DbSession, current_user: Annotated[User, Depends(require_admin)], file: UploadFile = File(...)) -> LayerUploadResponse:
    collection = await read_upload_as_feature_collection(file, get_settings().upload_max_bytes)
    first_geometry = collection["features"][0]["geometry"]
    geometry_type = first_geometry.get("type")
    if not isinstance(geometry_type, str):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Geometry type is missing")
    table_name = f"layer_{uuid.uuid4().hex[:12]}"
    table = quoted_table_name(table_name)
    layer = Layer(name=(file.filename or "Untitled layer")[:255], table_name=table_name, geometry_type=geometry_type, uploaded_by=current_user.id)
    try:
        db.execute(text(f"CREATE TABLE {table} (id bigserial PRIMARY KEY, properties jsonb NOT NULL DEFAULT '{{}}'::jsonb, geom geometry(Geometry, 4326) NOT NULL)"))
        for feature in collection["features"]:
            db.execute(text(f"INSERT INTO {table} (properties, geom) VALUES (CAST(:properties AS jsonb), ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326))"), {"properties": json.dumps(feature.get("properties") or {}), "geometry": json.dumps(feature["geometry"])})
        db.execute(text(f"CREATE INDEX {table_name}_geom_gix ON {table} USING GIST (geom)"))
        db.add(layer)
        db.commit()
        db.refresh(layer)
    except Exception:
        db.rollback()
        raise
    return LayerUploadResponse(id=layer.id, name=layer.name, feature_count=len(collection["features"]))


@admin_router.delete("/layers/{layer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_layer(layer_id: uuid.UUID, db: DbSession, _: Annotated[User, Depends(require_admin)]) -> None:
    layer = db.get(Layer, layer_id)
    if layer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layer not found")
    db.execute(text(f"DROP TABLE {quoted_table_name(layer.table_name)}"))
    db.delete(layer)
    db.commit()
