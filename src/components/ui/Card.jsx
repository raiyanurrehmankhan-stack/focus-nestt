import { cn } from '../../utils/cn.js';

export function Card({ as: Tag = 'section', className, children, ...props }) {
  return <Tag className={cn('card', className)} {...props}>{children}</Tag>;
}

export function CardHeader({ title, icon: Icon, action, subtitle, className }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="card-title flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 shrink-0 text-teal" aria-hidden />}
          {title}
        </h2>
        {subtitle && <p className="muted mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
