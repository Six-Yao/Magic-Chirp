import ast
import os

def _get_bool_env(key: str, default: bool) -> bool:
	value = os.getenv(key)
	if value is None:
		return default
	return value.strip().lower() in {"1", "true", "yes", "on"}

def _get_int_env(key: str, default: int) -> int:
	value = os.getenv(key)
	if value is None:
		return default
	try:
		return int(value)
	except ValueError:
		return default

def _get_set_env(key: str, default: set[str]) -> set[str]:
	value = os.getenv(key)
	if value is None:
		return default
	try:
		parsed = ast.literal_eval(value)
		if isinstance(parsed, (set, list, tuple)):
			return {str(item) for item in parsed}
	except (SyntaxError, ValueError):
		pass
	return default


API_KEY = os.getenv("API_KEY", "")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///database/magic_chirp.db")

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
RECORD_UPLOAD_SUBDIR = os.getenv("RECORD_UPLOAD_SUBDIR", "records")

JWT_SECRET = os.getenv("JWT_SECRET", "use-a-more-than-32-byte-random-secret")
JWT_EXPIRE_MINUTES = _get_int_env("JWT_EXPIRE_MINUTES", 1440)

ALLOWED_EMAIL_SUFFIX = os.getenv("ALLOWED_EMAIL_SUFFIX", "@smail.nju.edu.cn")
ALLOWED_IMAGE_TYPES = _get_set_env(
	"ALLOWED_IMAGE_TYPES",
	{"image/jpeg", "image/png", "image/webp"},
)
MAX_IMAGE_SIZE_MB = _get_int_env("MAX_IMAGE_SIZE_MB", 10)

USE_MOCK_AI = _get_bool_env("USE_MOCK_AI", True)

