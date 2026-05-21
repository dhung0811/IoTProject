'use client';

import { motion } from 'framer-motion';
import type { DeviceData } from '@/hooks/useMetricsStream';
import type { HealthAlert } from '@/hooks/useAlerts';

interface Props {
  device: DeviceData | null;
  alerts: HealthAlert[];
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{value}</span>
    </div>
  );
}

export default function ProfileSection({ device, alerts }: Props) {
  const alertCount = alerts.length;
  const sessionReadings = device?.points.length ?? 0;
  const avgHr = device?.points.length
    ? (device.points.reduce((s, p) => s + p.heartrate, 0) / device.points.length).toFixed(0)
    : '—';
  const avgSpo2 = device?.points.length
    ? (device.points.reduce((s, p) => s + p.spO2, 0) / device.points.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-4">
      {/* avatar */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center py-6 rounded-3xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'var(--hr-glow)', border: '2px solid var(--border)' }}>
          <svg className="w-10 h-10" style={{ color: 'var(--fg-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <p className="font-semibold" style={{ color: 'var(--fg)' }}>Patient</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--fg-3)' }}>
          {device ? device.deviceId : 'No device connected'}
        </p>
      </motion.div>

      {/* session overview */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-3xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>This Session</p>
        <Row label="Readings collected"  value={String(sessionReadings)} />
        <Row label="Alerts triggered"    value={String(alertCount)} />
        <Row label="Avg Heart Rate"      value={`${avgHr} BPM`} />
        <Row label="Avg Blood Oxygen"    value={`${avgSpo2}%`} />
        <Row label="Device status"       value={device?.connected ? 'Connected' : 'Offline'} />
      </motion.div>

      {/* thresholds */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-3xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>Alert Thresholds</p>
        <Row label="High Heart Rate" value="> 120 BPM" />
        <Row label="Low SpO₂"        value="< 92%" />
        <div className="pt-2">
          <p className="text-[10px]" style={{ color: 'var(--fg-3)' }}>
            Thresholds are fixed per clinical guidelines. Custom thresholds coming soon.
          </p>
        </div>
      </motion.div>

      {/* about */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-3xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>About</p>
        <Row label="App" value="Health Monitor" />
        <Row label="Sensor" value="ESP32 + MAX30102" />
        <Row label="AI" value="Gemini 2.0 Flash" />
        <Row label="Stack" value="Next.js · FastAPI · InfluxDB" />
      </motion.div>
    </div>
  );
}
