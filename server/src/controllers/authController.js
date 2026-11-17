import bcrypt from 'bcryptjs';
import { isBedtimeOnTarget } from '../../../shared/rules.js';
import { schemas, z } from '../config/validation.js';
import { ActivityLog, Badge, BreakSession, CheckIn, Device, FocusSession, Goal, SleepLog, User, Win } from '../models/index.js';
import { refreshProgress } from '../services/pointsService.js';
import { HttpError } from '../utils/httpError.js';
import { clientDate } from '../utils/dates.js';
import { signToken } from '../utils/tokens.js';

const BCRYPT_ROUNDS = 12;
// Compared against when the email does not exist, so response time does not
// reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('focusnest-timing-guard', BCRYPT_ROUNDS);

export async function register(req, res) {
  const { email, password, importGuestData, ...profile } = req.body;
  if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists. Try signing in.');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ email, passwordHash, ...profile });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect');
  res.json({ token: signToken(user), user: user.toPublic() });
}

export async function me(req, res) {
  res.json({ user: req.user.toPublic() });
}

export async function updateMe(req, res) {
  const patch = req.body;
  Object.assign(req.user, patch);
  await req.user.save();
  res.json({ user: req.user.toPublic() });
}

/** Signs out every device by invalidating all existing tokens. */
export async function logoutAll(req, res) {
  await User.updateOne({ _id: req.userId }, { $inc: { tokenVersion: 1 } });
  res.json({ ok: true });
}

/** Doc 7.8: let the user delete their account and all data. */
export async function deleteMe(req, res) {
  const { password } = z.object({ password: z.string().min(1, 'Enter your password to confirm') }).parse(req.body || {});
  const user = await User.findById(req.userId).select('+passwordHash');
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Password is incorrect');
  const userId = req.userId;
  await Promise.all([CheckIn, FocusSession, BreakSession, SleepLog, Win, Goal, Badge, ActivityLog, Device].map((M) => M.deleteMany({ userId })));
  await User.deleteOne({ _id: userId });
  res.json({ ok: true });
}

export async function exportData(req, res) {
  const userId = req.userId;
  const [checkins, focusSessions, breaks, sleepLogs, wins, goals, badges, activityLogs, devices] = await Promise.all(
    [CheckIn, FocusSession, BreakSession, SleepLog, Win, Goal, Badge, ActivityLog, Device].map((M) => M.find({ userId }).select('-userId -__v').lean()),
  );
  res.setHeader('Content-Disposition', 'attachment; filename="focusnest-export.json"');
  res.json({ exportedAt: new Date().toISOString(), user: req.user.toPublic(), checkins, focusSessions, breaks, sleepLogs, wins, goals, badges, activityLogs, devices: devices.map(({ pushSubscription, ...d }) => d) });
}

// ---- import guest (offline) data after creating an account ----
const importSchema = z.object({
  date: schemas.dateKey,
  points: z.number().int().min(0).max(100000).default(0),
  checkins: z.array(schemas.checkIn).max(400).default([]),
  sleepLogs: z.array(schemas.sleepLog).max(400).default([]),
  wins: z.array(z.object({ date: schemas.dateKey, items: z.array(z.string().trim().max(140)).min(1).max(3) })).max(400).default([]),
  goals: z.array(z.object({ title: z.string().trim().min(1).max(100), target: z.number().int().min(1).max(1000).default(1), progress: z.number().int().min(0).max(1000).default(0) })).max(100).default([]),
  focusSessions: z.array(z.object({ date: schemas.dateKey, goalText: z.string().max(120).default(''), minutes: z.number().int().min(1).max(180), demo: z.boolean().default(false) })).max(1000).default([]),
  activityLogs: z.array(z.object({ date: schemas.dateKey, activityKey: z.string().max(40), title: z.string().max(100).optional() })).max(1000).default([]),
});

export async function importGuest(req, res) {
  const data = importSchema.parse(req.body);
  const userId = req.userId;
  const user = req.user;
  // Only allow importing into a fresh account to avoid duplicating points.
  const already = await Promise.all([CheckIn, FocusSession, SleepLog, Win].map((M) => M.exists({ userId })));
  if (already.some(Boolean)) throw new HttpError(409, 'This account already has data, so guest data was not imported');
  const ops = [];
  if (data.checkins.length) ops.push(CheckIn.insertMany(dedupe(data.checkins).map((c) => ({ ...c, userId })), { ordered: false }));
  if (data.sleepLogs.length) {
    ops.push(SleepLog.insertMany(dedupe(data.sleepLogs).map((s) => ({
      ...s, userId, bedtimeGoal: s.bedtimeGoal || user.bedtimeGoal,
      onTarget: s.actualBedtime ? isBedtimeOnTarget(s.bedtimeGoal || user.bedtimeGoal, s.actualBedtime) : false, pointsAwarded: true,
    })), { ordered: false }));
  }
  if (data.wins.length) ops.push(Win.insertMany(data.wins.map((w) => ({ ...w, userId }))));
  if (data.goals.length) ops.push(Goal.insertMany(data.goals.map((g) => ({ ...g, userId, done: g.progress >= g.target }))));
  if (data.focusSessions.length) {
    ops.push(FocusSession.insertMany(data.focusSessions.map((f) => {
      const startAt = new Date(`${f.date}T12:00:00`);
      return { userId, date: f.date, goalText: f.goalText, startAt, endAt: new Date(startAt.getTime() + f.minutes * 60000), plannedMinutes: f.minutes, actualMinutes: f.minutes, demo: f.demo, status: 'completed', completed: true, completedAt: startAt };
    })));
  }
  if (data.activityLogs.length) ops.push(ActivityLog.insertMany(data.activityLogs.map((a) => ({ ...a, userId }))));
  await Promise.all(ops);
  if (data.points) await User.updateOne({ _id: userId }, { $inc: { points: data.points }, $push: { pointsHistory: { amount: data.points, reason: 'Imported from this device' } } });
  const progress = await refreshProgress(userId, clientDate(data.date));
  res.json({ ok: true, progress });
}

function dedupe(arr) {
  const map = new Map();
  for (const x of arr) map.set(x.date, x);
  return [...map.values()];
}

