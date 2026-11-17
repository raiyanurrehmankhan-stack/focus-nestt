// The Break Over flow (doc 6.5) in one place, shared by every screen
// (laptop view, phone companion, keyboard shortcuts, notification actions).
import { LIMITS } from '@shared/constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { useProgressStore } from '../store/useProgressStore.js';
import { useTimerStore } from '../store/useTimerStore.js';
import { toast } from '../store/useToastStore.js';
import { todayKey } from '../utils/time.js';
import { api } from './api.js';
import { invalidate } from './events.js';
import { notificationPermission } from './notifications.js';
import { readJSON } from './storage.js';

const timer = () => useTimerStore.getState();
const user = () => useAppStore.getState().user || {};

async function run(fn) {
  if (timer().busy) return null;
  timer().setBusy(true);
  try {
    return await fn();
  } catch (err) {
    toast.error(err.message || 'Something went wrong. Please try again.');
    return null;
  } finally {
    timer().setBusy(false);
  }
}

function afterChange(res) {
  if (res?.progress) useProgressStore.getState().apply(res.progress);
  if (res?.progress?.newBadges?.length) res.progress.newBadges.forEach((b) => b && toast.points(`${b.emoji} Badge unlocked: ${b.name}`));
  if (res?.progress?.questRewards?.length) res.progress.questRewards.forEach((q) => toast.points(`🏆 Quest complete: ${q.title} (+${q.reward})`));
  invalidate('dashboard', 'focus', 'progress', 'quests');
}

export async function refreshTimer() {
  try {
    const { active } = await api.getTimer();
    timer().setActive(active);
    return active;
  } catch {
    return timer().active;
  }
}

export const startFocus = ({ goalText = '', minutes = LIMITS.focusMinutesDefault } = {}) => run(async () => {
  const res = await api.startFocus({ date: todayKey(), goalText: goalText.trim(), plannedMinutes: minutes, demo: Boolean(user().demoMode) });
  timer().setActive(res.timer);
  toast.info(user().demoMode ? 'Focus started (demo: 30 seconds)' : `Focus started — ${minutes} minutes`);
  afterChange(res);
  return res.timer;
});

export const startBreak = ({ minutes } = {}) => run(async () => {
  const m = minutes || user().defaultBreakMinutes || LIMITS.breakMinutesDefault;
  const res = await api.startBreak({ date: todayKey(), minutes: m, demo: Boolean(user().demoMode) });
  timer().setActive(res.timer);
  toast.info(user().demoMode ? 'Break started (demo: 30 seconds)' : `Enjoy your ${m}-minute break`);
  // Doc 6.6: ask for notification permission after the first break, with an explanation.
  if (notificationPermission() === 'default' && !readJSON('fn:notify-asked')) window.dispatchEvent(new CustomEvent('fn:ask-notifications'));
  afterChange(res);
  return res.timer;
});

export const pauseFocus = () => run(async () => {
  const t = timer().active;
  if (!t || t.kind !== 'focus') return null;
  const res = await api.updateFocus(t.id, t.status === 'paused' ? 'resume' : 'pause');
  timer().setActive(res.timer);
  return res.timer;
});

export const cancelFocus = () => run(async () => {
  const t = timer().active;
  if (!t || t.kind !== 'focus') return null;
  await api.updateFocus(t.id, 'cancel');
  timer().setActive(null);
  toast.info('Session stopped. No worries — start again whenever you are ready.');
  afterChange(null);
  return null;
});

/** "Back to focus": closes the break (+5 points if on time) and starts a focus session. */
export const backToFocus = ({ goalText } = {}) => run(async () => {
  const t = timer().active;
  if (!t || t.kind !== 'break') return null;
  const res = await api.closeBreak(t.id, { date: todayKey(), startFocus: true, goalText });
  timer().setActive(res.timer);
  timer().setExtendOpen(false);
  toast.success(res.points ? `Welcome back! +${res.points} points for returning on time` : 'Welcome back! Your focus session has started.');
  afterChange(res);
  return res.timer;
});

/** End a break early without starting a focus session. */
export const endBreakNow = () => run(async () => {
  const t = timer().active;
  if (!t || t.kind !== 'break') return null;
  const res = await api.closeBreak(t.id, { date: todayKey(), startFocus: false });
  timer().setActive(null);
  if (res.points) toast.success(`Nice! +${res.points} points`);
  afterChange(res);
  return null;
});

/** "5 more minutes" after the breathing pause and a reason (max 2 per break). */
export const extendBreak = (reason) => run(async () => {
  const t = timer().active;
  if (!t || t.kind !== 'break') return null;
  const res = await api.extendBreak(t.id, { reason, minutes: LIMITS.extensionMinutes });
  timer().setActive(res.timer);
  timer().setExtendOpen(false);
  toast.info(t.demo ? 'Break extended by 30 seconds (demo)' : 'Break extended by 5 minutes');
  if (res.buddyNotified) toast.info('Your accountability buddy was told you extended a break (not why).');
  return res.timer;
});

/** Called when the on-screen countdown reaches zero. */
export async function handleZero(t) {
  if (t.kind === 'focus') {
    let res = null;
    for (let i = 0; i < 3 && !res; i++) {
      try {
        res = await api.updateFocus(t.id, 'complete');
      } catch (err) {
        if (err.status !== 409) break;
        await new Promise((r) => setTimeout(r, 1200)); // tiny clock differences with the server
      }
    }
    const finished = res?.timer;
    if (finished?.status === 'completed') {
      timer().setActive(null);
      timer().setLastFinished({ id: finished.id, kind: 'focus', points: finished.pointsAwarded });
      afterChange(null);
    } else {
      await refreshTimer();
    }
    return;
  }
  // Break: the server owns the clock; ask it, but show the overlay right away.
  const active = await refreshTimer();
  if (active?.id === t.id && active.status === 'running') timer().setActive({ ...active, status: 'ended' });
}
