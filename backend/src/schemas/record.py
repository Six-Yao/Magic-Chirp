from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class AttachmentResponse(BaseModel):
    file_url: str
    file_type: str


class RecordCreateResponse(BaseModel):
    id: int
    bird_name: str
    detail_url: str
    message: str


class RecordDetailResponse(BaseModel):
    id: int
    bird_name: str
    ai_candidates: list[dict] | None = None
    description: str | None = None
    latitude: float
    longitude: float
    location_name: str | None = None
    observed_at: datetime
    visibility: Literal["public", "private"]
    author: dict
    attachments: list[AttachmentResponse]
    created_at: datetime


class MyRecordResponse(BaseModel):
    id: int
    bird_name: str
    location_name: str | None = None
    observed_at: datetime
    visibility: Literal["public", "private"]
    cover_image_url: str | None = None


class MapRecordResponse(BaseModel):
    id: int
    bird_name: str
    latitude: float
    longitude: float
    location_name: str | None = None
    observed_at: datetime
    cover_image_url: str | None = None
    author_nickname: str


class PublicRecordResponse(BaseModel):
    id: int
    bird_name: str
    latitude: float
    longitude: float
    location_name: str | None = None
    observed_at: datetime
    cover_image_url: str | None = None
    author_nickname: str
    description: str | None = None


class PublicRecordOptionsResponse(BaseModel):
    bird_names: list[str]
    location_names: list[str]
