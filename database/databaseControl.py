from datetime import datetime

_USERS: dict[int, dict] = {}
_RECORDS: dict[int, dict] = {}
_ATTACHMENTS: dict[int, dict] = {}
_NEXT_USER_ID = 1
_NEXT_RECORD_ID = 1
_NEXT_ATTACHMENT_ID = 1


def _now() -> datetime:
    return datetime.now()


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def init_db() -> None:
    if _USERS:
        return

    user = create_user(
        email="demo@smail.nju.edu.cn",
        password_hash="ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f",
        nickname="演示用户",
    )
    first_record = create_record(
        user_id=user["id"],
        bird_name="珠颈斑鸠",
        ai_candidates=[{"name": "珠颈斑鸠", "confidence": 0.86}],
        description="鼓楼校区附近的演示记录",
        latitude=32.0569,
        longitude=118.7792,
        location_name="南京大学鼓楼校区",
        observed_at=_now(),
        visibility="public",
        cover_image_url="/uploads/records/demo-spotted-dove.jpg",
    )
    create_attachment(
        record_id=first_record["id"],
        file_url="/uploads/records/demo-spotted-dove.jpg",
        file_type="image",
        mime_type="image/jpeg",
    )
    second_record = create_record(
        user_id=user["id"],
        bird_name="白头鹎",
        ai_candidates=[{"name": "白头鹎", "confidence": 0.79}],
        description="仙林校区附近的演示记录",
        latitude=32.1152,
        longitude=118.9585,
        location_name="南京大学仙林校区",
        observed_at=_now(),
        visibility="public",
        cover_image_url="/uploads/records/demo-egret.jpg",
    )
    create_attachment(
        record_id=second_record["id"],
        file_url="/uploads/records/demo-egret.jpg",
        file_type="image",
        mime_type="image/jpeg",
    )


def create_user(
    email: str, password_hash: str, nickname: str, role: str = "user", bio: str | None = None
) -> dict:
    global _NEXT_USER_ID
    now = _now()
    user = {
        "id": _NEXT_USER_ID,
        "email": email,
        "password_hash": password_hash,
        "nickname": nickname,
        "bio": bio or "",
        "avatar_url": None,
        "role": role,
        "created_at": now,
        "updated_at": now,
    }
    _USERS[_NEXT_USER_ID] = user
    _NEXT_USER_ID += 1
    return user


def update_user_profile(user_id: int, nickname: str, bio: str | None) -> dict | None:
    user = get_user_by_id(user_id)
    if not user:
        return None

    user["nickname"] = nickname
    user["bio"] = bio or ""
    user["updated_at"] = _now()
    return user


def get_user_by_email(email: str) -> dict | None:
    return next((user for user in _USERS.values() if user["email"] == email), None)


def get_user_by_id(user_id: int) -> dict | None:
    return _USERS.get(user_id)


def create_record(
    user_id: int,
    bird_name: str,
    ai_candidates: list[dict] | None,
    description: str | None,
    latitude: float,
    longitude: float,
    location_name: str | None,
    observed_at: datetime,
    visibility: str,
    cover_image_url: str | None,
) -> dict:
    global _NEXT_RECORD_ID
    now = _now()
    record = {
        "id": _NEXT_RECORD_ID,
        "user_id": user_id,
        "bird_name": bird_name,
        "ai_candidates": ai_candidates,
        "description": description,
        "latitude": latitude,
        "longitude": longitude,
        "location_name": location_name,
        "observed_at": observed_at,
        "visibility": visibility,
        "cover_image_url": cover_image_url,
        "created_at": now,
        "updated_at": now,
    }
    _RECORDS[_NEXT_RECORD_ID] = record
    _NEXT_RECORD_ID += 1
    return record


def _record_with_author(record: dict) -> dict:
    user = get_user_by_id(record["user_id"]) or {}
    return {
        **record,
        "author": {
            "id": user.get("id"),
            "nickname": user.get("nickname", "未知用户"),
        },
        "author_nickname": user.get("nickname", "未知用户"),
    }


def get_record_by_id(record_id: int) -> dict | None:
    record = _RECORDS.get(record_id)
    return _record_with_author(record) if record else None


def list_records_by_user(user_id: int) -> list[dict]:
    return [
        record
        for record in sorted(
            _RECORDS.values(), key=lambda item: item["observed_at"], reverse=True
        )
        if record["user_id"] == user_id
    ]


def list_public_records(
    bird_name: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
) -> list[dict]:
    records = [
        record for record in _RECORDS.values() if record["visibility"] == "public"
    ]
    if bird_name:
        records = [record for record in records if bird_name in record["bird_name"]]
    start_dt = _parse_datetime(start_time)
    end_dt = _parse_datetime(end_time)
    if start_dt:
        records = [record for record in records if record["observed_at"] >= start_dt]
    if end_dt:
        records = [record for record in records if record["observed_at"] <= end_dt]
    return [
        _record_with_author(record)
        for record in sorted(records, key=lambda item: item["observed_at"], reverse=True)
    ]


def create_attachment(
    record_id: int,
    file_url: str,
    file_type: str,
    file_size: int | None = None,
    mime_type: str | None = None,
) -> dict:
    global _NEXT_ATTACHMENT_ID
    attachment = {
        "id": _NEXT_ATTACHMENT_ID,
        "record_id": record_id,
        "file_url": file_url,
        "file_type": file_type,
        "file_size": file_size,
        "mime_type": mime_type,
        "created_at": _now(),
    }
    _ATTACHMENTS[_NEXT_ATTACHMENT_ID] = attachment
    _NEXT_ATTACHMENT_ID += 1
    return attachment


def list_record_attachments(record_id: int) -> list[dict]:
    return [item for item in _ATTACHMENTS.values() if item["record_id"] == record_id]
