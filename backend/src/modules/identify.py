import os
import httpx
from fastapi import APIRouter, File, UploadFile, HTTPException

from backend.src.schemas.identify import BirdCandidate, IdentifyResponse
from backend.src.storage.files import validate_image

router = APIRouter()

# ========== 配置加载（你的方式） ==========
USE_MOCK_AI = os.environ.get("USE_MOCK_AI", "True").lower() == "true"
API_KEY = os.environ.get("API_KEY", "")
API_URL = os.environ.get("API_URL", "http://ai.open.hhodata.com/v1/identify")


def run_mock_identify(filename: str | None = None) -> list[BirdCandidate]:
    """mock 识别逻辑"""
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


async def call_real_api(image_data: bytes, filename: str) -> list[BirdCandidate]:
    """调用真实 API"""
    print("========== 进入了 call_real_api ==========")
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API Key 未配置")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            API_URL,
            files={"image": (filename, image_data, "image/jpeg")},
            headers={"Authorization": f"Bearer {API_KEY}"}
        )

        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"识别服务异常: {response.text}")

        data = response.json()
        candidates = [
            BirdCandidate(name=item["name"], confidence=item["confidence"])
            for item in data.get("predictions", [])
        ]
        return candidates


@router.post("", response_model=IdentifyResponse)
async def identify_bird(image: UploadFile = File(...)) -> IdentifyResponse:
    validate_image(image)

    if USE_MOCK_AI:
        candidates = run_mock_identify(image.filename)
        source = "mock"
    else:
        image_data = await image.read()
        candidates = await call_real_api(image_data, image.filename)
        source = "ai"

    return IdentifyResponse(candidates=candidates, source=source)
