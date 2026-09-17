from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LayerOut(BaseModel):
    id: UUID
    name: str
    geometry_type: str
    style: dict | None
    created_at: datetime


class LayerUploadResponse(BaseModel):
    id: UUID
    name: str
    feature_count: int


class StyleUpdate(BaseModel):
    style: dict | None = Field(default=None)
