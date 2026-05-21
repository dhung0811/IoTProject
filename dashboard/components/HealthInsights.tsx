'use client';

import { motion } from 'framer-motion';
import type { DeviceData, HealthStatus } from '@/hooks/useMetricsStream';

interface Insight {
  icon: string;
  text: string;
  type: 'good' | 'warning' | 'info';
}

function generateInsights(device: DeviceData): Insight[] {
  const { points, latest, status } = device;
  const insights: Insight[] = [];

  if (!latest || points.length < 5) {
    insights.push({ icon: '⏳', text: 'Collecting data — insights will appear after a few readings.', type: 'info' });
    return insights;
  }

  const recentHr = points.slice(-10).map((p) => p.heartrate);
  const hrStd = Math.sqrt(recentHr.reduce((s, v) => s + Math.pow(v - latest.heartrate, 2), 0) / recentHr.length);

  if (hrStd < 5 && status === 'normal') {
    insights.push({ icon: '✅', text: `Heart rate stable around ${Math.round(latest.heartrate)} BPM over the last ${points.slice(-10).length} readings.`, type: 'good' });
  } else if (hrStd > 15) {
    insights.push({ icon: '📈', text: 'Heart rate variability is high — you may be physically active or stressed.', type: 'warning' });
  }

  if (latest.spO2 >= 97) {
    insights.push({ icon: '🫁', text: `Blood oxygen at ${latest.spO2.toFixed(1)}% — excellent oxygenation.`, type: 'good' });
  } else if (latest.spO2 >= 95) {
    insights.push({ icon: '🫁', text: `Blood oxygen at ${latest.spO2.toFixed(1)}% — within normal range.`, type: 'good' });
  } else if (latest.spO2 < 92) {
    insights.push({ icon: '⚠️', text: `Blood oxygen at ${latest.spO2.toFixed(1)}% — below normal. Consider resting or seeking medical advice.`, type: 'warning' });
  }

  if (status === 'elevated') {
    insights.push({ icon: '🔴', text: 'Elevated heart rate detected. Try deep breathing or resting for a few minutes.', type: 'warning' });
  }

  if (points.length >= 30 && status === 'normal') {
    insights.push({ icon: '💚', text: 'Vitals have been in the healthy range for this session. Keep it up!', type: 'good' });
  }

  return insights.slice(0, 3);
}

const typeStyle: Record<'good' | 'warning' | 'info', { bg: string; border: string; text: string }> = {
  good:    { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  text: 'var(--ok-color)' },
  warning: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  text: 'var(--warn-color)' },
  info:    { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)', text: 'var(--fg-2)' },
};

export default function HealthInsights({ device }: Props) {
  const insights = generateInsights(device);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="rounded-3xl p-5 mb-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: 'var(--fg-2)' }}>AI Insights</span>
        <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
          Auto-generated
        </span>
      </div>

      <div className="space-y-2.5">
        {insights.map((ins, i) => {
          const s = typeStyle[ins.type];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="flex items-start gap-3 rounded-2xl p-3"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            >
              <span className="text-base leading-none mt-0.5 flex-shrink-0">{ins.icon}</span>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-2)' }}>{ins.text}</p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

interface Props { device: DeviceData; }
