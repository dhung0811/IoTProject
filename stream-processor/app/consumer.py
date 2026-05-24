import asyncio
import json
import logging

import aio_pika

from app.config import settings
from app.influx_writer import write
from app.processor import process

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def handle_message(message: aio_pika.IncomingMessage) -> None:
    async with message.process(requeue=True):
        try:
            payload = json.loads(message.body)
            if payload.get("type") is not None:
                return
            metric = process(payload)
            await write(metric)

            if metric.alert_low_spo2 or metric.alert_high_heartrate:
                logger.warning(
                    "ALERT device=%s low_spo2=%s high_hr=%s",
                    metric.device_id,
                    metric.alert_low_spo2,
                    metric.alert_high_heartrate,
                )
        except Exception:
            logger.exception("Failed to process message")
            raise


async def main() -> None:
    logger.info("Connecting to RabbitMQ...")
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)

    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=10)

        exchange = await channel.declare_exchange(
            settings.rabbitmq_exchange,
            aio_pika.ExchangeType.FANOUT,
            durable=True,
        )
        queue = await channel.declare_queue(settings.rabbitmq_queue, durable=True)
        await queue.bind(exchange)

        logger.info("Consuming from exchange: %s → queue: %s", settings.rabbitmq_exchange, settings.rabbitmq_queue)
        await queue.consume(handle_message)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
