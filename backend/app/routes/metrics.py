import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.messaging import publish_fanout
from app.models import HealthMetric
from app.registry import DeviceStatus, get_status

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/metrics", status_code=202)
async def ingest_metric(metric: HealthMetric):
    status = get_status(metric.device_id)

    if status != DeviceStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Device not approved. Use /api/v1/connect first.")

    # APPROVED — publish metric
    try:
        await publish_fanout(metric.model_dump_json().encode())
    except Exception as e:
        logger.error("Failed to publish to RabbitMQ: %s", e)
        raise HTTPException(status_code=503, detail="Message queue unavailable")

    return JSONResponse({"status": "accepted"}, status_code=202)
