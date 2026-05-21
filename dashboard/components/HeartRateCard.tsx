'use client';

import { motion } from 'framer-motion';
import type { DeviceData, HealthStatus } from '@/hooks/useMetricsStream';
import MetricChart from './MetricChart';

const statusConfig: Record<HealthStatus, { label: string; bg: string; text: string }> = {
  normal:   { label: 'Normal',   bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
  elevated: { label: 'Elevated', bg: 'rgba(244,63,94,0.15)',   text: '#f43f5e' },
  low:      { label: 'Low',      bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b' },
};

interface Props {
  device: DeviceData;
}

export default function HeartRateCard({ device }: Props) {
  const { points, latest, alertHighHr, status } = device;
  const bpm = latest ? Math.round(latest.heartrate) : null;
  const cfg = statusConfig[status];
  const chartColor = alertHighHr ? '#ef4444' : '#f43f5e';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl p-5 mb-4 overflow-hidden relative"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        boxShadow: alertHighHr
          ? '0 0 40px rgba(239,68,68,0.12), 0 8px 32px rgba(0,0,0,0.12)'
          : '0 0 40px var(--hr-glow), 0 8px 32px rgba(0,0,0,0.08)',
      }}
    >
      {/* background accent */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'var(--hr-color)' }}
      />

      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--hr-glow)' }}
          >
            <svg className="w-4 h-4 animate-heartbeat" style={{ color: 'var(--hr-color)' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--fg-2)' }}>Heart Rate</span>
        </div>
        <motion.span
          animate={{ scale: alertHighHr ? [1, 1.08, 1] : 1 }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: cfg.bg, color: cfg.text }}
        >
          {cfg.label}
        </motion.span>
      </div>

      {/* BPM display */}
      <div className="flex items-end gap-3 mb-5">
        <div className="relative">
          {/* pulse rings */}
          {[1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full animate-ping-slow pointer-events-none"
              style={{
                background: 'transparent',
                border: `1px solid var(--hr-color)`,
                animationDelay: `${i * 0.6}s`,
                opacity: 0.4 / i,
              }}
            />
          ))}
          <motion.div
            key={bpm}
            initial={{ scale: 0.95, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <span
              className="text-7xl font-bold tabular-nums leading-none"
              style={{ color: alertHighHr ? '#ef4444' : 'var(--fg)' }}
            >
              {bpm ?? '—'}
            </span>
          </motion.div>
        </div>
        <div className="pb-2">
          <p className="text-2xl font-light" style={{ color: 'var(--fg-2)' }}>BPM</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-3)' }}>beats / min</p>
        </div>
      </div>

      {/* ECG chart */}
      <div>
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--fg-3)' }}>
          Live Waveform
        </p>
        <MetricChart
          data={points}
          metric="heartrate"
          color={chartColor}
          unit="BPM"
          domain={[40, 160]}
          alertLine={120}
          height={100}
        />
      </div>
    </motion.div>
  );
}
