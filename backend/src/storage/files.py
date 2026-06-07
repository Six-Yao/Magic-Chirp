import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from backend.src.config import settings


def ensure_upload_dirs() -> None:
    Path(settings.UPLOAD_DIR, settings.RECORD_UPLOAD_SUBDIR).mkdir(parents=True, exist_ok=True)


def validate_image(file: UploadFile) -> None:
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, or WEBP images are supported")
    if not file.size or file.size > settings.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Too Big Image")


def generate_file_name(original_filename: str | None) -> str:
    suffix = Path(original_filename or "upload.jpg").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        suffix = ".jpg"
    return f"{uuid.uuid4().hex}{suffix}"


def save_upload_file(file: UploadFile, subdir: str = settings.RECORD_UPLOAD_SUBDIR) -> str:
    ensure_upload_dirs()
    validate_image(file)

    filename = generate_file_name(file.filename)
    relative_path = Path(subdir) / filename
    target_path = Path(settings.UPLOAD_DIR) / relative_path

    with target_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return f"/uploads/{relative_path.as_posix()}"

