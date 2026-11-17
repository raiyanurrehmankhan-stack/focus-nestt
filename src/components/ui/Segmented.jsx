import { cn } from '../../utils/cn.js';

export function Segmented({ options, value, onChange, className, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800', className)}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const active = v === value;
        return (
          <button key={v} type="button" role="radio" aria-checked={active} onClick={() => onChange(v)}
            className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold transition', active ? 'bg-white text-teal-700 shadow dark:bg-slate-700 dark:text-white' : 'text-ink-soft hover:text-ink dark:text-slate-400')}>
            {l}
          </button>
        );
      })}
    </div>
  );
}
