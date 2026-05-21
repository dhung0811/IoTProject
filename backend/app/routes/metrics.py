import logging

import aio_pika
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.config import settings
from app.models import HealthMetric

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/metrics", status_code=202)
async def ingest_metric(metric: HealthMetric):
    payload = metric.model_dump_json()

    try:
        connection = await aio_pika.connect_robust(settings.rabbitmq_url)
        async with connection:
            channel = await connection.channel()
            exchange = await channel.declare_exchange(
                settings.rabbitmq_exchange,
                aio_pika.ExchangeType.FANOUT,
                durable=True,
            )
            await exchange.publish(
                aio_pika.Message(
                    body=payload.encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key="",
            )
    except Exception as e:
        logger.error("Failed to publish to RabbitMQ: %s", e)
        raise HTTPException(status_code=503, detail="Message queue unavailable")

    return JSONResponse({"status": "accepted"}, status_code=202)
