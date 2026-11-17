// Pure business rules shared by the API (Node.js) and the web app's offline
// guest mode. No I/O and no dependencies, so it is easy to unit test.
//
// All "date" values are local calendar days as 'YYYY-MM-DD' strings supplied
// by the user's device, so streaks and "today" follow the user's own clock.
import { BADGES, LEVEL_NAMES, LIMITS, POINTS } from './constants.js';

// ---------- dates ----------
export const toDateKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const parseDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (key, n) => {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
};
/** Monday of the week containing `key` (ISO weeks start on Monday). */
export const weekStart = (key) => {
  const d = parseDateKey(key);
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(key, -day);
};
export const weekId = (key) => weekStart(key);
export const inRange = (key, from, to) => key >= from && key <= to;
export const lastNDays = (today, n) => Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));

// ---------- time of day ----------
export const timeToMinutes = (hhmm) => {
  if (typeof hhmm !== 'string' || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
/** Smallest distance between two clock times in minutes (wraps midnight). */
export const clockDistance = (a, b) => {
  const x = timeToMinutes(a), y = timeToMinutes(b);
  if (x == null || y == null) return null;
  const diff = Math.abs(x - y);
  return Math.min(diff, 1440 - diff);
};
/** Bedtime counts as on target within 30 minutes of the goal (either side). */
export const isBedtimeOnTarget = (goal, actual) => {
  const d = clockDistance(goal, actual);
  return d != null && d <= 30;
};
/** Minutes after 6 PM, so that late-night times sort after evening times. */
export const nightOrder = (hhmm) => {
  const m = timeToMinutes(hhmm);
  if (m == null) return null;
  return (m - 18 * 60 + 1440) % 1440;
};
export const formatClock = (hhmm) => {
  const m = timeToMinutes(hhmm);
  if (m == null) return hhmm || '';
  const h = Math.floor(m / 60), mm = m % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
};

// ---------- points & levels ----------
export const focusPoints = (minutes, { demo = false } = {}) => {
  if (demo) return POINTS.focusPer25; // a demo session stands in for one 25-minute block
  const blocks = Math.floor((Number(minutes) || 0) / 25);
  return Math.max(0, blocks) * POINTS.focusPer25;
};
export const levelInfo = (points = 0) => {
  const per = POINTS.pointsPerLevel;
  const level = Math.floor(Math.max(0, points) / per) + 1;
  const name = LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1];
  const intoLevel = Math.max(0, points) % per;
  return { level, name, intoLevel, toNext: per - intoLevel, progress: intoLevel / per, perLevel: per };
};

// ---------- streaks ----------
/**
 * Sleep streak: consecutive days ending today (or yesterday, if today has not
 * been logged yet) where the bedtime was on target.
 */
export const sleepStreak = (sleepLogs = [], today = toDateKey()) => {
  const good = new Set(sleepLogs.filter((s) => s.onTarget).map((s) => s.date));
  let day = good.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (good.has(day)) { n++; day = addDays(day, -1); }
  return n;
};
/** Activity streak: consecutive days with any healthy action (check-in, focus, sleep, win). */
export const activityStreak = (data, today = toDateKey()) => {
  const days = new Set([
    ...(data.checkins || []).map((x) => x.date),
    ...(data.focusSessions || []).filter((x) => x.completed).map((x) => x.date),
    ...(data.sleepLogs || []).map((x) => x.date),
    ...(data.wins || []).map((x) => x.date),
    ...(data.activityLogs || []).map((x) => x.date),
  ]);
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) { n++; day = addDays(day, -1); }
  return n;
};

// ---------- insights ----------
/**
 * Danger-hour insight from check-ins. Uses the time the user put the phone
 * down at night and the reported screen hours. Returns a short, positive,
 * plain-language message.
 */
export const dangerHourInsight = (checkins = [], profile = {}) => {
  const recent = [...checkins].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14);
  if (recent.length < 2) {
    if (profile.dangerTime) return { level: 'info', title: 'Your danger time', message: `You said ${String(profile.dangerTime).toLowerCase()} is your hardest time. Plan a break or activity before it starts.`, hour: null };
    return { level: 'info', title: 'Insight', message: 'Check in for a few days and FocusNest will show when your screen time peaks.', hour: null };
  }
  const late = recent.filter((c) => { const m = nightOrder(c.bedtime); return m != null && m >= 6 * 60; }); // after 12 AM
  const lateShare = late.length / recent.length;
  const buckets = {};
  for (const c of recent) {
    const m = timeToMinutes(c.bedtime);
    if (m == null) continue;
    const h = Math.floor(m / 60);
    buckets[h] = (buckets[h] || 0) + 1;
  }
  const [peakHour] = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0] || [null];
  const avg = recent.reduce((s, c) => s + (Number(c.screenHours) || 0), 0) / recent.length;
  if (lateShare >= 0.5) {
    return { level: 'warning', title: 'Danger hour', message: 'Most of your screen time happens after 12 AM. Try starting your wind-down 30 minutes earlier.', hour: Number(peakHour), lateShare, avgHours: avg };
  }
  if (peakHour != null && Number(peakHour) >= 22) {
    return { level: 'warning', title: 'Danger hour', message: `Your phone usually goes down around ${formatClock(`${peakHour}:00`)}. A charger across the room can help.`, hour: Number(peakHour), lateShare, avgHours: avg };
  }
  return { level: 'success', title: 'Nice rhythm', message: `You usually put the phone down by ${formatClock(`${peakHour}:00`)}. Keep protecting your sleep!`, hour: Number(peakHour), lateShare, avgHours: avg };
};

/** Last 7 days of reported screen hours (0 when no check-in that day). */
export const weeklyScreenSeries = (checkins = [], today = toDateKey()) => {
  const byDate = Object.fromEntries(checkins.map((c) => [c.date, Number(c.screenHours) || 0]));
  return lastNDays(today, 7).map((date) => ({
    date,
    day: parseDateKey(date).toLocaleDateString('en-US', { weekday: 'short' }),
    hours: byDate[date] ?? null,
  }));
};

export const weeklySleepSeries = (sleepLogs = [], today = toDateKey()) => {
  const byDate = Object.fromEntries(sleepLogs.map((s) => [s.date, s]));
  return lastNDays(today, 7).map((date) => ({
    date,
    day: parseDateKey(date).toLocaleDateString('en-US', { weekday: 'short' }),
    hours: byDate[date]?.hoursSlept ?? null,
    onTarget: !!byDate[date]?.onTarget,
  }));
};

// ---------- quests ----------
const QUEST_LIBRARY = {
  'sleep-before-12': { title: 'Sleep before 12 AM', description: 'Put the phone down before midnight on 3 nights', target: 3, reward: 100, unit: 'nights' },
  'mindful-morning': { title: 'The Mindful Morning', description: 'Complete 3 focus sessions this week', target: 3, reward: 100, unit: 'sessions' },
  'snooze-master': { title: 'Snooze Master', description: 'Hit your bedtime goal on 5 nights', target: 5, reward: 150, unit: 'nights' },
  'weekend-warrior': { title: 'Weekend Warrior', description: 'Log 60 minutes of focus over Saturday and Sunday', target: 60, reward: 200, unit: 'min' },
  'under-limit': { title: 'Under the Limit', description: 'Check in 4 days with screen time under your daily goal', target: 4, reward: 120, unit: 'days' },
  'game-over-on-time': { title: 'Game Over, On Time', description: 'Return from 3 breaks on time', target: 3, reward: 100, unit: 'breaks' },
  'my-own-race': { title: 'My Own Race', description: 'Write your wins on 4 days', target: 4, reward: 100, unit: 'days' },
  'real-connections': { title: 'Real Connections', description: 'Complete 3 offline activities', target: 3, reward: 100, unit: 'activities' },
};
const STRUGGLE_QUEST = {
  reels: 'under-limit', gaming: 'game-over-on-time', comparison: 'my-own-race', lonely: 'real-connections', latenight: 'sleep-before-12',
};

/** Weekly quests are generated from the quiz answers (struggles). */
export const questCodesFor = (struggles = []) => {
  const codes = ['mindful-morning', 'snooze-master', 'weekend-warrior'];
  for (const s of struggles) {
    const c = STRUGGLE_QUEST[s];
    if (c && !codes.includes(c)) codes.push(c);
  }
  if (codes.length < 4) codes.push('sleep-before-12');
  return codes.slice(0, 5);
};

export const questProgress = (code, data, today = toDateKey(), profile = {}) => {
  const from = weekStart(today), to = addDays(from, 6);
  const wk = (arr = []) => arr.filter((x) => x && inRange(x.date, from, to));
  switch (code) {
    case 'sleep-before-12':
      return wk(data.sleepLogs).filter((s) => { const m = nightOrder(s.actualBedtime); return m != null && m < 6 * 60; }).length;
    case 'mindful-morning':
      return wk(data.focusSessions).filter((f) => f.completed).length;
    case 'snooze-master':
      return wk(data.sleepLogs).filter((s) => s.onTarget).length;
    case 'weekend-warrior': {
      const sat = addDays(from, 5), sun = addDays(from, 6);
      return wk(data.focusSessions).filter((f) => f.completed && (f.date === sat || f.date === sun)).reduce((s, f) => s + (f.demo ? 25 : Number(f.actualMinutes || f.plannedMinutes) || 0), 0);
    }
    case 'under-limit': {
      const goal = Number(profile.screenGoalHours) || 4;
      return wk(data.checkins).filter((c) => Number(c.screenHours) <= goal).length;
    }
    case 'game-over-on-time':
      return wk(data.breaks).filter((b) => b.returnedOnTime).length;
    case 'my-own-race':
      return new Set(wk(data.wins).map((w) => w.date)).size;
    case 'real-connections':
      return wk(data.activityLogs).length;
    default:
      return 0;
  }
};

export const weeklyQuests = (data, profile = {}, today = toDateKey()) => {
  const id = weekId(today);
  const claimed = new Set((profile.questAwards || []).filter((a) => a.weekId === id).map((a) => a.code));
  return questCodesFor(profile.struggles).map((code) => {
    const q = QUEST_LIBRARY[code];
    const value = questProgress(code, data, today, profile);
    const done = value >= q.target;
    return { code, weekId: id, ...q, value: Math.min(value, q.target), percent: Math.round(Math.min(1, value / q.target) * 100), completed: done, rewarded: claimed.has(code) };
  });
};

/** Quests that are complete but not yet rewarded this week. */
export const pendingQuestRewards = (data, profile, today = toDateKey()) =>
  weeklyQuests(data, profile, today).filter((q) => q.completed && !q.rewarded);

// ---------- badges ----------
export const evaluateBadges = (data, profile = {}, today = toDateKey()) => {
  const completedFocus = (data.focusSessions || []).filter((f) => f.completed).length;
  const streak = Math.max(sleepStreak(data.sleepLogs, today), Number(profile.bestSleepStreak) || 0);
  const winDays = new Set((data.wins || []).map((w) => w.date)).size;
  const checks = {
    'first-flight': completedFocus >= 1,
    'early-bird': streak >= 3,
    'night-owl-tamed': streak >= 7,
    'consistency-king': streak >= 14,
    'deep-thinker': completedFocus >= 10,
    'weekly-hero': (profile.questAwards || []).length >= 1,
    'offline-explorer': (data.activityLogs || []).length >= 5,
    'grateful-heart': winDays >= 7,
    'century-club': (Number(profile.points) || 0) >= 1000,
  };
  return BADGES.filter((b) => checks[b.code]).map((b) => b.code);
};

// ---------- breaks ----------
/** A return counts as on time when it happens within 2 minutes of the break end. */
export const returnedOnTime = (endAt, returnedAt) => new Date(returnedAt).getTime() <= new Date(endAt).getTime() + 2 * 60 * 1000;
export const canExtend = (extensions = []) => extensions.length < LIMITS.maxExtensionsPerBreak;

export const remainingMs = (timer, now = Date.now()) => {
  if (!timer) return 0;
  if (timer.status === 'paused') return Math.max(0, Number(timer.pausedRemainingMs) || 0);
  return Math.max(0, new Date(timer.endAt).getTime() - now);
};
