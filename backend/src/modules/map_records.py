from fastapi import APIRouter

from backend.src.schemas.record import MapRecordResponse
from database.databaseControl import list_public_records


router = APIRouter()


@router.get("/records", response_model=list[MapRecordResponse])
def list_map_records(
    bird_name: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    publisher: str | None = None,
) -> list[MapRecordResponse]:
    records = list_public_records(
        bird_name=bird_name,
        start_time=start_time,
        end_time=end_time,
        publisher=publisher,
    )
    return [MapRecordResponse(**record) for record in records]
