// Guest (offline) implementation of the FocusNest API.
// Same function names and response shapes as the real Node.js API
// (src/services/remoteApi.js), so screens do not care which one is used.
// Data stays in this browser's localStorage. Business rules come from
// /shared, the same code the server uses.
import { z } from 'zod';
import * as C from '@shared/constants.js';
import * as R from '@shared/rules.js';
import { makeSchemas } from '@shared/schemas.js';
import { getDeviceId, getDeviceLabel, getDeviceType } from './device.js';
import { readJSON, removeKey, writeJSON } from './storage.js';

const S = makeSchemas(z);
export const LOCAL_DB_KEY = 'fn:db:v2';

export class ApiError extends Error {
  constructor(message, status = 400, fields = null) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

const emptyDb = () => ({
  version: 2,
  profile: null,
  checkins: [],
  focusSessions: [],
  breaks: [],
  sleepLogs: [],
  wins: [],
  goals: [],
  badges: {},
  activityLogs: [],
  joinedEvents: [],
  nightLock: { enabled: false, bedtime: '23:30', apps: ['social', 'video'], emergencyOverride: true },
  points: 0,
  pointsHistory: [],
  questAwards: [],
  bestSleepStreak: 0,
  streakDays: 0,
});

let db = load();
function load() {
  return { ...emptyDb(), ...(readJSON(LOCAL_DB_KEY, {}) || {}) };
}
function persist() {
  if (!writeJSON(LOCAL_DB_KEY, db)) throw new ApiError('Your browser storage is full. Export or delete old data in Settings.', 507);
}
/** Re-read storage (another tab changed it). */
export function reloadLocalDb() {
  db = load();
}
export const hasLocalProfile = () => Boolean(db.profile);

const oid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
const iso = (ms) => new Date(ms).toISOString();
const ms = (v) => new Date(v).getTime();
const copy = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const today = () => R.toDateKey();

function parse(schema, data) {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    const fields = {};
    for (const i of r.error.issues) fields[i.path.join('.') || '_'] = i.message;
    throw new ApiError(r.error.issues[0]?.message || 'Please check your input', 400, fields);
  }
  return r.data;
}

// ---------------- profile ----------------
const defaultProfile = () => ({
  name: 'Friend', userType: 'University student', struggles: [], screenGoalHours: 4, bedtimeGoal: '23:00', wakeGoal: '07:00',
  defaultBreakMinutes: 30, theme: 'auto', demoMode: false, soundOn: true, buddyEmail: '', createdAt: new Date().toISOString(),
});

function publicUser() {
  if (!db.profile) return null;
  return copy({
    id: 'local', email: null, guest: true, ...db.profile,
    nightLock: db.nightLock, joinedEvents: db.joinedEvents, points: db.points, level: R.levelInfo(db.points).level,
    streakDays: db.streakDays, bestSleepStreak: db.bestSleepStreak, questAwards: db.questAwards, pointsHistory: db.pointsHistory,
  });
}

export async function createGuestProfile(data) {
  const fields = parse(S.profileUpdate, data);
  db.profile = { ...defaultProfile(), ...(db.profile || {}), ...fields };
  persist();
  return { user: publicUser() };
}

export async function me() {
  if (!db.profile) throw new ApiError('No profile yet', 401);
  return { user: publicUser() };
}

export async function updateProfile(patch) {
  const fields = parse(S.profileUpdate, patch);
  db.profile = { ...defaultProfile(), ...(db.profile || {}), ...fields };
  persist();
  return { user: publicUser() };
}

// ---------------- points & progress ----------------
function award(amount, reason) {
  if (!amount) return;
  db.points += amount;
  db.pointsHistory = [...db.pointsHistory, { at: new Date().toISOString(), amount, reason }].slice(-30);
}

function progressData() {
  return {
    checkins: db.checkins,
    focusSessions: db.focusSessions.filter((f) => f.status === 'completed'),
    breaks: db.breaks.filter((b) => b.status === 'closed'),
    sleepLogs: db.sleepLogs,
    wins: db.wins,
    activityLogs: db.activityLogs,
  };
}

function refreshProgress(date = today()) {
  const data = progressData();
  const profile = { ...db.profile, points: db.points, questAwards: db.questAwards, bestSleepStreak: db.bestSleepStreak };
  const rewards = R.pendingQuestRewards(data, profile, date);
  for (const q of rewards) {
    db.questAwards.push({ weekId: q.weekId, code: q.code, at: new Date().toISOString() });
    award(q.reward, `Quest: ${q.title}`);
  }
  const sStreak = R.sleepStreak(db.sleepLogs, date);
  db.bestSleepStreak = Math.max(db.bestSleepStreak, sStreak);
  db.streakDays = R.activityStreak(data, date);
  const earned = R.evaluateBadges(data, { ...profile, points: db.points, questAwards: db.questAwards, bestSleepStreak: db.bestSleepStreak }, date);
  const fresh = earned.filter((c) => !db.badges[c]);
  fresh.forEach((c) => { db.badges[c] = new Date().toISOString(); });
  persist();
  return {
    points: db.points,
    level: R.levelInfo(db.points),
    streakDays: db.streakDays,
    sleepStreak: sStreak,
    newBadges: fresh.map((c) => C.BADGES.find((b) => b.code === c)),
    questRewards: rewards.map((q) => ({ code: q.code, title: q.title, reward: q.reward })),
  };
}

// ---------------- timers ----------------
const DEMO_MS = C.LIMITS.demoSeconds * 1000;

const serializeFocus = (f) => f && copy({
  id: f.id, kind: 'focus', status: f.status, goalText: f.goalText, date: f.date, startAt: f.startAt, endAt: f.endAt,
  plannedMinutes: f.plannedMinutes, pausedRemainingMs: f.pausedRemainingMs || 0, demo: f.demo, pointsAwarded: f.pointsAwarded || 0,
});
const serializeBreak = (b) => b && copy({
  id: b.id, kind: 'break', status: b.status, date: b.date, startAt: b.startAt, endAt: b.endAt, plannedMinutes: b.plannedMinutes, demo: b.demo,
  extensions: b.extensions, extensionsLeft: Math.max(0, C.LIMITS.maxExtensionsPerBreak - b.extensions.length), returnedOnTime: b.returnedOnTime,
});

function finishDue() {
  const now = Date.now();
  let finished = null;
  for (const f of db.focusSessions) {
    if (f.status === 'running' && ms(f.endAt) <= now + 1000) {
      const pts = R.focusPoints(f.plannedMinutes, { demo: f.demo });
      Object.assign(f, { status: 'completed', completed: true, completedAt: iso(now), actualMinutes: f.demo ? 25 : f.plannedMinutes, pointsAwarded: pts });
      award(pts, 'Focus session');
      finished = f;
    }
  }
  for (const b of db.breaks) {
    if (b.status === 'running' && ms(b.endAt) <= now + 1000) Object.assign(b, { status: 'ended', endedAt: iso(now) });
  }
  if (finished) refreshProgress(finished.date);
  else persist();
  return finished;
}

function active() {
  finishDue();
  const f = [...db.focusSessions].reverse().find((x) => x.status === 'running' || x.status === 'paused');
  const b = [...db.breaks].reverse().find((x) => x.status === 'running' || x.status === 'ended');
  if (f && (!b || ms(f.startAt) > ms(b.startAt))) return serializeFocus(f);
  return serializeBreak(b) || serializeFocus(f) || null;
}

export async function getTimer() {
  return { active: active() };
}

function settleRunningFocus() {
  const now = Date.now();
  for (const f of db.focusSessions) {
    if (f.status !== 'running' && f.status !== 'paused') continue;
    const elapsed = f.status === 'running' ? Math.floor((now - ms(f.startAt)) / 60000) : Math.floor((f.plannedMinutes * 60000 - (f.pausedRemainingMs || 0)) / 60000);
    if (!f.demo && elapsed >= 25) {
      const pts = R.focusPoints(elapsed);
      Object.assign(f, { status: 'completed', completed: true, actualMinutes: elapsed, completedAt: iso(now), pointsAwarded: pts });
      award(pts, 'Focus session');
    } else f.status = 'cancelled';
  }
}
function settleOpenBreaks() {
  for (const b of db.breaks) if (b.status === 'running' || b.status === 'ended') Object.assign(b, { status: 'cancelled', closedAt: new Date().toISOString() });
}

export async function startFocus(input) {
  const d = parse(S.focusStart, input);
  const open = db.breaks.find((b) => b.status === 'running' || b.status === 'ended');
  if (open) await closeBreak(open.id, { date: d.date, startFocus: false });
  settleRunningFocus();
  const now = Date.now();
  const f = { id: oid(), date: d.date, goalText: d.goalText, startAt: iso(now), endAt: iso(now + (d.demo ? DEMO_MS : d.plannedMinutes * 60000)), plannedMinutes: d.plannedMinutes, demo: d.demo, status: 'running', pausedRemainingMs: 0, completed: false, pointsAwarded: 0 };
  db.focusSessions.push(f);
  db.focusSessions = db.focusSessions.slice(-500);
  persist();
  return { timer: serializeFocus(f) };
}

export async function updateFocus(id, action) {
  parse(S.focusUpdate, { action });
  finishDue();
  const f = db.focusSessions.find((x) => x.id === id);
  if (!f) throw new ApiError('Focus session not found', 404);
  if (action === 'pause') {
    if (f.status !== 'running') throw new ApiError('This session is not running', 409);
    f.pausedRemainingMs = Math.max(0, ms(f.endAt) - Date.now());
    f.status = 'paused';
  } else if (action === 'resume') {
    if (f.status !== 'paused') throw new ApiError('This session is not paused', 409);
    f.endAt = iso(Date.now() + f.pausedRemainingMs);
    f.status = 'running';
  } else if (action === 'cancel') {
    if (f.status !== 'running' && f.status !== 'paused') throw new ApiError('This session already ended', 409);
    f.status = 'cancelled';
  } else if (action === 'complete') {
    if (f.status !== 'completed') throw new ApiError('Keep going — this session has not finished yet', 409);
  }
  persist();
  return { timer: serializeFocus(f) };
}

export async function startBreak(input) {
  const d = parse(S.breakStart, input);
  settleRunningFocus();
  settleOpenBreaks();
  const now = Date.now();
  const b = { id: oid(), date: d.date, startAt: iso(now), endAt: iso(now + (d.demo ? DEMO_MS : d.minutes * 60000)), plannedMinutes: d.minutes, demo: d.demo, extensions: [], status: 'running', returnedOnTime: false };
  db.breaks.push(b);
  db.breaks = db.breaks.slice(-500);
  persist();
  return { timer: serializeBreak(b) };
}

export async function extendBreak(id, input) {
  const d = parse(S.breakExtend, input);
  finishDue();
  const b = db.breaks.find((x) => x.id === id);
  if (!b) throw new ApiError('Break not found', 404);
  if (b.status !== 'running' && b.status !== 'ended') throw new ApiError('This break is already over', 409);
  if (b.extensions.length >= C.LIMITS.maxExtensionsPerBreak) throw new ApiError('You have used both extensions. Time to return to focus.', 409);
  const add = b.demo ? DEMO_MS : d.minutes * 60000;
  b.extensions.push({ reason: d.reason, minutes: d.minutes, at: new Date().toISOString() });
  b.endAt = iso(Math.max(Date.now(), b.status === 'running' ? ms(b.endAt) : 0) + add);
  b.status = 'running';
  persist();
  return { timer: serializeBreak(b), buddyNotified: false };
}

export async function closeBreak(id, input = {}) {
  const d = parse(S.breakClose, { date: today(), ...input });
  const b = db.breaks.find((x) => x.id === id);
  if (!b) throw new ApiError('Break not found', 404);
  if (b.status !== 'running' && b.status !== 'ended') throw new ApiError('This break is already closed', 409);
  const now = new Date();
  Object.assign(b, { status: 'closed', closedAt: now.toISOString(), returnedOnTime: R.returnedOnTime(b.endAt, now) });
  let points = 0;
  if (b.returnedOnTime) { points = C.POINTS.returnOnTime; award(points, 'Back to focus on time'); }
  persist();
  let timer = null;
  if (d.startFocus) timer = (await startFocus({ date: d.date, goalText: d.goalText || '', plannedMinutes: 25, demo: b.demo })).timer;
  const progress = refreshProgress(d.date);
  return { timer, points, returnedOnTime: b.returnedOnTime, progress };
}

export async function todaySessions(date = today()) {
  finishDue();
  const items = db.focusSessions.filter((f) => f.date === date && f.status === 'completed').reverse();
  return { items: items.map((f) => ({ id: f.id, goalText: f.goalText, minutes: f.demo ? 25 : f.actualMinutes || f.plannedMinutes, points: f.pointsAwarded, demo: f.demo, completedAt: f.completedAt })) };
}

// ---------------- dashboard & state ----------------
export async function getState() {
  return { user: publicUser(), active: active(), serverTime: Date.now(), capabilities: { push: false, vapidPublicKey: null, email: false } };
}

export async function getDashboard(date = today()) {
  const t = active();
  const todayCheckIn = db.checkins.find((c) => c.date === date);
  const lastSleep = [...db.sleepLogs].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const focusToday = db.focusSessions.filter((f) => f.date === date && f.status === 'completed');
  return copy({
    today: date,
    screenTime: { hours: todayCheckIn?.screenHours ?? null, goalHours: db.profile?.screenGoalHours ?? 4 },
    sleep: lastSleep ? { date: lastSleep.date, hours: lastSleep.hoursSlept ?? null, onTarget: lastSleep.onTarget } : null,
    focus: {
      minutes: focusToday.reduce((s, f) => s + (f.demo ? 25 : f.actualMinutes || f.plannedMinutes), 0),
      sessions: focusToday.map((f) => ({ id: f.id, goalText: f.goalText, minutes: f.demo ? 25 : f.actualMinutes || f.plannedMinutes, points: f.pointsAwarded })),
    },
    goals: db.goals.filter((g) => !g.done).slice(-5).reverse().map((g) => ({ id: g._id, title: g.title, target: g.target, progress: g.progress })),
    weekScreen: R.weeklyScreenSeries(db.checkins, date),
    weekSleep: R.weeklySleepSeries(db.sleepLogs, date),
    insight: R.dangerHourInsight(db.checkins, db.profile || {}),
    streakDays: db.streakDays,
    sleepStreak: R.sleepStreak(db.sleepLogs, date),
    points: db.points,
    level: R.levelInfo(db.points),
    active: t,
  });
}

// ---------------- check-ins ----------------
export async function saveCheckIn(input) {
  const d = parse(S.checkIn, input);
  db.checkins = [...db.checkins.filter((c) => c.date !== d.date), { ...d, id: oid() }].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-400);
  persist();
  return { checkIn: copy(d), progress: refreshProgress(d.date) };
}
export async function listCheckIns({ from, to } = {}) {
  const end = to || today();
  const start = from || R.addDays(end, -29);
  return { items: copy(db.checkins.filter((c) => c.date >= start && c.date <= end).reverse()) };
}

// ---------------- sleep ----------------
export async function getSleepWeek(date = today()) {
  const logs = [...db.sleepLogs].sort((a, b) => (a.date < b.date ? -1 : 1));
  return copy({
    today: logs.find((l) => l.date === date) || null,
    week: R.weeklySleepSeries(logs, date),
    streak: R.sleepStreak(logs, date),
    bestStreak: db.bestSleepStreak,
    history: logs.slice(-60).map((l) => ({ date: l.date, onTarget: l.onTarget, hoursSlept: l.hoursSlept, actualBedtime: l.actualBedtime })),
    bedtimeGoal: db.profile?.bedtimeGoal || '23:00',
  });
}
export async function saveSleep(input) {
  const d = parse(S.sleepLog, input);
  const existing = db.sleepLogs.find((l) => l.date === d.date) || { date: d.date, checklistDone: [], pointsAwarded: false };
  const doc = { ...existing, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) };
  doc.bedtimeGoal = doc.bedtimeGoal || db.profile?.bedtimeGoal || '23:00';
  doc.onTarget = doc.actualBedtime ? R.isBedtimeOnTarget(doc.bedtimeGoal, doc.actualBedtime) : false;
  let points = 0;
  if (doc.onTarget && !doc.pointsAwarded) { doc.pointsAwarded = true; points = C.POINTS.bedtimeOnTarget; award(points, 'Bedtime on target'); }
  db.sleepLogs = [...db.sleepLogs.filter((l) => l.date !== d.date), doc].slice(-400);
  persist();
  return { sleepLog: copy(doc), points, progress: refreshProgress(d.date) };
}

// ---------------- wins & goals ----------------
export async function listWins() {
  return { items: copy([...db.wins].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60)) };
}
export async function addWins(input) {
  const d = parse(S.wins, input);
  const win = { _id: oid(), date: d.date, items: d.items, createdAt: new Date().toISOString() };
  db.wins = [...db.wins.filter((w) => w.date !== d.date), win].slice(-400);
  persist();
  return { win: copy(win), progress: refreshProgress(d.date) };
}
export async function deleteWin(id) {
  db.wins = db.wins.filter((w) => w._id !== id);
  persist();
  return { ok: true };
}
export async function listGoals() {
  return { items: copy([...db.goals].sort((a, b) => Number(a.done) - Number(b.done) || (a.createdAt < b.createdAt ? 1 : -1))) };
}
export async function createGoal(input) {
  const d = parse(S.goalCreate, input);
  if (db.goals.filter((g) => !g.done).length >= 30) throw new ApiError('You already have 30 open goals. Finish or remove some first.', 409);
  const goal = { _id: oid(), ...d, progress: 0, done: false, createdAt: new Date().toISOString() };
  db.goals.push(goal);
  persist();
  return { goal: copy(goal) };
}
export async function updateGoal(id, input) {
  const d = parse(S.goalUpdate, input);
  const g = db.goals.find((x) => x._id === id);
  if (!g) throw new ApiError('Goal not found', 404);
  Object.assign(g, Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)));
  g.progress = Math.min(g.progress, g.target);
  g.done = g.progress >= g.target;
  persist();
  return { goal: copy(g) };
}
export async function deleteGoal(id) {
  db.goals = db.goals.filter((g) => g._id !== id);
  persist();
  return { ok: true };
}

// ---------------- quests ----------------
export async function getQuests(date = today()) {
  refreshProgress(date);
  return copy({
    points: db.points,
    level: R.levelInfo(db.points),
    quests: R.weeklyQuests(progressData(), { ...db.profile, questAwards: db.questAwards }, date),
    badges: C.BADGES.map((b) => ({ ...b, unlocked: Boolean(db.badges[b.code]), unlockedAt: db.badges[b.code] || null })),
    history: [...db.pointsHistory].slice(-10).reverse(),
  });
}

// ---------------- activities ----------------
export async function listActivities() {
  return { items: copy(C.ACTIVITIES) };
}
export async function randomActivity({ category, exclude } = {}) {
  const pool = C.ACTIVITIES.filter((a) => (!category || a.category === category) && a.id !== exclude);
  const list = pool.length ? pool : C.ACTIVITIES;
  return { activity: copy(list[Math.floor(Math.random() * list.length)]) };
}
export async function completeActivity(input) {
  const d = parse(S.activityDone, input);
  const a = C.ACTIVITIES.find((x) => x.id === d.activityId);
  if (!a) throw new ApiError('Activity not found', 404);
  const countToday = db.activityLogs.filter((l) => l.date === d.date && l.points > 0).length;
  const points = countToday < C.LIMITS.activityPointsPerDay ? C.POINTS.offlineActivity : 0;
  const log = { _id: oid(), date: d.date, activityKey: a.id, title: a.title, points, createdAt: new Date().toISOString() };
  db.activityLogs = [...db.activityLogs, log].slice(-500);
  if (points) award(points, `Offline: ${a.title}`);
  persist();
  return { log: copy(log), points, progress: refreshProgress(d.date) };
}
export async function activityHistory() {
  return { items: copy([...db.activityLogs].reverse().slice(0, 20)) };
}

// ---------------- community ----------------
export async function getCampus() {
  const joined = new Set(db.joinedEvents);
  return {
    events: C.CAMPUS_EVENTS.map((e) => ({ ...e, joined: joined.has(e.id) })),
    clubs: C.CLUBS.map((c) => ({ ...c, joined: joined.has(c.id) })),
    challenges: C.GROUP_CHALLENGES.map((c) => ({ ...c, joined: joined.has(c.id) })),
  };
}
export async function joinEvent(id, joined) {
  parse(S.joinEvent, { joined });
  db.joinedEvents = joined ? [...new Set([...db.joinedEvents, id])] : db.joinedEvents.filter((x) => x !== id);
  persist();
  return { joinedEvents: copy(db.joinedEvents) };
}

// ---------------- night lock ----------------
export async function getNightLock() {
  return { nightLock: copy(db.nightLock) };
}
export async function saveNightLock(input) {
  const d = parse(S.nightLock, input);
  db.nightLock = { ...db.nightLock, ...d };
  persist();
  return { nightLock: copy(db.nightLock) };
}

// ---------------- devices & push (not available offline) ----------------
export async function listDevices() {
  return { items: [{ deviceId: getDeviceId(), type: getDeviceType(), label: getDeviceLabel(), lastSeenAt: new Date().toISOString(), push: false, online: true }] };
}
export async function registerDevice() {
  return { device: null };
}
export async function removeDevice() {
  return { ok: true };
}
export async function pushPublicKey() {
  return { enabled: false, publicKey: null };
}
export async function testPush() {
  throw new ApiError('Create an account to get notifications on all your devices.', 409);
}

// ---------------- data ownership ----------------
export async function exportData() {
  return { exportedAt: new Date().toISOString(), mode: 'guest', ...copy(db) };
}
export async function deleteAllData() {
  db = emptyDb();
  removeKey(LOCAL_DB_KEY);
  return { ok: true };
}

/** Bundle sent to POST /api/auth/import when a guest creates an account. */
export function buildImportBundle(date = today()) {
  return {
    date,
    points: db.points,
    checkins: db.checkins.map(({ id, ...c }) => c),
    sleepLogs: db.sleepLogs.map(({ date: d, bedtimeGoal, actualBedtime, wakeTime, hoursSlept, checklistDone }) => ({ date: d, bedtimeGoal, actualBedtime, wakeTime, hoursSlept, checklistDone })),
    wins: db.wins.map((w) => ({ date: w.date, items: w.items.slice(0, 3) })),
    goals: db.goals.map((g) => ({ title: g.title, target: g.target, progress: g.progress })),
    focusSessions: db.focusSessions.filter((f) => f.status === 'completed').map((f) => ({ date: f.date, goalText: f.goalText || '', minutes: Math.max(1, Math.min(180, f.actualMinutes || f.plannedMinutes || 25)), demo: !!f.demo })),
    activityLogs: db.activityLogs.map((a) => ({ date: a.date, activityKey: a.activityKey, title: a.title })),
  };
}
export const hasGuestData = () => Boolean(db.checkins.length || db.focusSessions.length || db.sleepLogs.length || db.wins.length || db.points);

/** Fills the app with 7 days of example data for demos and usability tests. */
export async function loadSampleData(date = today()) {
  const ids = (n) => R.addDays(date, -n);
  const hours = [2.75, 3.2, 4.5, 3.9, 6.2, 4.8, 5.5];
  const apps = [['Instagram'], ['YouTube'], ['TikTok'], ['Instagram', 'WhatsApp'], ['YouTube'], ['WhatsApp'], ['Instagram']];
  const moods = ['good', 'okay', 'tired', 'okay', 'stressed', 'okay', 'good'];
  const beds = ['23:40', '00:30', '01:15', '00:45', '01:30', '23:55', '00:20'];
  db.checkins = hours.map((h, i) => ({ id: oid(), date: ids(i), screenHours: h, mainApps: apps[i], bedtime: beds[i], mood: moods[i] })).reverse();
  const goal = db.profile?.bedtimeGoal || '23:00';
  const shift = (hhmm, add) => { const m = (R.timeToMinutes(hhmm) + add + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  db.sleepLogs = [5, 4, 3, 2, 1].map((n, i) => ({ date: ids(n), bedtimeGoal: goal, actualBedtime: shift(goal, [10, 20, 5, 25, 15][i]), hoursSlept: [7.1, 7.5, 7.3, 7.6, 7.2][i], checklistDone: ['charger', 'teeth'], onTarget: true, pointsAwarded: true }));
  const mk = (n, goalText, minutes) => {
    const start = Date.now() - n * 86400000 - 3 * 3600000;
    return { id: oid(), date: ids(n), goalText, startAt: iso(start), endAt: iso(start + minutes * 60000), plannedMinutes: minutes, actualMinutes: minutes, demo: false, status: 'completed', completed: true, completedAt: iso(start + minutes * 60000), pointsAwarded: R.focusPoints(minutes) };
  };
  db.focusSessions = [mk(1, 'Assignment', 25), mk(0, 'UI Design', 25), mk(0, 'Research', 50)];
  db.wins = [
    { _id: oid(), date: ids(2), items: ['Finished the UI mockup', 'Took a 15-minute walk', 'Slept early'] },
    { _id: oid(), date: ids(1), items: ['Three focus blocks', 'Read a book', 'Drank more water'] },
  ];
  db.activityLogs = [
    { _id: oid(), date: ids(3), activityKey: 'cricket', title: 'Play a quick game of cricket', points: 5 },
    { _id: oid(), date: ids(2), activityKey: 'call-family', title: 'Call someone in your family', points: 5 },
    { _id: oid(), date: ids(1), activityKey: 'walk', title: 'Go for a 15 minute walk', points: 5 },
  ];
  if (!db.goals.length) {
    db.goals = [
      { _id: oid(), title: 'Complete 2 focus sessions', target: 2, progress: 2, done: true, createdAt: iso(Date.now()) },
      { _id: oid(), title: 'Keep screen time under 4 hours', target: 1, progress: 0, done: false, createdAt: iso(Date.now()) },
      { _id: oid(), title: 'Take a 15-minute screen break', target: 1, progress: 0, done: false, createdAt: iso(Date.now()) },
    ];
  }
  db.points = Math.max(db.points, 120);
  db.pointsHistory = [{ at: iso(Date.now()), amount: 120, reason: 'Sample data' }];
  persist();
  refreshProgress(date);
  return { ok: true };
}

// ---------------- migration from the first prototype ----------------
/**
 * The first FocusNest prototype stored everything under `focusnest-v1`.
 * Convert it once so existing users keep their check-ins, sleep logs,
 * wins, sessions and points. The old key is left in place as a backup.
 */
export function migrateLegacyData() {
  if (db.profile || readJSON('fn:migrated-v1')) return false;
  const old = readJSON('focusnest-v1');
  if (!old || typeof old !== 'object') return false;
  try {
    const struggleMap = { Scrolling: 'reels', Reels: 'reels', Gaming: 'gaming', Comparison: 'comparison', 'Social comparison': 'comparison', 'Comparing with others': 'comparison', Loneliness: 'lonely', 'Feeling lonely': 'lonely', 'Late nights': 'latenight' };
    const moodMap = (m = '') => (/Good/.test(m) ? 'good' : /Tired/.test(m) ? 'tired' : /Stressed/.test(m) ? 'stressed' : /Low/.test(m) ? 'low' : 'okay');
    const appMap = { Instagram: 'social', TikTok: 'social', YouTube: 'video', PUBG: 'games', 'Other games': 'games' };
    const userType = C.USER_TYPES.includes(old.userType) ? old.userType : 'University student';
    const clock = (t, fb) => (/^\d{1,2}:\d{2}$/.test(t || '') ? t : fb);
    if (old.onboarded) {
      db.profile = {
        ...defaultProfile(),
        name: String(old.name || 'Friend').slice(0, 40),
        userType,
        struggles: struggleMap[old.struggle] ? [struggleMap[old.struggle]] : [],
        theme: ['auto', 'light', 'dark', 'system'].includes(old.theme) ? old.theme : 'auto',
        demoMode: old.demo !== false,
        bedtimeGoal: clock(old.bedtime, '23:00'),
        defaultBreakMinutes: Math.min(120, Math.max(1, Number(old.breakMinutes) || 30)),
        screenGoalHours: Math.min(16, Math.max(0.5, Number(old.screenGoal) || 4)),
      };
    }
    db.checkins = (old.checkins || []).filter((c) => c?.date).map((c) => ({ id: oid(), date: c.date, screenHours: Number(c.screenHours) || 0, mainApps: c.app ? [String(c.app).split(' /')[0]] : [], bedtime: clock(c.bedtime, '23:30'), mood: moodMap(c.mood) }));
    db.sleepLogs = (old.sleeps || []).filter((s) => s?.date).map((s) => ({ date: s.date, bedtimeGoal: clock(s.goal, '23:00'), actualBedtime: clock(s.actual, undefined), hoursSlept: Number(s.hours) || undefined, checklistDone: [], onTarget: !!s.onTarget, pointsAwarded: !!s.onTarget }));
    db.wins = (old.wins || []).filter((w) => w?.date && Array.isArray(w.items)).map((w) => ({ _id: oid(), date: w.date, items: w.items.slice(0, 3).map((x) => String(x).slice(0, 140)) }));
    db.focusSessions = (old.focusSessions || []).filter((f) => f?.date).map((f) => {
      const minutes = Math.max(1, Math.min(180, Number(f.minutes) || 25));
      const start = new Date(`${f.date}T12:00:00`).getTime();
      return { id: oid(), date: f.date, goalText: String(f.goal || '').slice(0, 120), startAt: iso(start), endAt: iso(start + minutes * 60000), plannedMinutes: minutes, actualMinutes: minutes, demo: false, status: 'completed', completed: true, completedAt: iso(start + minutes * 60000), pointsAwarded: 0 };
    });
    db.activityLogs = (old.activityHistory || []).filter((a) => a?.date).map((a) => {
      const match = C.ACTIVITIES.find((x) => x.title.toLowerCase().includes(String(a.label || '').toLowerCase().split(' ').slice(-1)[0] || '~'));
      return { _id: oid(), date: a.date, activityKey: match?.id || 'walk', title: String(a.label || match?.title || 'Offline activity'), points: 0 };
    });
    const nightApps = [...new Set((old.nightApps || []).map((a) => appMap[a]).filter(Boolean))];
    if (nightApps.length) db.nightLock = { ...db.nightLock, apps: nightApps, bedtime: clock(old.bedtime, '23:30') };
    db.points = Math.max(0, Number(old.points) || 0);
    if (db.points) db.pointsHistory = [{ at: new Date().toISOString(), amount: db.points, reason: 'Carried over from the first version' }];
    persist();
    writeJSON('fn:prefs', { ...(readJSON('fn:prefs', {}) || {}), theme: db.profile?.theme || 'auto' });
    writeJSON('fn:migrated-v1', true);
    if (db.profile) refreshProgress();
    return true;
  } catch (err) {
    console.warn('Could not migrate earlier FocusNest data', err);
    return false;
  }
}
