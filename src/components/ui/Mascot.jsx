import { cn } from '../../utils/cn.js';

/**
 * The FocusNest bird (supplied artwork, not redrawn) in the three story
 * states from doc 1.1: tangled, loosening and free. Thin, calm circles are
 * drawn around it only for the tangled and loosening states.
 */
export function Mascot({ state = 'free', size = 120, className, alt = '' }) {
  const rings = state === 'tangled'
    ? [[0.36, 0, 1], [0.4, 30, 0.9], [0.44, 60, 0.8], [0.38, 100, 0.85], [0.42, 140, 0.8]]
    : state === 'loosening'
      ? [[0.46, 10, 0.45], [0.5, 70, 0.35], [0.55, 130, 0.25]]
      : [];
  return (
    <div className={cn('relative inline-block', state === 'free' && 'animate-floatUp', className)} style={{ width: size, height: size }} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      <img src="/brand/logo-icon.png" alt="" width={size} height={size} className={cn('h-full w-full object-contain', state === 'free' && '-translate-y-1')} draggable="false" />
      {rings.length > 0 && (
        <svg viewBox="0 0 100 100" className={cn('pointer-events-none absolute inset-0 h-full w-full', state === 'loosening' && 'animate-spinSlow')} aria-hidden>
          {rings.map(([rx, rot, op], i) => (
            <ellipse key={i} cx="50" cy="52" rx={rx * 100} ry={rx * 100 * 0.78} fill="none" stroke={i % 2 ? '#4F8EF7' : '#2A9D8F'} strokeWidth="0.9" opacity={op}
              transform={`rotate(${rot} 50 52)`} strokeDasharray={state === 'loosening' ? '14 10' : undefined} />
          ))}
        </svg>
      )}
    </div>
  );
}
