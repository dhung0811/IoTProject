import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class DeviceStatus(str, Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    DENIED   = "denied"


@dataclass
class DeviceRecord:
    device_id:  str
    status:     DeviceStatus = DeviceStatus.PENDING
    first_seen: datetime     = field(default_factory=lambda: datetime.now(timezone.utc))
    decided_at: datetime | None = None
    event:      asyncio.Event   = field(default_factory=asyncio.Event)


_devices: dict[str, DeviceRecord] = {}


def get_status(device_id: str) -> DeviceStatus | None:
    rec = _devices.get(device_id)
    return rec.status if rec else None


def register_pending(device_id: str) -> DeviceRecord:
    rec = DeviceRecord(device_id=device_id)
    _devices[device_id] = rec
    return rec


def decide(device_id: str, approved: bool) -> bool:
    rec = _devices.get(device_id)
    if rec is None:
        return False
    rec.status = DeviceStatus.APPROVED if approved else DeviceStatus.DENIED
    rec.decided_at = datetime.now(timezone.utc)
    rec.event.set()
    return True


def get_all() -> list[DeviceRecord]:
    return list(_devices.values())
