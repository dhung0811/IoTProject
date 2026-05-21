'use client';

import { motion } from 'framer-motion';
import type { DeviceData } from '@/hooks/useMetricsStream';
import MetricChart from './MetricChart';

interface Props {
  device: DeviceData;
}

function StatChip({
  label, value, unit, color,
}: { label: string; value: string; unit: string; color: string }) {
  return (
    <div
      className="flex-1 rounded-2xl p-3 text-center"
      style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}
    >
      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--fg-3)' }}>{label}</p>
      <p className="text-xl font-bold tabular-nums leading-none" style={{ color }}>{value}</p>
      <p className="text-[9px] mt-0.5" style={{ color: 'var(--fg-3)' }}>{unit}</p>
    </div>
  );
}

export default function DailySummary({ device }: Props) {
  const { points, alertHighHr, alertLowSpo2 } = device;

  const avgHr = points.length
    ? (points.reduce((s, p) => s + p.heartrate, 0) / points.length).toFixed(0)
    : '—';
  const avgSpo2 = points.length
    ? (points.reduce((s, p) => s + p.spO2, 0) / points.length).toFixed(1)
    : '—';
  const minHr = points.length ? Math.min(...points.map((p) => p.heartrate)).toFixed(0) : '—';
  const maxHr = points.length ? Math.max(...points.map((p) => p.heartrate)).toFixed(0) : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="rounded-3xl p-5 mb-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4" style={{ color: 'var(--fg-2)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: 'var(--fg-2)' }}>Session Summary</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: 'var(--bg-card-2)', color: 'var(--fg-3)', border: '1px solid var(--border)' }}>
          {points.length} readings
        </span>
      </div>

      <div className="flex gap-2 mb-4">
        <StatChip label="Avg HR" value={avgHr} unit="BPM" color="var(--hr-color)" />
        <StatChip label="Avg SpO₂" value={avgSpo2} unit="%" color="var(--spo2-color)" />
        <StatChip label="HR Range" value={`${minHr}–${maxHr}`} unit="BPM" color="var(--fg-2)" />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--fg-3)' }}>
            Heart Rate Trend
          </p>
          <MetricChart
            data={points}
            metric="heartrate"
            color={alertHighHr ? '#ef4444' : 'var(--hr-color)'}
            unit="BPM"
            domain={[40, 160]}
            alertLine={120}
            height={75}
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--fg-3)' }}>
            SpO₂ Trend
          </p>
          <MetricChart
            data={points}
            metric="spO2"
            color={alertLowSpo2 ? '#fb923c' : 'var(--spo2-color)'}
            unit="%"
            domain={[85, 100]}
            alertLine={92}
            height={75}
          />
        </div>
      </div>
    </motion.div>
  );
}
