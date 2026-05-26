import asyncio
import json
import logging
from typing import Optional

import aio_pika
from fastapi import WebSocket

from app.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # clients subscribed to all devices
        self._all: set[WebSocket] = set()
        # clients subscribed to a specific device
        self._by_device: dict[str, set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, device_id: Optional[str] = None) -> None:
        await ws.accept()
        if device_id:
            self._by_device.setdefault(device_id, set()).add(ws)
        else:
            self._all.add(ws)
        logger.info("WS connected device_filter=%s total_all=%d", device_id, len(self._all))

    def disconnect(self, ws: WebSocket, device_id: Optional[str] = None) -> None:
        self._all.discard(ws)
        if device_id and device_id in self._by_device:
            self._by_device[device_id].discard(ws)
        logger.info("WS disconnected device_filter=%s", device_id)

    async def broadcast(self, payload: dict) -> None:
        device_id = payload.get("device_id")
        data = json.dumps(payload)

        targets: set[WebSocket] = set(self._all)
        if device_id and device_id in self._by_device:
            targets |= self._by_device[device_id]

        if not targets:
            return

        dead: set[WebSocket] = set()
        for ws in targets:
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)

        for ws in dead:
            self._all.discard(ws)
            for conns in self._by_device.values():
                conns.discard(ws)


manager = ConnectionManager()


async def consume_loop() -> None:
    for attempt in range(1, 11):
        try:
            logger.info("Broadcaster connecting to RabbitMQ (attempt %d)...", attempt)
            connection = await aio_pika.connect_robust(settings.rabbitmq_url, timeout=10)
            break
        except Exception:
            if attempt == 10:
                raise
            await asyncio.sleep(5)

    async with connection:
        channel = await connection.channel()
        exchange = await channel.declare_exchange(
            settings.rabbitmq_exchange,
            aio_pika.ExchangeType.FANOUT,
            durable=True,
        )
        # exclusive + auto-delete: queue lives only while this service is running
        queue = await channel.declare_queue("", exclusive=True, auto_delete=True)
        await queue.bind(exchange)

        logger.info("Broadcaster consuming from exchange: %s", settings.rabbitmq_exchange)

        async with queue.iterator() as it:
            async for message in it:
                async with message.process():
                    try:
                        payload = json.loads(message.body)
                        await manager.broadcast(payload)
                    except Exception:
                        logger.exception("Failed to broadcast message")
