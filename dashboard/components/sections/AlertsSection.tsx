'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { HealthAlert } from '@/hooks/useAlerts';

interface Props {
  alerts: HealthAlert[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

function AlertCard({ alert, onDismiss }: { alert: HealthAlert; onDismiss: () => void }) {
  const isHr = alert.type === 'high_hr';
  const accent = isHr ? '#ef4444' : '#fb923c';
  const bg     = isHr ? 'rgba(239,68,68,0.08)'    : 'rgba(251,146,60,0.08)';
  const border = isHr ? 'rgba(239,68,68,0.25)'    : 'rgba(251,146,60,0.25)';

  const timeStr = alert.timestamp.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour12: false,
  });
  const dateStr = alert.timestamp.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: 'short',
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl p-4"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}22` }}>
          {isHr ? (
            <svg className="w-4 h-4" style={{ color: accent }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" style={{ color: accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ color: accent }}>
              {isHr ? 'High Heart Rate' : 'Low Blood Oxygen'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: `${accent}22`, color: accent }}>
              {isHr ? 'HR Alert' : 'SpO₂ Alert'}
            </span>
          </div>

          {/* anomaly data */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-2">
            <div>
              <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>Heart Rate </span>
              <span className="text-xs font-bold tabular-nums" style={{ color: isHr ? accent : 'var(--fg)' }}>
                {alert.heartrate.toFixed(0)} BPM
              </span>
            </div>
            <div>
              <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>SpO₂ </span>
              <span className="text-xs font-bold tabular-nums" style={{ color: !isHr ? accent : 'var(--fg)' }}>
                {alert.spO2.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>Threshold </span>
              <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--fg-2)' }}>
                {isHr ? '> 120 BPM' : '< 92%'}
              </span>
            </div>
            <div>
              <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>Device </span>
              <span className="text-xs font-mono" style={{ color: 'var(--fg-2)' }}>
                {alert.deviceId}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--fg-3)' }}>
              {dateStr} · {timeStr}
            </span>
            <button onClick={onDismiss}
              className="text-[10px] px-2 py-0.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: 'var(--fg-3)', border: '1px solid var(--border)' }}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AlertsSection({ alerts, onDismiss, onClearAll }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--fg)' }}>Alert History</h2>
          <p className="text-xs" style={{ color: 'var(--fg-3)' }}>This session · {alerts.length} event{alerts.length !== 1 ? 's' : ''}</p>
        </div>
        {alerts.length > 0 && (
          <button onClick={onClearAll}
            className="text-xs px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--fg-3)' }}>
            Clear all
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <svg className="w-7 h-7" style={{ color: 'var(--ok-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--fg-2)' }}>All clear</p>
          <p className="text-xs text-center" style={{ color: 'var(--fg-3)' }}>
            No anomalies detected this session.<br />Alerts appear here when thresholds are crossed.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} onDismiss={() => onDismiss(a.id)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
