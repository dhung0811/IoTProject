'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_POINTS = 60;

export type HealthStatus = 'normal' | 'elevated' | 'low';

export interface MetricPoint {
  time: string;
  heartrate: number;
  spO2: number;
}

export interface DeviceData {
  deviceId: string;
  points: MetricPoint[];
  latest: MetricPoint | null;
  alertHighHr: boolean;
  alertLowSpo2: boolean;
  status: HealthStatus;
  connected: boolean;
  lastUpdated: Date | null;
}

type DeviceMap = Record<string, DeviceData>;

function deriveStatus(heartrate: number, spO2: number, backendStatus?: string): HealthStatus {
  if (backendStatus === 'elevated' || backendStatus === 'low') return backendStatus;
  if (heartrate > 120 || spO2 < 92) return backendStatus === 'low' ? 'low' : 'elevated';
  return 'normal';
}

export function useMetricsStream(url: string) {
  const [devices, setDevices] = useState<DeviceMap>({});
  const [connected, setConnected] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onclose = () => {
        setConnected(false);
        if (!destroyed) timerRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;

          if (msg.type === 'device_approval_request') {
            const deviceId = msg.device_id as string;
            setPendingApprovals((prev) =>
              prev.includes(deviceId) ? prev : [...prev, deviceId]
            );
            return;
          }

          const { device_id, timestamp, heartrate, spO2, status, connected: devConnected } = msg as {
            device_id: string;
            timestamp: string;
            heartrate: number;
            spO2: number;
            status?: string;
            connected?: boolean;
          };

          const time = new Date(timestamp as string).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
          });

          const point: MetricPoint = { time, heartrate, spO2 };

          setDevices((prev) => {
            const existing = prev[device_id];
            const points = existing
              ? [...existing.points.slice(-(MAX_POINTS - 1)), point]
              : [point];

            return {
              ...prev,
              [device_id]: {
                deviceId: device_id,
                points,
                latest: point,
                alertHighHr: heartrate > 120,
                alertLowSpo2: spO2 < 92,
                status: deriveStatus(heartrate, spO2, status),
                connected: devConnected ?? true,
                lastUpdated: new Date(),
              },
            };
          });
        } catch {
          // ignore malformed messages
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [url]);

  function dismissApproval(deviceId: string) {
    setPendingApprovals((prev) => prev.filter((id) => id !== deviceId));
  }

  function removeDevice(deviceId: string) {
    setDevices((prev) => {
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
  }

  return { devices, connected, pendingApprovals, dismissApproval, removeDevice };
}
