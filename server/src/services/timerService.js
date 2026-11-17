// Focus sessions and breaks. Shared by the REST controllers and Socket.IO
// handlers so both paths behave identically.
import { LIMITS, POINTS } from '../../../shared/constants.js';
import { focusPoints, returnedOnTime as isOnTime } from '../../../shared/rules.js';
import { BreakSession, FocusSession, User } from '../models/index.js';
import { HttpError, notFound } from '../utils/httpError.js';
import { cancel, scheduleAt, startSweeper } from './breakScheduler.js';
import { notifyBuddy } from './mailService.js';
import { awardPoints, refreshProgress } from './pointsService.js';
import { sendToUser } from './pushService.js';
import { emitToUser } from './realtime.js';

const DEMO_MS = LIMITS.demoSeconds * 1000;
const key = (kind, id) => `${kind}:${id}`;

export const serializeFocus = (f) => f && ({
  id: String(f._id), kind: 'focus', status: f.status, goalText: f.goalText, date: f.date,
  startAt: f.startAt, endAt: f.endAt, plannedMinutes: f.plannedMinutes, pausedRemainingMs: f.pausedRemainingMs || 0,
  demo: f.demo, pointsAwarded: f.pointsAwarded || 0,
});
export const serializeBreak = (b) => b && ({
  id: String(b._id), kind: 'break', status: b.status, date: b.date, startAt: b.startAt, endAt: b.endAt,
  plannedMinutes: b.plannedMinutes, demo: b.demo,
  extensions: (b.extensions || []).map((e) => ({ minutes: e.minutes, at: e.at, reason: e.reason })),
  extensionsLeft: Math.max(0, LIMITS.maxExtensionsPerBreak - (b.extensions || []).length),
  returnedOnTime: b.returnedOnTime,
});

export async function getActiveTimer(userId) {
  const [focus, brk] = await Promise.all([
    FocusSession.findOne({ userId, status: { $in: ['running', 'paused'] } }).sort({ startAt: -1 }),
    BreakSession.findOne({ userId, status: { $in: ['running', 'ended'] } }).sort({ startAt: -1 }),
  ]);
  // Lazy catch-up in case a scheduled job was missed.
  if (focus?.status === 'running' && focus.endAt <= Date.now()) {
    await finishFocus(focus._id);
    return getActiveTimer(userId);
  }
  if (brk?.status === 'running' && brk.endAt <= Date.now()) {
    await endBreak(brk._id);
    return getActiveTimer(userId);
  }
  if (focus && (!brk || focus.startAt > brk.startAt)) return serializeFocus(focus);
  return serializeBreak(brk) || serializeFocus(focus) || null;
}

// ---------------- focus ----------------
async function settleRunningFocus(userId) {
  const active = await FocusSession.find({ userId, status: { $in: ['running', 'paused'] } });
  for (const f of active) {
    cancel(key('focus', f._id));
    const elapsedMin = f.status === 'running'
      ? Math.floor((Date.now() - f.startAt.getTime()) / 60000)
      : Math.floor((f.plannedMinutes * 60000 - (f.pausedRemainingMs || 0)) / 60000);
    if (!f.demo && elapsedMin >= 25) {
      // Count the full 25-minute blocks already done.
      const pts = focusPoints(elapsedMin);
      await FocusSession.updateOne({ _id: f._id }, { status: 'completed', completed: true, actualMinutes: elapsedMin, completedAt: new Date(), pointsAwarded: pts });
      await awardPoints(userId, pts, 'Focus session');
    } else {
      await FocusSession.updateOne({ _id: f._id }, { status: 'cancelled' });
    }
  }
}

async function settleOpenBreaks(userId) {
  const open = await BreakSession.find({ userId, status: { $in: ['running', 'ended'] } });
  for (const b of open) {
    cancel(key('break', b._id));
    await BreakSession.updateOne({ _id: b._id }, { status: 'cancelled', closedAt: new Date() });
  }
}

export async function startFocus(user, { date, goalText = '', plannedMinutes = 25, demo = false }) {
  const userId = user._id;
  // Starting focus from an ended break counts as returning to focus.
  const openBreak = await BreakSession.findOne({ userId, status: { $in: ['running', 'ended'] } });
  if (openBreak) await closeBreak(user, openBreak._id, { date, startFocus: false });
  await settleRunningFocus(userId);
  const ms = demo ? DEMO_MS : plannedMinutes * 60000;
  const now = new Date();
  const f = await FocusSession.create({ userId, date, goalText, startAt: now, endAt: new Date(now.getTime() + ms), plannedMinutes, demo });
  scheduleAt(key('focus', f._id), f.endAt, () => finishFocus(f._id));
  const timer = serializeFocus(f);
  emitToUser(userId, 'focus:started', { timer });
  return timer;
}

export async function updateFocus(user, id, action) {
  const f = await FocusSession.findOne({ _id: id, userId: user._id });
  if (!f) throw notFound('Focus session');
  if (action === 'pause') {
    if (f.status !== 'running') throw new HttpError(409, 'This session is not running');
    f.pausedRemainingMs = Math.max(0, f.endAt.getTime() - Date.now());
    f.status = 'paused';
    cancel(key('focus', f._id));
  } else if (action === 'resume') {
    if (f.status !== 'paused') throw new HttpError(409, 'This session is not paused');
    f.endAt = new Date(Date.now() + f.pausedRemainingMs);
    f.status = 'running';
    scheduleAt(key('focus', f._id), f.endAt, () => finishFocus(f._id));
  } else if (action === 'cancel') {
    if (!['running', 'paused'].includes(f.status)) throw new HttpError(409, 'This session already ended');
    f.status = 'cancelled';
    cancel(key('focus', f._id));
  } else if (action === 'complete') {
    if (f.status === 'completed') return serializeFocus(f); // already finished by the scheduler
    if (f.status !== 'running' || f.endAt.getTime() > Date.now() + 2000) throw new HttpError(409, 'Keep going — this session has not finished yet');
    const result = await finishFocus(f._id);
    return result?.timer || serializeFocus(await FocusSession.findById(f._id));
  }
  await f.save();
  const timer = serializeFocus(f);
  emitToUser(user._id, action === 'cancel' ? 'focus:ended' : 'focus:updated', { timer });
  return timer;
}

/** Called by the scheduler (or lazily) when a focus session reaches its end. */
export async function finishFocus(id) {
  const f = await FocusSession.findOneAndUpdate(
    { _id: id, status: 'running', endAt: { $lte: new Date(Date.now() + 2000) } },
    { status: 'completed', completed: true, completedAt: new Date() },
    { new: true },
  );
  if (!f) return null;
  const minutes = f.demo ? 25 : f.plannedMinutes;
  const pts = focusPoints(f.plannedMinutes, { demo: f.demo });
  f.actualMinutes = minutes;
  f.pointsAwarded = pts;
  await f.save();
  if (pts) await awardPoints(f.userId, pts, 'Focus session');
  const progress = await refreshProgress(f.userId, f.date);
  const timer = serializeFocus(f);
  emitToUser(f.userId, 'focus:ended', { timer, points: pts, progress });
  await sendToUser(f.userId, { title: 'Focus session complete 🎉', body: `Great work! +${pts} points. Take a short break or keep going.`, tag: 'focus-complete', url: '/focus' });
  return { timer, points: pts };
}

// ---------------- breaks ----------------
export async function startBreak(user, { date, minutes = 30, demo = false }) {
  const userId = user._id;
  await settleRunningFocus(userId);
  await settleOpenBreaks(userId);
  const ms = demo ? DEMO_MS : minutes * 60000;
  const now = new Date();
  const b = await BreakSession.create({ userId, date, startAt: now, endAt: new Date(now.getTime() + ms), plannedMinutes: minutes, demo });
  scheduleAt(key('break', b._id), b.endAt, () => endBreak(b._id));
  const timer = serializeBreak(b);
  emitToUser(userId, 'break:started', { timer });
  return timer;
}

/** Fires at endAt: every device shows Break Over; offline devices get a push. */
export async function endBreak(id) {
  const b = await BreakSession.findOneAndUpdate(
    { _id: id, status: 'running', endAt: { $lte: new Date(Date.now() + 2000) } },
    { status: 'ended', endedAt: new Date() },
    { new: true },
  );
  if (!b) return null;
  const timer = serializeBreak(b);
  emitToUser(b.userId, 'break:ended', { timer });
  await sendToUser(b.userId, {
    title: 'Break over ⏰',
    body: 'Time to get back to focus.',
    tag: 'break-over',
    url: '/focus?breakOver=1',
    requireInteraction: true,
    actions: [{ action: 'focus', title: 'Back to focus' }],
  });
  return timer;
}

export async function extendBreak(user, id, { reason, minutes = LIMITS.extensionMinutes }) {
  const b = await BreakSession.findOne({ _id: id, userId: user._id });
  if (!b) throw notFound('Break');
  if (!['running', 'ended'].includes(b.status)) throw new HttpError(409, 'This break is already over');
  if (b.extensions.length >= LIMITS.maxExtensionsPerBreak) throw new HttpError(409, 'You have used both extensions. Time to return to focus.');
  const ms = b.demo ? DEMO_MS : minutes * 60000;
  b.extensions.push({ reason, minutes, at: new Date() });
  b.endAt = new Date(Math.max(Date.now(), b.status === 'running' ? b.endAt.getTime() : 0) + ms);
  b.status = 'running';
  await b.save();
  scheduleAt(key('break', b._id), b.endAt, () => endBreak(b._id));
  const timer = serializeBreak(b);
  emitToUser(user._id, 'break:extended', { timer });
  const buddyNotified = await notifyBuddy(user, minutes);
  return { timer, buddyNotified };
}

export async function closeBreak(user, id, { date, startFocus: andFocus = true, goalText } = {}) {
  const b = await BreakSession.findOne({ _id: id, userId: user._id });
  if (!b) throw notFound('Break');
  if (!['running', 'ended'].includes(b.status)) throw new HttpError(409, 'This break is already closed');
  cancel(key('break', b._id));
  const now = new Date();
  b.status = 'closed';
  b.closedAt = now;
  b.returnedOnTime = isOnTime(b.endAt, now);
  await b.save();
  let points = 0;
  if (b.returnedOnTime) {
    points = POINTS.returnOnTime;
    await awardPoints(user._id, points, 'Back to focus on time');
  }
  emitToUser(user._id, 'break:closed', { timer: serializeBreak(b), points });
  let timer = null;
  if (andFocus) {
    const fresh = await User.findById(user._id);
    timer = await startFocus(fresh, { date: date || b.date, goalText: goalText || '', plannedMinutes: 25, demo: b.demo });
  }
  const progress = await refreshProgress(user._id, date || b.date);
  return { timer, points, returnedOnTime: b.returnedOnTime, progress };
}

// ---------------- startup ----------------
export async function rescheduleRunning() {
  const [focus, breaks] = await Promise.all([
    FocusSession.find({ status: 'running' }).select('_id endAt'),
    BreakSession.find({ status: 'running' }).select('_id endAt'),
  ]);
  focus.forEach((f) => scheduleAt(key('focus', f._id), f.endAt, () => finishFocus(f._id)));
  breaks.forEach((b) => scheduleAt(key('break', b._id), b.endAt, () => endBreak(b._id)));
  console.log(`[scheduler] Rescheduled ${focus.length} focus session(s) and ${breaks.length} break(s)`);
  startSweeper(sweepOverdue);
}

async function sweepOverdue() {
  const cutoff = new Date(Date.now() - 5000);
  const [focus, breaks] = await Promise.all([
    FocusSession.find({ status: 'running', endAt: { $lte: cutoff } }).select('_id').limit(100),
    BreakSession.find({ status: 'running', endAt: { $lte: cutoff } }).select('_id').limit(100),
  ]);
  for (const f of focus) await finishFocus(f._id);
  for (const b of breaks) await endBreak(b._id);
}
