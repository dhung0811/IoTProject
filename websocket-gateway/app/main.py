import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.broadcaster import consume_loop, manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(consume_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="IoT WebSocket Gateway", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def ws_all(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # keep the connection alive; clients are read-only
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.websocket("/ws/{device_id}")
async def ws_device(websocket: WebSocket, device_id: str):
    await manager.connect(websocket, device_id=device_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, device_id=device_id)
