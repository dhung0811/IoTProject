import asyncio
import logging
from datetime import datetime, timezone, timedelta

VN_TZ = timezone(timedelta(hours=7))

from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS
from influxdb_client.client.write.point import Point

from app.config import settings
from app.processor import ProcessedMetric

logger = logging.getLogger(__name__)


def _parse_timestamp(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _write_sync(point: Point) -> None:
    with InfluxDBClient(
        url=settings.influxdb_url,
        token=settings.influxdb_token,
        org=settings.influxdb_org,
    ) as client:
        write_api = client.write_api(write_options=SYNCHRONOUS)
        write_api.write(bucket=settings.influxdb_bucket, record=point)


async def write(metric: ProcessedMetric) -> None:
    point = (
        Point("health_metrics")
        .tag("device_id", metric.device_id)
        .field("heartrate", metric.heartrate)
        .field("spo2", metric.spo2)
        .field("heartrate_avg", metric.heartrate_avg)
        .field("spo2_avg", metric.spo2_avg)
        .field("alert_low_spo2", metric.alert_low_spo2)
        .field("alert_high_heartrate", metric.alert_high_heartrate)
        .time(_parse_timestamp(metric.timestamp))
    )

    await asyncio.to_thread(_write_sync, point)
    local_ts = datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S UTC+7")
    logger.info(
        "Written to InfluxDB: device=%s hr=%.1f spo2=%.1f at %s",
        metric.device_id, metric.heartrate, metric.spo2, local_ts,
    )
