import { Mascot } from './Mascot.jsx';

/** Empty state with the mascot and one clear action (doc 5.5). */
export function EmptyState({ title, message, action, mascot = 'tangled', size = 96 }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <Mascot state={mascot} size={size} />
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      {message && <p className="muted mt-1 max-w-xs text-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
