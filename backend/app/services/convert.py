import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

SUPPORTED_EXTENSIONS = {".geojson", ".json", ".gpkg", ".zip"}


async def read_upload_as_feature_collection(upload: UploadFile, max_bytes: int) -> dict:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload must be GeoJSON, GeoPackage, or a zipped Shapefile")
    content = await upload.read(max_bytes + 1)
    if not content or len(content) > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Upload is empty or exceeds the size limit")
    if suffix in {".geojson", ".json"}:
        return parse_feature_collection(content)
    ogr2ogr = shutil.which("ogr2ogr")
    if not ogr2ogr:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GDAL is unavailable in this API runtime")
    with tempfile.TemporaryDirectory(prefix="geoapp-upload-") as temporary_directory:
        source = Path(temporary_directory, f"source{suffix}")
        target = Path(temporary_directory, "converted.geojson")
        source.write_bytes(content)
        result = subprocess.run([ogr2ogr, "-f", "GeoJSON", str(target), str(source)], capture_output=True, text=True, timeout=120, check=False)
        if result.returncode != 0 or not target.exists():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Could not convert the spatial file")
        return parse_feature_collection(target.read_bytes())


def parse_feature_collection(content: bytes) -> dict:
    try:
        value = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Upload is not valid GeoJSON") from exc
    if value.get("type") != "FeatureCollection" or not isinstance(value.get("features"), list) or not value["features"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="GeoJSON must be a non-empty FeatureCollection")
    if any(not isinstance(feature.get("geometry"), dict) for feature in value["features"]):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Every feature must contain a geometry")
    return value
