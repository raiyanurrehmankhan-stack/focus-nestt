import { useNavigate } from 'react-router-dom';
import { appRoutes } from '../../routes.jsx';
import { Modal } from '../ui/Modal.jsx';

const hidden = new Set(['/', '/focus', '/sleep', '/wins']);

export function MoreSheet({ open, onClose }) {
  const navigate = useNavigate();
  const items = appRoutes.filter((r) => !hidden.has(r.path));
  return (
    <Modal open={open} onClose={onClose} title="More">
      <div className="grid grid-cols-3 gap-3">
        {items.map(({ path, label, icon: Icon }) => (
          <button key={path} type="button" onClick={() => { onClose(); navigate(path); }}
            className="flex flex-col items-center gap-2 rounded-2xl bg-canvas-light px-2 py-4 text-sm font-medium hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-slate-700">
            <Icon className="h-6 w-6 text-teal" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
