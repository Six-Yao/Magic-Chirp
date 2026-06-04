import json
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.src.modules.auth import get_current_user, get_optional_current_user
from backend.src.schemas.record import (
    AttachmentResponse,
    MyRecordResponse,
    RecordCreateResponse,
    RecordDetailResponse,
)
from backend.src.storage.files import save_upload_file
from database.databaseControl import (
    create_attachment,
    create_record as db_create_record,
    get_record_by_id,
    list_record_attachments,
    list_records_by_user,
)


router = APIRouter()


def parse_ai_candidates(ai_candidates: str | None) -> list[dict] | None:
    if not ai_candidates:
        return None
    try:
        value = json.loads(ai_candidates)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="ai_candidates must be JSON") from exc
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail="ai_candidates must be a JSON array")
    return value


@router.post("", response_model=RecordCreateResponse)
def create_record(
    bird_name: str = Form(...),
    ai_candidates: str | None = Form(default=None),
    description: str | None = Form(default=None),
    latitude: float = Form(...),
    longitude: float = Form(...),
    location_name: str | None = Form(default=None),
    observed_at: datetime = Form(...),
    visibility: str = Form(default="public"),
    image: UploadFile | None = File(default=None),
    current_user: dict = Depends(get_current_user),
) -> RecordCreateResponse:
    if visibility not in {"public", "private"}:
        raise HTTPException(status_code=400, detail="visibility must be public or private")

    parsed_candidates = parse_ai_candidates(ai_candidates)
    cover_image_url = save_upload_file(image) if image else None

    record = db_create_record(
        user_id=current_user["id"],
        bird_name=bird_name,
        ai_candidates=parsed_candidates,
        description=description,
        latitude=latitude,
        longitude=longitude,
        location_name=location_name,
        observed_at=observed_at,
        visibility=visibility,
        cover_image_url=cover_image_url,
    )

    if cover_image_url:
        create_attachment(
            record_id=record["id"],
            file_url=cover_image_url,
            file_type="image",
            file_size=None,
            mime_type=image.content_type if image else None,
        )

    return RecordCreateResponse(
        id=record["id"],
        bird_name=record["bird_name"],
        detail_url=f"/records/{record['id']}",
        message="record created",
    )


@router.get("/mine", response_model=list[MyRecordResponse])
def get_my_records(current_user: dict = Depends(get_current_user)) -> list[MyRecordResponse]:
    records = list_records_by_user(current_user["id"])
    return [MyRecordResponse(**record) for record in records]


@router.get("/{record_id}", response_model=RecordDetailResponse)
def get_record_detail(
    record_id: int,
    current_user: dict | None = Depends(get_optional_current_user),
) -> RecordDetailResponse:
    record = get_record_by_id(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    if record["visibility"] == "private" and (
        not current_user or record["user_id"] != current_user["id"]
    ):
        raise HTTPException(status_code=403, detail="No permission to view this record")

    attachments = [
        AttachmentResponse(file_url=item["file_url"], file_type=item["file_type"])
        for item in list_record_attachments(record_id)
    ]
    return RecordDetailResponse(**record, attachments=attachments)
