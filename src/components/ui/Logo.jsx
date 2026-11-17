import { cn } from '../../utils/cn.js';

export function Logo({ size = 44, showText = true, className, vertical = false }) {
  return (
    <span className={cn('inline-flex items-center gap-2', vertical && 'flex-col gap-1', className)}>
      <img src="/brand/logo-icon-160.png" alt={showText ? '' : 'FocusNest'} width={size} height={size} style={{ width: size, height: size }} />
      {showText && (
        <span className="font-display text-lg font-bold leading-none tracking-tight">
          <span className="text-teal">Focus</span><span className="text-sky">Nest</span>
        </span>
      )}
    </span>
  );
}
