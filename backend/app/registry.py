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


# Only one device may be active at a time. Any new connect request (including
# from a previously approved device) replaces the current slot and requires
# fresh approval.
_current: DeviceRecord | None = None


def get_status(device_id: str) -> DeviceStatus | None:
    if _current is None or _current.device_id != device_id:
        return None
    return _current.status


def register_pending(device_id: str) -> DeviceRecord:
    global _current
    _current = DeviceRecord(device_id=device_id)
    return _current


def decide(device_id: str, approved: bool) -> bool:
    global _current
    if _current is None or _current.device_id != device_id:
        return False
    _current.status = DeviceStatus.APPROVED if approved else DeviceStatus.DENIED
    _current.decided_at = datetime.now(timezone.utc)
    _current.event.set()
    return True


def get_all() -> list[DeviceRecord]:
    return [_current] if _current else []
