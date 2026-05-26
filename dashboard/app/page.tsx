'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useMetricsStream } from '@/hooks/useMetricsStream';
import { useAlerts } from '@/hooks/useAlerts';
import { getDailyQuote } from '@/lib/quotes';

import ThemeToggle from '@/components/ThemeToggle';
import DeviceApprovalModal from '@/components/DeviceApprovalModal';
import ConnectionBar from '@/components/ConnectionBar';
import HeartRateCard from '@/components/HeartRateCard';
import SpO2Card from '@/components/SpO2Card';
import DailySummary from '@/components/DailySummary';
import HealthInsights from '@/components/HealthInsights';
import AlertBanner from '@/components/AlertBanner';
import BottomNav, { type TabId } from '@/components/BottomNav';

import TrendsSection from '@/components/sections/TrendsSection';
import AlertsSection from '@/components/sections/AlertsSection';
import ChatSection from '@/components/sections/ChatSection';
import ProfileSection from '@/components/sections/ProfileSection';
import DevicesSection from '@/components/sections/DevicesSection';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8082/ws';

function EmptyState({ wsConnected }: { wsConnected: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-24 gap-4">
      <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <svg className="w-10 h-10" style={{ color: 'var(--fg-3)' }} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </motion.div>
      <div className="text-center">
        <p className="font-semibold" style={{ color: 'var(--fg-2)' }}>
          {wsConnected ? 'Waiting for sensor data…' : 'Connecting to gateway…'}
        </p>
        <p className="text-sm mt-1.5" style={{ color: 'var(--fg-3)' }}>
          {wsConnected
            ? <>Run <code className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                python3 simulate.py
              </code> to stream data</>
            : 'Ensure the WebSocket gateway is running'}
        </p>
      </div>
    </motion.div>
  );
}

function HomeSection({ device, wsConnected }: { device: ReturnType<typeof useMetricsStream>['devices'][string] | null; wsConnected: boolean }) {
  const quote = getDailyQuote();

  return (
    <>
      {/* daily quote */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl px-4 py-3 mb-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>Daily Quote</p>
        <p className="text-xs italic leading-relaxed" style={{ color: 'var(--fg-2)' }}>
          &ldquo;{quote.text}&rdquo;
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--fg-3)' }}>— {quote.author}</p>
      </motion.div>

      {device ? (
        <>
          <ConnectionBar device={device} />
          <AlertBanner device={device} />
          <HeartRateCard device={device} />
          <SpO2Card device={device} />
          <DailySummary device={device} />
          <HealthInsights device={device} />

          {/* placeholders */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="grid grid-cols-3 gap-3 mb-4">
            {[
              { icon: '😴', label: 'Sleep' },
              { icon: '🧘', label: 'Stress' },
              { icon: '🏃', label: 'Activity' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl p-3 text-center"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.55 }}>
                <p className="text-2xl mb-1">{item.icon}</p>
                <p className="text-xs font-medium" style={{ color: 'var(--fg-2)' }}>{item.label}</p>
                <p className="text-[9px]" style={{ color: 'var(--fg-3)' }}>Coming soon</p>
              </div>
            ))}
          </motion.div>
        </>
      ) : (
        <EmptyState wsConnected={wsConnected} />
      )}
    </>
  );
}

const SECTION_TITLES: Record<TabId, string> = {
  home:    'Health Monitor',
  trends:  'Trends',
  alerts:  'Alerts',
  chat:    'Chat',
  devices: 'Devices',
  profile: 'Profile',
};

export default function HomePage() {
  const { devices, connected, pendingApprovals, dismissApproval, removeDevice } = useMetricsStream(WS_URL);
  const { alerts, dismiss, clearAll } = useAlerts(devices);
  const [tab, setTab] = useState<TabId>('home');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const deviceIds = Object.keys(devices);

  // Auto-select first device that appears; don't auto-switch on new arrivals.
  const effectiveId = selectedDeviceId && devices[selectedDeviceId]
    ? selectedDeviceId
    : (deviceIds[0] ?? null);

  const device = effectiveId ? devices[effectiveId] ?? null : null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  function handleRemoveDevice(id: string) {
    removeDevice(id);
    if (selectedDeviceId === id) setSelectedDeviceId(null);
  }

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-md mx-auto px-4 pt-6">

        {/* header */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6">
          <div>
            {tab === 'home' && (
              <p className="text-xs font-medium" style={{ color: 'var(--fg-3)' }}>{greeting}</p>
            )}
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--fg)' }}>
              {SECTION_TITLES[tab]}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* show active device chip on non-devices tabs when a device is selected */}
            {tab !== 'devices' && device && (
              <button
                onClick={() => setTab('devices')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-opacity active:opacity-70"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--fg-3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="truncate max-w-[100px]">{device.deviceId}</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              <span style={{ color: 'var(--fg-3)' }}>{connected ? 'Live' : 'Offline'}</span>
            </div>
            <ThemeToggle />
          </div>
        </motion.header>

        {/* sections */}
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}>
            {tab === 'home'    && <HomeSection device={device} wsConnected={connected} />}
            {tab === 'trends'  && <TrendsSection device={device} />}
            {tab === 'alerts'  && <AlertsSection alerts={alerts} onDismiss={dismiss} onClearAll={clearAll} />}
            {tab === 'chat'    && <ChatSection device={device} />}
            {tab === 'devices' && (
              <DevicesSection
                devices={devices}
                pendingApprovals={pendingApprovals}
                selectedDeviceId={effectiveId}
                onSelect={setSelectedDeviceId}
                onRemove={handleRemoveDevice}
                onDismissApproval={dismissApproval}
              />
            )}
            {tab === 'profile' && <ProfileSection device={device} alerts={alerts} />}
          </motion.div>
        </AnimatePresence>

      </div>

      <BottomNav
        active={tab}
        onChange={setTab}
        alertCount={alerts.length}
        pendingCount={pendingApprovals.length}
      />
      <DeviceApprovalModal pendingDevices={pendingApprovals} onDismiss={dismissApproval} />
    </div>
  );
}
