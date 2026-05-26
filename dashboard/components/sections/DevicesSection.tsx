'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { DeviceData } from '@/hooks/useMetricsStream';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

async function sendDecision(deviceId: string, approved: boolean) {
  await fetch(`${API_URL}/api/v1/devices/${deviceId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved }),
  });
}

interface Props {
  devices: Record<string, DeviceData>;
  pendingApprovals: string[];
  selectedDeviceId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDismissApproval: (id: string) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest font-semibold mb-2 px-1"
      style={{ color: 'var(--fg-3)' }}>
      {children}
    </p>
  );
}

function StatusDot({ color }: { color: string }) {
  return <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />;
}

export default function DevicesSection({
  devices,
  pendingApprovals,
  selectedDeviceId,
  onSelect,
  onRemove,
  onDismissApproval,
}: Props) {
  const connectedDevices = Object.values(devices).filter((d) => d.connected);
  const offlineDevices = Object.values(devices).filter((d) => !d.connected);

  async function handleApprove(id: string) {
    try { await sendDecision(id, true); } catch { /* best-effort */ }
    onDismissApproval(id);
  }

  async function handleDeny(id: string) {
    try { await sendDecision(id, false); } catch { /* best-effort */ }
    onDismissApproval(id);
  }

  const isEmpty = pendingApprovals.length === 0 && connectedDevices.length === 0 && offlineDevices.length === 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <svg className="w-8 h-8" style={{ color: 'var(--fg-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--fg-2)' }}>No devices yet</p>
          <p className="text-xs text-center" style={{ color: 'var(--fg-3)' }}>
            Devices will appear here once they request a connection
          </p>
        </div>
      )}

      {/* Pending */}
      <AnimatePresence>
        {pendingApprovals.length > 0 && (
          <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SectionLabel>Pending approval</SectionLabel>
            <div className="space-y-2">
              {pendingApprovals.map((id) => (
                <motion.div key={id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
                  <StatusDot color="#eab308" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium truncate" style={{ color: 'var(--fg)' }}>{id}</p>
                    <p className="text-[10px]" style={{ color: 'var(--fg-3)' }}>Awaiting decision</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDeny(id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity active:opacity-60"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                      Deny
                    </button>
                    <button
                      onClick={() => handleApprove(id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity active:opacity-60"
                      style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
                      Allow
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected */}
      {connectedDevices.length > 0 && (
        <div>
          <SectionLabel>Connected</SectionLabel>
          <div className="space-y-2">
            {connectedDevices.map((d) => {
              const isSelected = d.deviceId === selectedDeviceId;
              return (
                <motion.div key={d.deviceId} layout
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
                  style={{
                    background: isSelected ? 'rgba(52,211,153,0.08)' : 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'rgba(52,211,153,0.35)' : 'var(--border)'}`,
                  }}>
                  <StatusDot color="#34d399" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium truncate" style={{ color: 'var(--fg)' }}>{d.deviceId}</p>
                    <p className="text-[10px]" style={{ color: 'var(--fg-3)' }}>
                      {d.lastUpdated
                        ? `Last update ${d.lastUpdated.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })}`
                        : 'Streaming'}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!isSelected && (
                      <button
                        onClick={() => onSelect(d.deviceId)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity active:opacity-60"
                        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}>
                        View
                      </button>
                    )}
                    {isSelected && (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                        style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
                        Active
                      </span>
                    )}
                    <button
                      onClick={() => onRemove(d.deviceId)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity active:opacity-60"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                      Remove
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Offline */}
      {offlineDevices.length > 0 && (
        <div>
          <SectionLabel>Offline</SectionLabel>
          <div className="space-y-2">
            {offlineDevices.map((d) => (
              <motion.div key={d.deviceId} layout
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.65 }}>
                <StatusDot color="var(--fg-3)" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-medium truncate" style={{ color: 'var(--fg)' }}>{d.deviceId}</p>
                  <p className="text-[10px]" style={{ color: 'var(--fg-3)' }}>Disconnected</p>
                </div>
                <button
                  onClick={() => onRemove(d.deviceId)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0 transition-opacity active:opacity-60"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  Remove
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

    </motion.div>
  );
}
