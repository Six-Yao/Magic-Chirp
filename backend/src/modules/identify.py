from fastapi import APIRouter, File, UploadFile

from backend.src.schemas.identify import BirdCandidate, IdentifyResponse
from backend.src.storage.files import validate_image


router = APIRouter()


def run_mock_identify(filename: str | None = None) -> list[BirdCandidate]:
    name = (filename or "").lower()
    if "sparrow" in name or "maque" in name:
        return [
            BirdCandidate(name="麻雀", confidence=0.91),
            BirdCandidate(name="树麻雀", confidence=0.74),
            BirdCandidate(name="白头鹎", confidence=0.31),
        ]
    if "dove" in name or "pigeon" in name:
        return [
            BirdCandidate(name="珠颈斑鸠", confidence=0.88),
            BirdCandidate(name="山斑鸠", confidence=0.57),
            BirdCandidate(name="灰鸽", confidence=0.29),
        ]
    return [
        BirdCandidate(name="珠颈斑鸠", confidence=0.86),
        BirdCandidate(name="白头鹎", confidence=0.63),
        BirdCandidate(name="乌鸫", confidence=0.41),
    ]


@router.post("", response_model=IdentifyResponse)
def identify_bird(image: UploadFile = File(...)) -> IdentifyResponse:
    validate_image(image)
    candidates = run_mock_identify(image.filename)
    return IdentifyResponse(candidates=candidates, source="mock")

