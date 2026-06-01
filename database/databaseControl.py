import json
import sqlite3
from datetime import datetime
from pathlib import Path

from database.models import ATTACHMENTS_TABLE_SQL, BIRD_RECORDS_TABLE_SQL, USERS_TABLE_SQL

_conn: sqlite3.Connection | None = None


def _now() -> str:
    return datetime.now().isoformat()


def _to_iso(value: datetime | str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _parse_ai_candidates(raw: str | None) -> list[dict] | None:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def get_connection() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        from backend.src.config import settings

        db_url = settings.DATABASE_URL
        if db_url.startswith("sqlite:///"):
            db_url = db_url.removeprefix("sqlite:///")

        db_path = Path(db_url)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(db_path), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys = ON")
    return _conn


def init_db() -> None:
    conn = get_connection()
    conn.execute(USERS_TABLE_SQL)
    conn.execute(BIRD_RECORDS_TABLE_SQL)
    conn.execute(ATTACHMENTS_TABLE_SQL)
    conn.commit()

    row = conn.execute("SELECT COUNT(*) FROM users").fetchone()
    if row[0] > 0:
        return

    demo_user = create_user(
        email="demo@smail.nju.edu.cn",
        password_hash="ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f",
        nickname="演示用户",
    )
    create_record(
        user_id=demo_user["id"],
        bird_name="珠颈斑鸠",
        ai_candidates=[{"name": "珠颈斑鸠", "confidence": 0.86}],
        description="鼓楼校区附近的演示记录",
        latitude=32.0569,
        longitude=118.7792,
        location_name="南京大学鼓楼校区",
        observed_at=_now(),
        visibility="public",
        cover_image_url=None,
    )
    create_record(
        user_id=demo_user["id"],
        bird_name="白头鹎",
        ai_candidates=[{"name": "白头鹎", "confidence": 0.79}],
        description="仙林校区附近的演示记录",
        latitude=32.1152,
        longitude=118.9585,
        location_name="南京大学仙林校区",
        observed_at=_now(),
        visibility="public",
        cover_image_url=None,
    )


# ── 用户 ──────────────────────────────────────────────


def create_user(email: str, password_hash: str, nickname: str, role: str = "user") -> dict:
    conn = get_connection()
    now = _now()
    cursor = conn.execute(
        "INSERT INTO users (email, password_hash, nickname, role, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (email, password_hash, nickname, role, now, now),
    )
    conn.commit()
    return {
        "id": cursor.lastrowid,
        "email": email,
        "password_hash": password_hash,
        "nickname": nickname,
        "avatar_url": None,
        "role": role,
        "created_at": now,
        "updated_at": now,
    }


def get_user_by_email(email: str) -> dict | None:
    row = get_connection().execute(
        "SELECT * FROM users WHERE email = ?", (email,)
    ).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
    row = get_connection().execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    return dict(row) if row else None


def update_user_profile(
    user_id: int,
    nickname: str | None = None,
    avatar_url: str | None = None,
) -> dict | None:
    conn = get_connection()
    parts = []
    params: list = []
    if nickname is not None:
        parts.append("nickname = ?")
        params.append(nickname)
    if avatar_url is not None:
        parts.append("avatar_url = ?")
        params.append(avatar_url)
    if not parts:
        return get_user_by_id(user_id)
    parts.append("updated_at = ?")
    params.append(_now())
    params.append(user_id)
    conn.execute(f"UPDATE users SET {', '.join(parts)} WHERE id = ?", params)
    conn.commit()
    return get_user_by_id(user_id)


# ── 记录 ──────────────────────────────────────────────


def create_record(
    user_id: int,
    bird_name: str,
    ai_candidates: list[dict] | None,
    description: str | None,
    latitude: float,
    longitude: float,
    location_name: str | None,
    observed_at: datetime | str,
    visibility: str,
    cover_image_url: str | None,
) -> dict:
    conn = get_connection()
    now = _now()
    ai_json = json.dumps(ai_candidates, ensure_ascii=False) if ai_candidates else None
    observed_str = _to_iso(observed_at)

    cursor = conn.execute(
        "INSERT INTO bird_records (user_id, bird_name, ai_candidates, description, "
        "latitude, longitude, location_name, observed_at, visibility, "
        "cover_image_url, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            user_id, bird_name, ai_json, description, latitude, longitude,
            location_name, observed_str, visibility, cover_image_url, now, now,
        ),
    )
    conn.commit()
    return {
        "id": cursor.lastrowid,
        "user_id": user_id,
        "bird_name": bird_name,
        "ai_candidates": ai_candidates,
        "description": description,
        "latitude": latitude,
        "longitude": longitude,
        "location_name": location_name,
        "observed_at": observed_str,
        "visibility": visibility,
        "cover_image_url": cover_image_url,
        "created_at": now,
        "updated_at": now,
    }


def _row_to_record(row: dict) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "bird_name": row["bird_name"],
        "ai_candidates": _parse_ai_candidates(row.get("ai_candidates")),
        "description": row.get("description"),
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "location_name": row.get("location_name"),
        "observed_at": row["observed_at"],
        "visibility": row["visibility"],
        "cover_image_url": row.get("cover_image_url"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _record_with_author(row: dict) -> dict:
    record = _row_to_record(row)
    record["author"] = {
        "id": row.get("author_id"),
        "nickname": row.get("author_nickname", "未知用户"),
    }
    record["author_nickname"] = row.get("author_nickname", "未知用户")
    return record


def get_record_by_id(record_id: int) -> dict | None:
    row = get_connection().execute(
        "SELECT r.id, r.user_id, r.bird_name, r.ai_candidates, r.description, "
        "r.latitude, r.longitude, r.location_name, r.observed_at, r.visibility, "
        "r.cover_image_url, r.created_at, r.updated_at, "
        "u.nickname AS author_nickname, u.id AS author_id "
        "FROM bird_records r JOIN users u ON r.user_id = u.id "
        "WHERE r.id = ?",
        (record_id,),
    ).fetchone()
    return _record_with_author(dict(row)) if row else None


def list_records_by_user(user_id: int) -> list[dict]:
    rows = get_connection().execute(
        "SELECT * FROM bird_records WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()
    return [_row_to_record(dict(row)) for row in rows]


def list_public_records(
    bird_name: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
) -> list[dict]:
    conn = get_connection()
    query = (
        "SELECT r.id, r.user_id, r.bird_name, r.ai_candidates, r.description, "
        "r.latitude, r.longitude, r.location_name, r.observed_at, r.visibility, "
        "r.cover_image_url, r.created_at, r.updated_at, "
        "u.nickname AS author_nickname, u.id AS author_id "
        "FROM bird_records r JOIN users u ON r.user_id = u.id "
        "WHERE r.visibility = 'public'"
    )
    params: list = []
    if bird_name:
        query += " AND r.bird_name LIKE ?"
        params.append(f"%{bird_name}%")
    if start_time:
        query += " AND r.observed_at >= ?"
        params.append(start_time)
    if end_time:
        query += " AND r.observed_at <= ?"
        params.append(end_time)
    query += " ORDER BY r.created_at DESC"

    rows = conn.execute(query, params).fetchall()
    return [_record_with_author(dict(row)) for row in rows]


def update_record_by_id(record_id: int, data: dict) -> dict | None:
    conn = get_connection()
    allowed = {
        "bird_name", "description", "latitude", "longitude",
        "location_name", "observed_at", "visibility", "cover_image_url",
        "ai_candidates",
    }
    parts = []
    params: list = []
    for key, value in data.items():
        if key not in allowed:
            continue
        if key == "ai_candidates" and value is not None:
            value = json.dumps(value, ensure_ascii=False)
        if key == "observed_at" and value is not None:
            value = _to_iso(value)
        parts.append(f"{key} = ?")
        params.append(value)

    if not parts:
        return get_record_by_id(record_id)

    parts.append("updated_at = ?")
    params.append(_now())
    params.append(record_id)
    conn.execute(f"UPDATE bird_records SET {', '.join(parts)} WHERE id = ?", params)
    conn.commit()
    return get_record_by_id(record_id)


def delete_record_by_id(record_id: int) -> bool:
    conn = get_connection()
    conn.execute("DELETE FROM attachments WHERE record_id = ?", (record_id,))
    cursor = conn.execute("DELETE FROM bird_records WHERE id = ?", (record_id,))
    conn.commit()
    return cursor.rowcount > 0


# ── 附件 ──────────────────────────────────────────────


def create_attachment(
    record_id: int,
    file_url: str,
    file_type: str,
    file_size: int | None = None,
    mime_type: str | None = None,
) -> dict:
    conn = get_connection()
    now = _now()
    cursor = conn.execute(
        "INSERT INTO attachments (record_id, file_url, file_type, file_size, mime_type, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (record_id, file_url, file_type, file_size, mime_type, now),
    )
    conn.commit()
    return {
        "id": cursor.lastrowid,
        "record_id": record_id,
        "file_url": file_url,
        "file_type": file_type,
        "file_size": file_size,
        "mime_type": mime_type,
        "created_at": now,
    }


def list_record_attachments(record_id: int) -> list[dict]:
    rows = get_connection().execute(
        "SELECT * FROM attachments WHERE record_id = ?", (record_id,)
    ).fetchall()
    return [dict(row) for row in rows]


def delete_attachments_by_record_id(record_id: int) -> None:
    conn = get_connection()
    conn.execute("DELETE FROM attachments WHERE record_id = ?", (record_id,))
    conn.commit()
