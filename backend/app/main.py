import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.routes.metrics import router as metrics_router
from app.routes.chat import router as chat_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="IoT Health Monitoring API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metrics_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")

Instrumentator().instrument(app).expose(app)


@app.get("/health")
async def health():
    return {"status": "ok"}
