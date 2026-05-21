'use client';

import { motion } from 'framer-motion';

export type TabId = 'home' | 'trends' | 'alerts' | 'chat' | 'profile';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'home', label: 'Home',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'trends', label: 'Trends',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    id: 'alerts', label: 'Alerts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: 'chat', label: 'Chat',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    id: 'profile', label: 'Profile',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  alertCount?: number;
}

export default function BottomNav({ active, onChange, alertCount = 0 }: Props) {
  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
        className="flex items-center gap-1 px-3 py-2 rounded-[28px] pointer-events-auto"
        style={{
          background: 'var(--nav-bg)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-[20px] transition-colors duration-200"
              style={{ color: isActive ? 'var(--hr-color)' : 'var(--fg-3)' }}
            >
              {isActive && (
                <motion.div layoutId="nav-pill" className="absolute inset-0 rounded-[20px]"
                  style={{ background: 'var(--hr-glow)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
              )}
              <span className="relative">
                {tab.icon}
                {tab.id === 'alerts' && alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ background: '#ef4444', color: '#fff' }}>
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </span>
              <span className="relative text-[9px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </motion.nav>
    </div>
  );
}
