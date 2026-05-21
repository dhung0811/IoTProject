#!/usr/bin/env python3
"""
Virtual metric simulator — sends fake ESP32 health data to the ingestion API.

Usage:
    python simulate.py                        # default: 1 device, 1s interval
    python simulate.py --devices 3            # 3 concurrent virtual devices
    python simulate.py --interval 0.5         # send every 500ms
    python simulate.py --url http://localhost:8081
    python simulate.py --scenario spike       # simulate a heart-rate spike
    python simulate.py --scenario hypoxia     # simulate low SpO2 event
"""

import argparse
import asyncio
import math
import random
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

DEFAULT_URL = "https://health-api.dhunggg.io.vn"
ENDPOINT = "/api/v1/metrics"

VN_TZ = timezone(timedelta(hours=7))


# ── signal generators ────────────────────────────────────────────────────────

def _normal_heartrate(t: float) -> float:
    """Resting HR 65–80 with gentle sine variation."""
    return 72 + 8 * math.sin(t / 30) + random.gauss(0, 1.5)


def _normal_spo2(t: float) -> float:
    return 98.0 + random.gauss(0, 0.3)


def _spike_heartrate(t: float) -> float:
    """Sudden spike to 150+ then recovery over ~60 s."""
    peak = max(0.0, 1 - abs(t - 30) / 30)
    return 72 + peak * 85 + random.gauss(0, 2)


def _hypoxia_spo2(t: float) -> float:
    """Gradual drop to ~85% then slow recovery."""
    drop = max(0.0, 1 - abs(t - 45) / 45)
    return 98.0 - drop * 13 + random.gauss(0, 0.3)


SCENARIOS: dict[str, tuple] = {
    "normal":  (_normal_heartrate,  _normal_spo2),
    "spike":   (_spike_heartrate,   _normal_spo2),
    "hypoxia": (_normal_heartrate,  _hypoxia_spo2),
}


# ── per-device loop ──────────────────────────────────────────────────────────

async def run_device(
    device_id: str,
    url: str,
    interval: float,
    scenario: str,
    duration: Optional[float],
) -> None:
    hr_fn, spo2_fn = SCENARIOS[scenario]
    start = time.monotonic()
    sent = 0

    async with httpx.AsyncClient(base_url=url, timeout=5.0) as client:
        while True:
            elapsed = time.monotonic() - start
            if duration and elapsed > duration:
                break

            hr = round(max(30.0, min(220.0, hr_fn(elapsed))), 1)
            spo2 = round(max(70.0, min(100.0, spo2_fn(elapsed))), 1)

            payload = {
                "device_id": device_id,
                "timestamp": datetime.now(VN_TZ).isoformat(),
                "heartrate": hr,
                "spO2": spo2,
            }

            try:
                r = await client.post(ENDPOINT, json=payload)
                sent += 1
                status = "OK " if r.status_code == 202 else f"ERR {r.status_code}"
                print(f"[{device_id}] {status}  HR={hr:5.1f}  SpO2={spo2:5.1f}  (#{sent})")
            except httpx.RequestError as e:
                print(f"[{device_id}] CONN ERROR: {e}")

            await asyncio.sleep(interval)


# ── entry point ──────────────────────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(description="IoT metric simulator")
    parser.add_argument("--url",      default=DEFAULT_URL, help="Base URL of the ingestion API")
    parser.add_argument("--devices",  type=int,   default=1,      help="Number of virtual devices")
    parser.add_argument("--interval", type=float, default=1.0,    help="Seconds between sends")
    parser.add_argument("--duration", type=float, default=None,   help="Stop after N seconds (default: run forever)")
    parser.add_argument("--scenario", choices=list(SCENARIOS),    default="normal", help="Signal pattern to simulate")
    args = parser.parse_args()

    print(f"Simulator starting — {args.devices} device(s), interval={args.interval}s, scenario={args.scenario}")
    print(f"Target: {args.url}{ENDPOINT}\n")

    tasks = [
        run_device(
            device_id=f"esp32-sim-{i+1:02d}",
            url=args.url,
            interval=args.interval,
            scenario=args.scenario,
            duration=args.duration,
        )
        for i in range(args.devices)
    ]

    try:
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    asyncio.run(main())
