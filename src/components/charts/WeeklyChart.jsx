import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatHours } from '../../utils/time.js';

/** Week of self-reported screen time (doc 5.4, screen 2). */
export function WeeklyChart({ data = [], goal, dark }) {
  const rows = data.map((d) => ({ ...d, hours: d.hours ?? null }));
  const grid = dark ? '#334155' : '#E5ECF2';
  const tick = dark ? '#94A3B8' : '#5B6B7A';
  return (
    <div className="h-56 w-full" role="img" aria-label={`Screen time this week: ${rows.map((r) => `${r.day} ${r.hours == null ? 'no check-in' : formatHours(r.hours)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="fnArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2A9D8F" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4F8EF7" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fnLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2A9D8F" />
              <stop offset="100%" stopColor="#4F8EF7" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: tick, fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: tick, fontSize: 12 }} tickFormatter={(v) => `${v}h`} allowDecimals={false} width={40} />
          {goal ? <ReferenceLine y={goal} stroke="#F5B942" strokeDasharray="5 5" label={{ value: 'Goal', position: 'insideTopRight', fill: '#C58B12', fontSize: 11 }} /> : null}
          <Tooltip formatter={(v) => [formatHours(v), 'Screen time']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px -12px rgba(0,0,0,.25)', background: dark ? '#1E293B' : '#fff', color: dark ? '#fff' : '#1B2B3A' }} />
          <Area type="monotone" dataKey="hours" stroke="url(#fnLine)" strokeWidth={3} fill="url(#fnArea)" connectNulls dot={{ r: 3, fill: '#2A9D8F' }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
