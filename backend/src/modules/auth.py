import hashlib
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException

from backend.src.config import settings
from backend.src.schemas.user import TokenResponse, UserLogin, UserRegister, UserResponse
from database.databaseControl import create_user, get_user_by_email, get_user_by_id


router = APIRouter()
_TOKENS: dict[str, int] = {}


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def create_access_token(user_id: int) -> str:
    token = f"mock-token-{uuid.uuid4().hex}"
    _TOKENS[token] = user_id
    return token


def decode_access_token(token: str) -> int | None:
    return _TOKENS.get(token)


def validate_nju_email(email: str) -> None:
    if not email.endswith(settings.ALLOWED_EMAIL_SUFFIX):
        raise HTTPException(status_code=400, detail="Only NJU smail accounts are allowed")


def to_user_response(user: dict) -> UserResponse:
    return UserResponse(
        id=user["id"],
        email=user["email"],
        nickname=user["nickname"],
        role=user["role"],
    )


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = authorization.removeprefix("Bearer ").strip()
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/register", response_model=UserResponse)
def register_user(payload: UserRegister) -> UserResponse:
    validate_nju_email(payload.email)
    if get_user_by_email(payload.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    nickname = payload.nickname or payload.email.split("@")[0]
    user = create_user(
        email=payload.email,
        password_hash=hash_password(payload.password),
        nickname=nickname,
    )
    return to_user_response(user)


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin) -> TokenResponse:
    user = get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["id"])
    return TokenResponse(access_token=token, user=to_user_response(user))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return to_user_response(current_user)

