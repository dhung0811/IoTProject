'use client';

import { motion } from 'framer-motion';
import type { DeviceData } from '@/hooks/useMetricsStream';
import MetricChart from './MetricChart';

interface Props {
  device: DeviceData;
}

function SpO2Ring({ value, alert }: { value: number | null; alert: boolean }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = value !== null ? Math.min(100, Math.max(0, value)) / 100 : 0;
  const offset = circ * (1 - pct);
  const color = alert ? '#fb923c' : 'var(--spo2-color)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 108, height: 108 }}>
      <svg width="108" height="108" viewBox="0 0 108 108" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <motion.circle
          cx="54" cy="54" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold tabular-nums leading-none"
          style={{ color: alert ? '#fb923c' : 'var(--spo2-color)' }}
        >
          {value !== null ? value.toFixed(1) : '—'}
        </span>
        <span className="text-[10px] mt-0.5" style={{ color: 'var(--fg-3)' }}>%</span>
      </div>
    </div>
  );
}

function HealthRange({ value, alert }: { value: number | null; alert: boolean }) {
  const pct = value ? Math.max(0, Math.min(100, ((value - 85) / 15) * 100)) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between mb-1">
        <span className="text-[9px]" style={{ color: 'var(--fg-3)' }}>85%</span>
        <span className="text-[9px]" style={{ color: 'var(--ok-color)' }}>Normal ≥ 95%</span>
        <span className="text-[9px]" style={{ color: 'var(--fg-3)' }}>100%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
          style={{ background: alert ? '#fb923c' : 'var(--spo2-color)' }}
        />
      </div>
    </div>
  );
}

export default function SpO2Card({ device }: Props) {
  const { points, latest, alertLowSpo2 } = device;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-3xl p-5 mb-4 relative overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 0 40px var(--spo2-glow), 0 8px 32px rgba(0,0,0,0.08)',
      }}
    >
      <div
        className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'var(--spo2-color)' }}
      />

      {/* header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--spo2-glow)' }}
        >
          <svg className="w-4 h-4" style={{ color: 'var(--spo2-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--fg-2)' }}>Blood Oxygen</span>
        {alertLowSpo2 && (
          <span className="ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
            Low
          </span>
        )}
      </div>

      {/* ring + mini chart */}
      <div className="flex items-center gap-4">
        <SpO2Ring value={latest?.spO2 ?? null} alert={alertLowSpo2} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--fg-3)' }}>
            Trend
          </p>
          <MetricChart
            data={points}
            metric="spO2"
            color={alertLowSpo2 ? '#fb923c' : 'var(--spo2-color)'}
            unit="%"
            domain={[85, 100]}
            alertLine={92}
            height={80}
            hideAxes
          />
        </div>
      </div>

      <HealthRange value={latest?.spO2 ?? null} alert={alertLowSpo2} />
    </motion.div>
  );
}
