import os
import asyncio
import httpx
from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import List

from backend.src.schemas.identify import BirdCandidate, IdentifyResponse
from backend.src.storage.files import validate_image

router = APIRouter()

# ========== 配置加载（你的方式） ==========
USE_MOCK_AI = os.environ.get("USE_MOCK_AI", "True").lower() == "true"
API_KEY = os.environ.get("API_KEY", "")
API_URL = os.environ.get("API_URL", "https://ai.open.hhodata.com/api/v2")


def run_mock_identify(filename: str | None = None) -> List[BirdCandidate]:
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


async def call_real_api(image_data: bytes, filename: str) -> List[BirdCandidate]:
    """调用真实懂鸟异步 API：上传图片 -> 获取 resultid -> 轮询获取识别结果并解析为 BirdCandidate 列表

    实现细节基于 doc.json：上传使用 header `api_key`，上传字段包括 `image` 与 `upload=1`，
    识别为异步任务，上传返回一个任务 ID（可能在 `data` 中以数组第二项返回），
    需要用该 ID 在同一接口以 `resultid` 字段轮询查询最终识别结果。
    """
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API Key 未配置")

    upload_url = API_URL.rstrip("/") + "/dongniao"

    async with httpx.AsyncClient(timeout=30) as client:
        files = {"image": (filename, image_data, "image/jpeg")}
        data = {"upload": "1", "class": "B"}
        headers = {"api_key": API_KEY}

        resp = await client.post(upload_url, files=files, data=data, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"识别服务异常: {resp.status_code} {resp.text}")

        j = resp.json()

        # 提取返回的 task/result id，支持多种返回格式（见 doc.json 示例）
        recognition_id = None
        # 情形1：直接返回列表 [1000, "HH-B_..."]
        if isinstance(j, list) and len(j) >= 2 and isinstance(j[1], str):
            recognition_id = j[1]
        # 情形2：返回字典，data 内为列表或 dict
        elif isinstance(j, dict):
            d = j.get("data")
            if isinstance(d, list) and len(d) >= 2 and isinstance(d[1], str):
                recognition_id = d[1]
            elif isinstance(d, dict):
                recognition_id = d.get("recognitionId") or d.get("resultid") or d.get("resultId")
            elif isinstance(d, str):
                recognition_id = d

        # 兜底：查看顶层字段（dict 情形）
        if not recognition_id and isinstance(j, dict):
            recognition_id = j.get("resultid") or j.get("recognitionId") or j.get("resultId")

        if not recognition_id:
            raise HTTPException(status_code=502, detail=f"无法从上传结果中提取识别 ID: {j}")

        # 轮询查询结果
        max_retries = 6
        for attempt in range(max_retries):
            await asyncio.sleep(1 if attempt > 0 else 0.5)
            # 按 doc.json 使用 multipart/form-data 发送 resultid
            poll_files = {"resultid": (None, recognition_id)}
            poll_resp = await client.post(upload_url, files=poll_files, headers=headers)
            if poll_resp.status_code != 200:
                # 若偶发性错误，继续重试
                continue
            pj = poll_resp.json()

            # 兼容 list 响应，如 [1001, "id"] 或 [1000, {...}]
            if isinstance(pj, list):
                # 未生成
                if len(pj) >= 1 and pj[0] == 1001:
                    continue
                # 成功且第二项为结果体或 data
                if len(pj) >= 2:
                    data = pj[1]
                else:
                    continue
            else:
                status = str(pj.get("status", "")) if isinstance(pj, dict) else ""
                if status.strip() == "1001":
                    continue
                data = pj.get("data") if isinstance(pj, dict) else pj

            # 如果 data 是二元数组 [1000, {...}] 的形式，取第二项
            if isinstance(data, list) and len(data) == 2 and isinstance(data[0], int):
                data = data[1]

            candidates: List[BirdCandidate] = []

            # 处理常见的图片识别返回结构：data 是目标列表
            if isinstance(data, list):
                seen = {}
                for obj in data:
                    if not isinstance(obj, dict):
                        continue
                    lst = obj.get("list") or obj.get("candidates") or []
                    if not lst:
                        continue
                    top = lst[0]
                    if not isinstance(top, (list, tuple)) or len(top) < 2:
                        continue
                    raw_conf = top[0]
                    raw_name = top[1]
                    # 名称可能包含多个以 '|' 分隔的字段，优先取中文名（第一个）
                    name = str(raw_name).split("|")[0]
                    try:
                        conf = float(raw_conf)
                    except Exception:
                        conf = 0.0
                    if conf > 1.0:
                        conf = conf / 100.0

                    # 保证按最高置信度保留唯一名称
                    if name in seen:
                        if conf > seen[name]:
                            seen[name] = conf
                    else:
                        seen[name] = conf

                # 转为 BirdCandidate 列表，并按置信度排序，取前 5
                candidates = [BirdCandidate(name=n, confidence=c) for n, c in seen.items()]
                candidates.sort(key=lambda x: x.confidence, reverse=True)
                return candidates[:5]

            # 如果没有解析出结果，继续重试
        # 超时仍无结果
        return []


@router.post("", response_model=IdentifyResponse)
async def identify_bird(image: UploadFile = File(...)) -> IdentifyResponse:
    validate_image(image)

    if USE_MOCK_AI:
        candidates = run_mock_identify(image.filename)
        source = "mock"
    else:
        image_data = await image.read()
        candidates = await call_real_api(image_data, image.filename)
        source = "api"

    return IdentifyResponse(candidates=candidates, source=source)
