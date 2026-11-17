import { BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isAccountMode } from '../../services/api.js';
import { requestNotificationPermission } from '../../services/notifications.js';
import { enablePush, pushNeedsInstall, pushSupported } from '../../services/push.js';
import { writeJSON } from '../../services/storage.js';
import { toast } from '../../store/useToastStore.js';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * Clear consent screen before the browser permission prompt (doc 6.6 / 7.8).
 * Opened after the user starts their first break.
 */
export function NotificationConsent() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener('fn:ask-notifications', on);
    return () => window.removeEventListener('fn:ask-notifications', on);
  }, []);
  const close = () => { writeJSON('fn:notify-asked', true); setOpen(false); };
  const allow = async () => {
    setBusy(true);
    try {
      if (isAccountMode() && pushSupported() && !pushNeedsInstall()) await enablePush();
      else {
        const p = await requestNotificationPermission();
        if (p !== 'granted') throw new Error('Notifications were not allowed. You can turn them on later in Settings.');
      }
      toast.success('Notifications are on. We will tell you when your break is over.');
    } catch (err) {
      toast.info(err.message);
    } finally {
      setBusy(false);
      close();
    }
  };
  return (
    <Modal open={open} onClose={close} title="Get a nudge when your break ends?">
      <div className="flex gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal dark:bg-teal-900/40"><BellRing className="h-6 w-6" /></span>
        <div className="space-y-2 text-sm text-ink-soft dark:text-slate-300">
          <p>FocusNest can show a notification when a break or focus session ends — even if this tab is in the background{isAccountMode() ? ' or the app is closed on your phone' : ''}.</p>
          <p>We only send timer and bedtime reminders. No marketing, ever. You can turn this off any time in Settings.</p>
          {pushNeedsInstall() && <p className="font-medium text-amber-700 dark:text-amber-300">On iPhone and iPad, notifications work after you add FocusNest to your Home Screen.</p>}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={close}>Not now</Button>
        <Button onClick={allow} loading={busy}>Allow notifications</Button>
      </div>
    </Modal>
  );
}
