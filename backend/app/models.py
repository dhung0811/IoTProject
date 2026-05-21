from datetime import datetime
from pydantic import BaseModel, field_validator


class HealthMetric(BaseModel):
    device_id: str
    timestamp: datetime
    heartrate: float
    spO2: float

    @field_validator("heartrate")
    @classmethod
    def validate_heartrate(cls, v: float) -> float:
        if v < 30 or v > 220:
            raise ValueError(f"heartrate {v} out of valid range [30, 220]")
        return v

    @field_validator("spO2")
    @classmethod
    def validate_spo2(cls, v: float) -> float:
        if v < 70 or v > 100:
            raise ValueError(f"spO2 {v} out of valid range [70, 100]")
        return v
