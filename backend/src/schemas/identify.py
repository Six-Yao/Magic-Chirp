from typing import Literal

from pydantic import BaseModel


class BirdCandidate(BaseModel):
    name: str
    confidence: float


class IdentifyResponse(BaseModel):
    candidates: list[BirdCandidate]
    source: Literal["mock", "api", "local_model"] = "mock"

