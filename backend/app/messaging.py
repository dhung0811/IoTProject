import json
import logging

import aio_pika

from app.config import settings

logger = logging.getLogger(__name__)


async def publish_fanout(body: bytes) -> None:
    conn = await aio_pika.connect_robust(settings.rabbitmq_url)
    async with conn:
        ch = await conn.channel()
        exchange = await ch.declare_exchange(
            settings.rabbitmq_exchange,
            aio_pika.ExchangeType.FANOUT,
            durable=True,
        )
        await exchange.publish(
            aio_pika.Message(body=body, delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
            routing_key="",
        )


async def publish_approval_request(device_id: str) -> None:
    event = json.dumps({"type": "device_approval_request", "device_id": device_id})
    try:
        await publish_fanout(event.encode())
    except Exception as e:
        logger.error("Failed to publish approval request for %s: %s", device_id, e)
