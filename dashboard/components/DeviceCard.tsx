'use client';

import type { DeviceData } from '@/hooks/useMetricsStream';
import MetricChart from './MetricChart';

function HeartIcon({ alert }: { alert: boolean }) {
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        alert ? 'bg-red-500/20' : 'bg-rose-500/15'
      }`}
      style={{ animation: 'heartbeat 1.2s ease-in-out infinite' }}
    >
      <svg
        className={`w-5 h-5 ${alert ? 'text-red-400' : 'text-rose-400'}`}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </div>
  );
}

function SpO2Ring({ value, alert }: { value: number | null; alert: boolean }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const normalized = value !== null ? Math.min(100, Math.max(0, value)) / 100 : 0;
  const offset = circ * (1 - normalized);
  const color = alert ? '#fb923c' : '#22d3ee';

  return (
    <div className="relative flex items-center justify-center w-[90px] h-[90px]">
      <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="45" cy="45" r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={`text-xl font-bold tabular-nums leading-none ${alert ? 'text-orange-400' : 'text-cyan-400'}`}>
          {value !== null ? value.toFixed(1) : '—'}
        </span>
        <span className="text-[9px] text-slate-500 mt-0.5">%</span>
      </div>
    </div>
  );
}

interface Props {
  device: DeviceData;
}

export default function DeviceCard({ device }: Props) {
  const { deviceId, points, latest, alertHighHr, alertLowSpo2 } = device;
  const hasAlert = alertHighHr || alertLowSpo2;

  return (
    <div className={`
      relative rounded-2xl p-5 flex flex-col gap-4
      bg-white/[0.04] backdrop-blur-sm
      border border-white/10
      transition-shadow duration-300
      ${hasAlert ? 'ring-1 ring-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.08)]' : ''}
    `}>
      {hasAlert && (
        <div className="absolute inset-0 rounded-2xl bg-red-500/[0.03] pointer-events-none" />
      )}

      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-xs font-mono text-slate-400 truncate">{deviceId}</span>
        </div>
        <div className="flex gap-1.5">
          {alertHighHr && (
            <span className="text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full">
              ↑ HR
            </span>
          )}
          {alertLowSpo2 && (
            <span className="text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25 px-2 py-0.5 rounded-full">
              ↓ O₂
            </span>
          )}
        </div>
      </div>

      {/* metrics row */}
      <div className="flex items-center gap-4">
        {/* heart rate */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <HeartIcon alert={alertHighHr} />
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Heart Rate</p>
              <p className={`text-[10px] font-medium mt-0.5 ${alertHighHr ? 'text-red-400' : 'text-emerald-400'}`}>
                {alertHighHr ? 'High Alert' : 'Normal'}
              </p>
            </div>
          </div>
          <div className="flex items-end gap-1.5">
            <span className={`text-5xl font-bold tabular-nums leading-none ${alertHighHr ? 'text-red-400' : 'text-rose-300'}`}>
              {latest ? Math.round(latest.heartrate) : '—'}
            </span>
            <span className="text-slate-500 text-sm pb-1">BPM</span>
          </div>
        </div>

        <div className="w-px h-16 bg-white/10 flex-shrink-0" />

        {/* spo2 */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Blood O₂</p>
          <SpO2Ring value={latest?.spO2 ?? null} alert={alertLowSpo2} />
          <p className={`text-[10px] font-medium ${alertLowSpo2 ? 'text-orange-400' : 'text-emerald-400'}`}>
            {alertLowSpo2 ? 'Low Alert' : 'Normal'}
          </p>
        </div>
      </div>

      {/* charts */}
      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Heart Rate (BPM)</p>
          <MetricChart
            data={points}
            metric="heartrate"
            color={alertHighHr ? '#f87171' : '#fb7185'}
            unit="BPM"
            domain={[40, 160]}
            alertLine={120}
          />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Blood Oxygen (%)</p>
          <MetricChart
            data={points}
            metric="spO2"
            color={alertLowSpo2 ? '#fb923c' : '#22d3ee'}
            unit="%"
            domain={[85, 100]}
            alertLine={92}
          />
        </div>
      </div>

      {latest && (
        <p className="text-[10px] text-slate-600 text-right tabular-nums">{latest.time} UTC+7</p>
      )}
    </div>
  );
}
