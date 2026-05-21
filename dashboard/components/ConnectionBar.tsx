'use client';

import { motion } from 'framer-motion';
import type { DeviceData } from '@/hooks/useMetricsStream';

interface Props {
  device: DeviceData;
}

function SignalBars({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[3, 5, 7, 9].map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-sm transition-all duration-300"
          style={{
            height: h,
            background: connected && i < 3 ? 'var(--ok-color)' : connected ? 'var(--fg-3)' : 'var(--fg-3)',
            opacity: connected ? (i < 3 ? 1 : 0.3) : 0.2,
          }}
        />
      ))}
    </div>
  );
}

export default function ConnectionBar({ device }: Props) {
  const { deviceId, connected, lastUpdated } = device;
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-4 py-2.5 rounded-2xl mb-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: connected ? 'var(--ok-color)' : 'var(--warn-color)' }}
          />
          {connected && (
            <div
              className="absolute inset-0 rounded-full animate-ping-slow"
              style={{ background: 'var(--ok-color)' }}
            />
          )}
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--fg)' }}>
            {connected ? 'ESP32 Connected' : 'Device Offline'}
          </p>
          <p className="text-[10px] font-mono" style={{ color: 'var(--fg-3)' }}>{deviceId}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {connected && (
          <div className="relative overflow-hidden h-1 w-16 rounded-full" style={{ background: 'var(--border)' }}>
            <div
              className="absolute inset-y-0 w-8 rounded-full animate-scan"
              style={{ background: 'var(--spo2-color)' }}
            />
          </div>
        )}
        <SignalBars connected={connected} />
        <span className="text-[10px] tabular-nums font-mono" style={{ color: 'var(--fg-3)' }}>
          {timeStr}
        </span>
      </div>
    </motion.div>
  );
}
