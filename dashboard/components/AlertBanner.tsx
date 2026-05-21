'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { DeviceData } from '@/hooks/useMetricsStream';

interface Props {
  device: DeviceData;
}

export default function AlertBanner({ device }: Props) {
  const { alertHighHr, alertLowSpo2, latest } = device;
  const hasAlert = alertHighHr || alertLowSpo2;

  return (
    <AnimatePresence>
      {hasAlert && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className="overflow-hidden"
        >
          <div
            className="rounded-3xl p-4"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.2)' }}
              >
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </motion.div>
              <div>
                <p className="text-sm font-semibold text-red-400">Health Alert</p>
                <p className="text-xs" style={{ color: 'var(--fg-3)' }}>Immediate attention may be required</p>
              </div>
            </div>
            <div className="space-y-1.5 pl-11">
              {alertHighHr && latest && (
                <p className="text-xs text-red-300">
                  ↑ High heart rate: <strong>{Math.round(latest.heartrate)} BPM</strong> (threshold: 120 BPM)
                </p>
              )}
              {alertLowSpo2 && latest && (
                <p className="text-xs" style={{ color: '#fb923c' }}>
                  ↓ Low SpO₂: <strong>{latest.spO2.toFixed(1)}%</strong> (threshold: 92%)
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
