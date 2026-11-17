import { BADGES } from '../../../shared/constants.js';
import { dangerHourInsight, levelInfo, sleepStreak, weeklyQuests, weeklyScreenSeries, weeklySleepSeries } from '../../../shared/rules.js';
import { Badge, CheckIn, FocusSession, Goal, SleepLog } from '../models/index.js';
import { loadProgressData } from './pointsService.js';
import { getActiveTimer } from './timerService.js';

export async function buildDashboard(user, today) {
  const userId = user._id;
  const data = await loadProgressData(userId, today, 30);
  const [todayCheckIn, lastSleep, todayFocus, goals, active] = await Promise.all([
    CheckIn.findOne({ userId, date: today }).lean(),
    SleepLog.findOne({ userId }).sort({ date: -1 }).lean(),
    FocusSession.find({ userId, date: today, status: 'completed' }).sort({ completedAt: -1 }).lean(),
    Goal.find({ userId, done: false }).sort({ createdAt: -1 }).limit(5).lean(),
    getActiveTimer(userId),
  ]);
  const profile = user.toObject();
  return {
    today,
    screenTime: { hours: todayCheckIn?.screenHours ?? null, goalHours: user.screenGoalHours },
    sleep: lastSleep ? { date: lastSleep.date, hours: lastSleep.hoursSlept ?? null, onTarget: lastSleep.onTarget } : null,
    focus: {
      minutes: todayFocus.reduce((s, f) => s + (f.demo ? 25 : f.actualMinutes || f.plannedMinutes), 0),
      sessions: todayFocus.map((f) => ({ id: String(f._id), goalText: f.goalText, minutes: f.demo ? 25 : f.actualMinutes || f.plannedMinutes, points: f.pointsAwarded })),
    },
    goals: goals.map((g) => ({ id: String(g._id), title: g.title, target: g.target, progress: g.progress })),
    weekScreen: weeklyScreenSeries(data.checkins, today),
    weekSleep: weeklySleepSeries(data.sleepLogs, today),
    insight: dangerHourInsight(data.checkins, profile),
    streakDays: user.streakDays,
    sleepStreak: sleepStreak(data.sleepLogs, today),
    points: user.points,
    level: levelInfo(user.points),
    active,
  };
}

export async function buildQuests(user, today) {
  const data = await loadProgressData(user._id, today);
  const badges = await Badge.find({ userId: user._id }).lean();
  const unlocked = Object.fromEntries(badges.map((b) => [b.code, b.unlockedAt]));
  return {
    points: user.points,
    level: levelInfo(user.points),
    quests: weeklyQuests(data, user.toObject(), today),
    badges: BADGES.map((b) => ({ ...b, unlocked: Boolean(unlocked[b.code]), unlockedAt: unlocked[b.code] || null })),
    history: (user.pointsHistory || []).slice(-10).reverse(),
  };
}
