import { cn } from '../../utils/cn.js';

/** A phone-shaped frame used to show the companion screen beside the laptop UI. */
export function PhoneFrame({ children, dark = false, className, width = 300 }) {
  const now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <div className={cn('relative mx-auto rounded-[44px] bg-slate-900 p-3 shadow-lift ring-1 ring-black/10', className)} style={{ width, aspectRatio: '9 / 19' }}>
      <div className="absolute left-1/2 top-4 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden />
      <div className={cn('relative flex h-full flex-col overflow-hidden rounded-[34px]', dark ? 'bg-[#0d1424] text-white' : 'bg-[#EEF3F8] text-ink')}>
        <div className={cn('flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold', dark ? 'text-white' : 'text-ink')} aria-hidden>
          <span>{now}</span>
          <span className="tracking-widest">●●● ◔ ▮</span>
        </div>
        <div className="relative flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
