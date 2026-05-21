'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { DeviceData } from '@/hooks/useMetricsStream';
import MetricChart from '@/components/MetricChart';

interface Props { device: DeviceData | null }

const HR_ZONES = [
  { label: 'Resting',  min: 0,   max: 60,  color: '#06b6d4' },
  { label: 'Normal',   min: 60,  max: 100, color: '#10b981' },
  { label: 'Moderate', min: 100, max: 120, color: '#f59e0b' },
  { label: 'High',     min: 120, max: Infinity, color: '#ef4444' },
];

function healthScore(avgHr: number, avgSpo2: number): number {
  const hrScore = avgHr >= 60 && avgHr <= 100
    ? 100
    : avgHr < 60
      ? Math.max(0, 70 + avgHr - 60)
      : Math.max(0, 100 - (avgHr - 100) * 2);
  const spo2Score = avgSpo2 >= 97 ? 100
    : avgSpo2 >= 95 ? 85
    : avgSpo2 >= 92 ? 60
    : Math.max(0, avgSpo2 - 70);
  return Math.round(hrScore * 0.5 + spo2Score * 0.5);
}

function scoreLabel(s: number) {
  if (s >= 85) return { label: 'Excellent', color: '#10b981' };
  if (s >= 70) return { label: 'Good',      color: '#06b6d4' };
  if (s >= 50) return { label: 'Fair',      color: '#f59e0b' };
  return            { label: 'Low',         color: '#ef4444' };
}

function StatRow({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: color ?? 'var(--fg)' }}>
        {value} <span className="text-xs font-normal" style={{ color: 'var(--fg-3)' }}>{unit}</span>
      </span>
    </div>
  );
}

export default function TrendsSection({ device }: Props) {
  const stats = useMemo(() => {
    if (!device || !device.points.length) return null;
    const { points } = device;
    const hrs  = points.map((p) => p.heartrate);
    const spo2s = points.map((p) => p.spO2);
    const avgHr   = hrs.reduce((s, v) => s + v, 0) / hrs.length;
    const avgSpo2 = spo2s.reduce((s, v) => s + v, 0) / spo2s.length;
    const stdHr   = Math.sqrt(hrs.reduce((s, v) => s + (v - avgHr) ** 2, 0) / hrs.length);
    const zones   = HR_ZONES.map((z) => ({
      name: z.label,
      value: hrs.filter((h) => h >= z.min && h < z.max).length,
      color: z.color,
    })).filter((z) => z.value > 0);
    return {
      avgHr, avgSpo2, stdHr,
      minHr:  Math.min(...hrs),  maxHr:  Math.max(...hrs),
      minSpo2: Math.min(...spo2s), maxSpo2: Math.max(...spo2s),
      zones,
      score: healthScore(avgHr, avgSpo2),
      count: points.length,
    };
  }, [device]);

  if (!device || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-sm" style={{ color: 'var(--fg-3)' }}>No data yet — connect a device first.</p>
      </div>
    );
  }

  const { label: sLabel, color: sColor } = scoreLabel(stats.score);

  return (
    <div className="space-y-4">
      {/* health score */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--fg-3)' }}>Session Health Score</p>
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="7" />
              <motion.circle cx="40" cy="40" r="34" fill="none" stroke={sColor} strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34}
                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - stats.score / 100) }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold tabular-nums" style={{ color: sColor }}>{stats.score}</span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: sColor }}>{sLabel}</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--fg-3)' }}>
              Based on {stats.count} readings this session.
              {stats.score >= 85 ? ' Your vitals look great!' : ' Consider resting if you feel unwell.'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* HR zone distribution */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-3xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--fg-3)' }}>Heart Rate Zone Distribution</p>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={130} height={130}>
            <PieChart>
              <Pie data={stats.zones} dataKey="value" cx="50%" cy="50%"
                innerRadius={38} outerRadius={60} paddingAngle={2} isAnimationActive>
                {stats.zones.map((z, i) => <Cell key={i} fill={z.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }}
                formatter={(v) => [`${v} readings`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {HR_ZONES.map((z) => {
              const count = stats.zones.find((x) => x.name === z.label)?.value ?? 0;
              const pct = stats.count ? Math.round((count / stats.count) * 100) : 0;
              return (
                <div key={z.label} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.color }} />
                  <span className="text-xs flex-1" style={{ color: 'var(--fg-2)' }}>{z.label}</span>
                  <span className="text-xs tabular-nums font-medium" style={{ color: z.color }}>{pct}%</span>
                </div>
              );
            })}
            <p className="text-[10px] pt-1" style={{ color: 'var(--fg-3)' }}>60–100 BPM is normal range</p>
          </div>
        </div>
      </motion.div>

      {/* session statistics */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-3xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>Session Statistics</p>
        <StatRow label="Avg Heart Rate"    value={stats.avgHr.toFixed(0)}  unit="BPM" color="var(--hr-color)" />
        <StatRow label="HR Range"          value={`${stats.minHr.toFixed(0)}–${stats.maxHr.toFixed(0)}`} unit="BPM" />
        <StatRow label="HR Variability"    value={stats.stdHr.toFixed(1)}  unit="σ BPM"
          color={stats.stdHr < 8 ? 'var(--ok-color)' : 'var(--warn-color)'} />
        <StatRow label="Avg SpO₂"          value={stats.avgSpo2.toFixed(1)} unit="%" color="var(--spo2-color)" />
        <StatRow label="SpO₂ Range"        value={`${stats.minSpo2.toFixed(1)}–${stats.maxSpo2.toFixed(1)}`} unit="%" />
        <div className="pt-1">
          <StatRow label="Total Readings"  value={String(stats.count)} unit="pts" />
        </div>
      </motion.div>

      {/* full trend charts */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-3xl p-5 space-y-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Full Session Waveforms</p>
        <div>
          <p className="text-[10px] mb-1.5" style={{ color: 'var(--fg-3)' }}>Heart Rate (BPM)</p>
          <MetricChart data={device.points} metric="heartrate" color="var(--hr-color)"
            unit="BPM" domain={[40, 160]} alertLine={120} height={100} />
        </div>
        <div>
          <p className="text-[10px] mb-1.5" style={{ color: 'var(--fg-3)' }}>Blood Oxygen (%)</p>
          <MetricChart data={device.points} metric="spO2" color="var(--spo2-color)"
            unit="%" domain={[85, 100]} alertLine={92} height={100} />
        </div>
      </motion.div>
    </div>
  );
}
