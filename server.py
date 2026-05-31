from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.src.config import settings
from backend.src.modules import auth, identify, map_records, records
from backend.src.storage.files import ensure_upload_dirs
from database.databaseControl import init_db


def create_app() -> FastAPI:
    app = FastAPI(title="Magic-Chirp Mock API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    ensure_upload_dirs()
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(identify.router, prefix="/api/identify", tags=["identify"])
    app.include_router(records.router, prefix="/api/records", tags=["records"])
    app.include_router(map_records.router, prefix="/api/map", tags=["map"])

    @app.on_event("startup")
    def startup_event() -> None:
        init_db()

    return app


app = create_app()

