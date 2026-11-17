import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatHours } from '../../utils/time.js';

/** Hours slept for the last 7 nights; on-target nights in teal. */
export function SleepChart({ data = [], dark }) {
  const tick = dark ? '#94A3B8' : '#5B6B7A';
  return (
    <div className="h-44 w-full" role="img" aria-label={`Sleep this week: ${data.map((d) => `${d.day} ${d.hours == null ? 'not logged' : formatHours(d.hours)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -22 }}>
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: tick, fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: tick, fontSize: 12 }} domain={[0, 10]} tickFormatter={(v) => `${v}h`} width={40} />
          <Tooltip cursor={{ fill: 'rgba(42,157,143,0.08)' }} formatter={(v) => [formatHours(v), 'Slept']} contentStyle={{ borderRadius: 12, border: 'none', background: dark ? '#1E293B' : '#fff', color: dark ? '#fff' : '#1B2B3A' }} />
          <Bar dataKey="hours" radius={[8, 8, 8, 8]} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.date} fill={d.onTarget ? '#2A9D8F' : '#4F8EF7'} fillOpacity={d.hours == null ? 0.2 : 1} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
