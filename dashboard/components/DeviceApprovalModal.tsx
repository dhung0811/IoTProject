'use client';

import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Props {
  pendingDevices: string[];
  onDismiss: (deviceId: string) => void;
}

async function sendDecision(deviceId: string, approved: boolean) {
  await fetch(`${API_URL}/api/v1/devices/${deviceId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved }),
  });
}

export default function DeviceApprovalModal({ pendingDevices, onDismiss }: Props) {
  const device = pendingDevices[0] ?? null;

  async function handleDecision(approved: boolean) {
    if (!device) return;
    try {
      await sendDecision(device, approved);
    } catch {
      // best-effort; dismiss regardless
    }
    onDismiss(device);
  }

  return (
    <AnimatePresence>
      {device && (
        <>
          {/* backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          />

          {/* card */}
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="fixed inset-x-4 bottom-32 z-50 max-w-sm mx-auto rounded-3xl p-6 shadow-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {/* icon */}
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4"
              style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)' }}>
              <svg className="w-7 h-7 text-yellow-400" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2 className="text-center text-base font-bold mb-1" style={{ color: 'var(--fg)' }}>
              New Device Detected
            </h2>
            <p className="text-center text-sm mb-1" style={{ color: 'var(--fg-2)' }}>
              A device is requesting to stream health data.
            </p>
            <p className="text-center text-xs font-mono px-3 py-1.5 rounded-xl mb-5 mx-auto w-fit"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg-3)' }}>
              {device}
            </p>

            {pendingDevices.length > 1 && (
              <p className="text-center text-xs mb-4" style={{ color: 'var(--fg-3)' }}>
                +{pendingDevices.length - 1} more waiting
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleDecision(false)}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm transition-opacity active:opacity-70"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
              >
                Deny
              </button>
              <button
                onClick={() => handleDecision(true)}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm transition-opacity active:opacity-70"
                style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}
              >
                Accept
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
