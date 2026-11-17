import { useCountdown } from '../../hooks/useCountdown.js';
import { formatCountdown } from '../../utils/time.js';
import { ProgressRing } from '../ui/ProgressRing.jsx';

/** Large circular countdown (doc 5.4, screen 3). */
export function TimerCircle({ timer, idleMinutes = 25, size = 300, onZero }) {
  const { remaining, progress } = useCountdown(timer, { onZero });
  const isBreak = timer?.kind === 'break';
  const display = timer ? formatCountdown(remaining) : formatCountdown(idleMinutes * 60000);
  const label = !timer ? 'Ready' : timer.status === 'paused' ? 'Paused' : isBreak ? (timer.status === 'ended' ? 'Break over' : 'Break time') : 'Focusing';
  return (
    <ProgressRing value={timer ? 1 - progress : 1} size={size} stroke={size / 16} color={isBreak ? '#4F8EF7' : '#2A9D8F'} label={`${label}: ${display} remaining`}>
      <div>
        <div className="font-display font-bold tabular-nums tracking-tight text-ink dark:text-white" style={{ fontSize: size / 4.6 }} aria-live="off">{display}</div>
        <div className={`mt-1 text-sm font-semibold uppercase tracking-[0.18em] ${isBreak ? 'text-sky' : 'text-teal'}`}>{label}</div>
      </div>
    </ProgressRing>
  );
}
