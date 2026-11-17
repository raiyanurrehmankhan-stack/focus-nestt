/** Dual ring used for screen time, timers and the wind-down countdown. */
export function ProgressRing({ value = 0, inner = null, size = 220, stroke = 16, color = '#2A9D8F', innerColor = '#4F8EF7', track = 'currentColor', children, label, className = '' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const r2 = r - stroke - 4;
  const c2 = 2 * Math.PI * r2;
  const clamp = (v) => Math.max(0, Math.min(1, v || 0));
  return (
    <div className={`relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 text-slate-200 dark:text-slate-700">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} opacity="0.6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamp(value))} style={{ transition: 'stroke-dashoffset .6s ease' }} />
        {inner != null && (
          <>
            <circle cx={size / 2} cy={size / 2} r={r2} fill="none" stroke={track} strokeWidth={stroke * 0.7} opacity="0.35" />
            <circle cx={size / 2} cy={size / 2} r={r2} fill="none" stroke={innerColor} strokeWidth={stroke * 0.7} strokeLinecap="round"
              strokeDasharray={c2} strokeDashoffset={c2 * (1 - clamp(inner))} style={{ transition: 'stroke-dashoffset .6s ease' }} />
          </>
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
