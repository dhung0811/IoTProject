from collections import defaultdict, deque
from dataclasses import dataclass

from app.config import settings


@dataclass
class ProcessedMetric:
    device_id: str
    timestamp: str
    heartrate: float
    spo2: float
    heartrate_avg: float
    spo2_avg: float
    alert_low_spo2: bool
    alert_high_heartrate: bool


_windows: dict[str, dict[str, deque]] = defaultdict(
    lambda: {
        "heartrate": deque(maxlen=settings.moving_avg_window),
        "spo2": deque(maxlen=settings.moving_avg_window),
    }
)


def process(payload: dict) -> ProcessedMetric:
    device_id = payload["device_id"]
    heartrate = payload["heartrate"]
    spo2 = payload["spO2"]

    w = _windows[device_id]
    w["heartrate"].append(heartrate)
    w["spo2"].append(spo2)

    heartrate_avg = sum(w["heartrate"]) / len(w["heartrate"])
    spo2_avg = sum(w["spo2"]) / len(w["spo2"])

    return ProcessedMetric(
        device_id=device_id,
        timestamp=payload["timestamp"],
        heartrate=heartrate,
        spo2=spo2,
        heartrate_avg=round(heartrate_avg, 2),
        spo2_avg=round(spo2_avg, 2),
        alert_low_spo2=spo2_avg < 92.0,
        alert_high_heartrate=heartrate_avg > 120.0,
    )
