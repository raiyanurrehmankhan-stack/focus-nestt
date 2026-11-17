import { RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-8 text-center" role="alert">
      <p className="font-medium">We couldn't load this right now.</p>
      <p className="muted text-sm">{error?.message || 'Please check your connection and try again.'}</p>
      {onRetry && <Button variant="soft" size="sm" onClick={() => onRetry()}><RefreshCw className="h-4 w-4" /> Try again</Button>}
    </div>
  );
}
