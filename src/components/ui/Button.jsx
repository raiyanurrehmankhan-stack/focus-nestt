import { LoaderCircle } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '../../utils/cn.js';

const variants = {
  primary: 'bg-teal text-white shadow-[0_10px_24px_-12px_rgba(42,157,143,0.8)] hover:bg-teal-600 active:bg-teal-700',
  secondary: 'bg-sky text-white shadow-[0_10px_24px_-12px_rgba(79,142,247,0.8)] hover:bg-sky-600',
  outline: 'border-2 border-teal/70 text-teal-700 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-900/30',
  'outline-blue': 'border-2 border-sky/80 text-sky-600 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-900/20',
  ghost: 'text-ink-soft hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  soft: 'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/40 dark:text-teal-100 dark:hover:bg-teal-900/60',
  danger: 'bg-danger text-white hover:bg-red-500',
  'danger-outline': 'border-2 border-danger/60 text-danger hover:bg-red-50 dark:hover:bg-red-900/20',
  white: 'bg-white text-teal-700 hover:bg-teal-50',
  // for dark overlays and dark cards
  'outline-light': 'border-2 border-sky-300/80 text-white hover:bg-white/10',
  'outline-teal-light': 'border-2 border-teal-300/70 text-teal-50 hover:bg-white/10',
};
const sizes = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-14 px-7 text-lg gap-2.5',
  xl: 'h-16 px-8 text-xl gap-3',
  icon: 'h-10 w-10',
};

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading = false, className, children, disabled, type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-full font-semibold transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
