# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Realtime IoT health monitoring platform that collects biometric telemetry (heart rate BPM, SpO2) from ESP32 + MAX30102 sensors and streams it through a distributed backend to a Next.js dashboard.

## Planned Tech Stack

| Layer | Technology |
|---|---|
| Device | ESP32 + MAX30102 (C++/Arduino) |
| Ingestion API | FastAPI (Python) |
| Message Queue | RabbitMQ (MVP) or Kafka (production) |
| Stream Processing | Python async workers |
| Time-Series DB | InfluxDB |
| AI Alert Service | Python service via Gemini API |
| WebSocket Gateway | FastAPI WebSockets or dedicated service |
| Frontend | Next.js |
| Observability | Prometheus + Grafana |
| Deployment | Docker + Kubernetes |

## Data Flow

```
ESP32 Sensor → FastAPI (POST /api/v1/metrics) → RabbitMQ/Kafka → Stream Processor → Time-Series DB → AI Alert Service → WebSocket Gateway → Next.js Dashboard
```

## Telemetry Payload Schema

```json
{
  "device_id": "esp32-001",
  "timestamp": "2026-05-19T14:30:15Z",
  "heartrate": 76.3,
  "spO2": 98.4
}
```

## Validation Rules

- Heart rate: reject if `< 30` or `> 220` BPM
- SpO2: reject if `< 70` or `> 100` %

## Pydantic Model (FastAPI)

```python
class HealthMetric(BaseModel):
    device_id: str
    timestamp: datetime
    heartrate: float
    spO2: float
```

## Key Design Decisions

- **RabbitMQ over Kafka for MVP** — simpler setup; switch to Kafka when throughput demands it
- **InfluxDB chosen** for time-series storage — use InfluxDB v2 client (`influxdb-client` Python package) with Flux or InfluxQL queries
- **AI alerts via Gemini API** — use existing `GEMINI_API_KEY`; call Gemini for anomaly interpretation and health trend analysis rather than building a custom ML model
- **WebSocket for frontend** — polling is explicitly rejected in favor of push-based updates
- **All services must run on Linux** — develop with Docker to avoid macOS-specific issues
