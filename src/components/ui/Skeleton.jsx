import { cn } from '../../utils/cn.js';

/** Loading skeletons instead of spinners (doc 5.5). */
export const Skeleton = ({ className }) => <div className={cn('skeleton', className)} aria-hidden />;

export function CardSkeleton({ lines = 3, className }) {
  return (
    <div className={cn('card space-y-3', className)} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={cn('h-4', i % 2 ? 'w-2/3' : 'w-full')} />)}
    </div>
  );
}
