'use client';

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { MetricPoint } from '@/hooks/useMetricsStream';

interface Props {
  data: MetricPoint[];
  metric: 'heartrate' | 'spO2';
  color: string;
  unit: string;
  domain: [number, number];
  alertLine?: number;
  height?: number;
  hideAxes?: boolean;
}

export default function MetricChart({
  data, metric, color, unit, domain, alertLine, height = 90, hideAxes = false,
}: Props) {
  const gradId = `grad-${metric}-${color.replace('#', '')}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: hideAxes ? -32 : -20 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        {!hideAxes && (
          <>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 8, fill: 'var(--fg-3)' }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 8, fill: 'var(--fg-3)' }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 11,
            padding: '6px 10px',
            backdropFilter: 'blur(12px)',
          }}
          labelStyle={{ color: 'var(--fg-3)', marginBottom: 2 }}
          itemStyle={{ color }}
          formatter={(v) => [
            `${Number(v).toFixed(1)} ${unit}`,
            metric === 'heartrate' ? 'HR' : 'SpO₂',
          ]}
          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
        />
        {alertLine !== undefined && (
          <ReferenceLine y={alertLine} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.5} />
        )}
        <Area
          type="monotone"
          dataKey={metric}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
