import { cn } from '../../utils/cn.js';

export function Toggle({ checked, onChange, label, description, disabled, id, className }) {
  const inputId = id || `t-${label?.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label htmlFor={inputId} className={cn('flex cursor-pointer items-center justify-between gap-4', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="min-w-0">
        {label && <span className="block font-medium text-ink dark:text-slate-100">{label}</span>}
        {description && <span className="muted block text-sm">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={inputId} type="checkbox" role="switch" className="peer sr-only" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-slate-300 transition peer-checked:bg-teal peer-focus-visible:ring-2 peer-focus-visible:ring-teal peer-focus-visible:ring-offset-2 dark:bg-slate-600" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
