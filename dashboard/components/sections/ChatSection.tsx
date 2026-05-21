'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DeviceData } from '@/hooks/useMetricsStream';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  device: DeviceData | null;
}

const STARTERS = [
  'What does my heart rate mean?',
  'Is my SpO₂ level normal?',
  'How can I lower my resting HR?',
  'When should I see a doctor?',
];

function TypingIndicator() {
  return (
    <div className="flex gap-1 px-4 py-3 rounded-2xl rounded-bl-sm w-fit"
      style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--fg-3)' }}
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
      ))}
    </div>
  );
}

export default function ChatSection({ device }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your health assistant. I can see your real-time vitals and help you understand what they mean. Ask me anything about your heart rate, SpO₂, or general wellness.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);

    const context = device
      ? {
          deviceId:    device.deviceId,
          heartrate:   device.latest?.heartrate,
          spO2:        device.latest?.spO2,
          status:      device.status,
          alertHighHr: device.alertHighHr,
          alertLowSpo2: device.alertLowSpo2,
          avgHr:  device.points.length
            ? device.points.reduce((s, p) => s + p.heartrate, 0) / device.points.length
            : undefined,
          avgSpO2: device.points.length
            ? device.points.reduce((s, p) => s + p.spO2, 0) / device.points.length
            : undefined,
          sessionReadings: device.points.length,
        }
      : {};

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${apiBase}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error');
      setMessages((m) => [...m, { role: 'assistant', content: data.text }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to get response.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)' }}>
          <svg className="w-4 h-4" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Health Assistant</p>
          <p className="text-[10px]" style={{ color: 'var(--fg-3)' }}>
            {device ? `Connected · ${device.deviceId}` : 'No device — general mode'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>Gemini</span>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2 pr-1">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-2xl rounded-br-sm'
                    : 'rounded-2xl rounded-bl-sm'
                }`}
                style={
                  msg.role === 'user'
                    ? { background: 'rgba(167,139,250,0.2)', color: 'var(--fg)', border: '1px solid rgba(167,139,250,0.3)' }
                    : { background: 'var(--bg-card)', color: 'var(--fg)', border: '1px solid var(--border)' }
                }
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <TypingIndicator />
          </motion.div>
        )}

        {error && (
          <p className="text-xs text-center py-2" style={{ color: 'var(--warn-color)' }}>{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* starters (only before user sends anything) */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mb-3 flex-shrink-0">
          {STARTERS.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="text-[11px] px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--fg-2)' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <div className="flex gap-2 flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder="Ask about your health…"
          disabled={loading}
          className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none transition-opacity disabled:opacity-50"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-30"
          style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)' }}
        >
          <svg className="w-4 h-4" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
