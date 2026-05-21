'use client';

import { useEffect, useRef, useState } from 'react';
import type { DeviceData } from './useMetricsStream';

export type AlertType = 'high_hr' | 'low_spo2';

export interface HealthAlert {
  id: string;
  timestamp: Date;
  deviceId: string;
  type: AlertType;
  value: number;
  threshold: number;
  heartrate: number;
  spO2: number;
  status: string;
}

export function useAlerts(devices: Record<string, DeviceData>) {
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  // track previous alert state per device to fire only on rising edge
  const prevRef = useRef<Record<string, { highHr: boolean; lowSpo2: boolean }>>({});

  useEffect(() => {
    Object.values(devices).forEach((device) => {
      if (!device.latest) return;
      const prev = prevRef.current[device.deviceId] ?? { highHr: false, lowSpo2: false };

      if (device.alertHighHr && !prev.highHr) {
        setAlerts((a) => [
          {
            id: `${device.deviceId}-hr-${Date.now()}`,
            timestamp: new Date(),
            deviceId: device.deviceId,
            type: 'high_hr',
            value: device.latest!.heartrate,
            threshold: 120,
            heartrate: device.latest!.heartrate,
            spO2: device.latest!.spO2,
            status: device.status,
          },
          ...a,
        ]);
      }

      if (device.alertLowSpo2 && !prev.lowSpo2) {
        setAlerts((a) => [
          {
            id: `${device.deviceId}-spo2-${Date.now()}`,
            timestamp: new Date(),
            deviceId: device.deviceId,
            type: 'low_spo2',
            value: device.latest!.spO2,
            threshold: 92,
            heartrate: device.latest!.heartrate,
            spO2: device.latest!.spO2,
            status: device.status,
          },
          ...a,
        ]);
      }

      prevRef.current[device.deviceId] = {
        highHr: device.alertHighHr,
        lowSpo2: device.alertLowSpo2,
      };
    });
  }, [devices]);

  const dismiss = (id: string) => setAlerts((a) => a.filter((x) => x.id !== id));
  const clearAll = () => setAlerts([]);

  return { alerts, dismiss, clearAll };
}
