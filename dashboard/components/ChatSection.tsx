'use client';

import { motion } from 'framer-motion';

const mockMessages = [
  { role: 'assistant', text: 'Hello! I\'m your AI health assistant. I can help you understand your vitals, explain trends, and answer health questions.' },
  { role: 'user', text: 'What does my heart rate mean?' },
  { role: 'assistant', text: 'Your heart rate shows how many times your heart beats per minute. A normal resting rate is 60–100 BPM. Athletes often have lower rates.' },
];

export default function ChatSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      className="rounded-3xl p-5 mb-4 relative overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* coming soon overlay */}
      <div
        className="absolute inset-0 rounded-3xl z-10 flex flex-col items-center justify-center gap-3"
        style={{ background: 'rgba(5,10,20,0.75)', backdropFilter: 'blur(4px)' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)' }}
        >
          <svg className="w-6 h-6" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-semibold" style={{ color: '#a78bfa' }}>AI Health Chat</p>
          <p className="text-xs mt-1" style={{ color: 'var(--fg-3)' }}>Coming soon — powered by Gemini</p>
        </div>
        <span
          className="text-[10px] px-3 py-1 rounded-full font-medium"
          style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}
        >
          In Development
        </span>
      </div>

      {/* mock UI behind overlay */}
      <div className="flex items-center gap-2 mb-4 opacity-40">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.15)' }}>
          <svg className="w-4 h-4" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--fg-2)' }}>Health Assistant</span>
      </div>

      <div className="space-y-2.5 mb-4 opacity-30">
        {mockMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[80%] rounded-2xl px-3 py-2 text-xs"
              style={{
                background: msg.role === 'user' ? 'rgba(167,139,250,0.2)' : 'var(--bg-card-2)',
                color: 'var(--fg-2)',
                border: '1px solid var(--border)',
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div
        className="flex gap-2 opacity-30"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="flex-1 rounded-2xl px-4 py-2.5 text-xs"
          style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--fg-3)' }}
        >
          Ask about your health…
        </div>
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(167,139,250,0.2)' }}
        >
          <svg className="w-4 h-4" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}
