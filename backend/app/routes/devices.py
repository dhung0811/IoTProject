import asyncio
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.messaging import publish_approval_request
from app.registry import decide, get_all, get_status, register_pending, DeviceRecord, DeviceStatus

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Pydantic models ───────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    device_id: str
    connection: str  # expects "request"


class DecisionRequest(BaseModel):
    approved: bool


class DeviceRecordOut(BaseModel):
    device_id: str
    status: str
    first_seen: str
    decided_at: str | None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize(rec: DeviceRecord) -> DeviceRecordOut:
    return DeviceRecordOut(
        device_id=rec.device_id,
        status=rec.status.value,
        first_seen=rec.first_seen.isoformat(),
        decided_at=rec.decided_at.isoformat() if rec.decided_at else None,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

CONNECT_TIMEOUT = 300.0  # seconds to wait for operator decision

@router.post("/connect")
async def device_connect(body: ConnectRequest):
    """
    ESP32 handshake — blocks until the operator approves or denies.
    The device sends this once and waits; no polling needed.
    """
    record = register_pending(body.device_id)
    await publish_approval_request(body.device_id)

    try:
        await asyncio.wait_for(record.event.wait(), timeout=CONNECT_TIMEOUT)
    except asyncio.TimeoutError:
        return JSONResponse({"connection": "timeout", "device_id": body.device_id}, status_code=408)

    if record.status == DeviceStatus.APPROVED:
        return JSONResponse({"connection": "approved", "device_id": body.device_id}, status_code=200)
    return JSONResponse({"connection": "denied", "device_id": body.device_id}, status_code=403)


@router.get("/devices")
async def list_devices():
    return [_serialize(r) for r in get_all()]


@router.post("/devices/{device_id}/decision")
async def device_decision(device_id: str, body: DecisionRequest):
    ok = decide(device_id, body.approved)
    if not ok:
        raise HTTPException(status_code=404, detail="Device not found in registry")
    return {"device_id": device_id, "approved": body.approved}
