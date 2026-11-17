import { BADGES } from '../../../shared/constants.js';
import { evaluateBadges, levelInfo, pendingQuestRewards, sleepStreak, activityStreak, weekStart, addDays } from '../../../shared/rules.js';
import { ActivityLog, Badge, BreakSession, CheckIn, FocusSession, SleepLog, User, Win } from '../models/index.js';
import { emitToUser } from './realtime.js';

/** Atomically add points and keep a short history for the UI. */
export async function awardPoints(userId, amount, reason) {
  if (!amount) return null;
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { points: amount }, $push: { pointsHistory: { $each: [{ at: new Date(), amount, reason }], $slice: -30 } } },
    { new: true },
  );
  if (user) {
    const lvl = levelInfo(user.points).level;
    if (lvl !== user.level) await User.updateOne({ _id: userId }, { level: lvl });
  }
  return user;
}

/** Loads the data the shared rules need (enough history for streaks and this week's quests). */
export async function loadProgressData(userId, today, days = 60) {
  const from = addDays(today, -(days - 1));
  const wk = weekStart(today);
  const since = from < wk ? from : wk;
  const q = { userId, date: { $gte: since } };
  const [checkins, focusSessions, breaks, sleepLogs, wins, activityLogs] = await Promise.all([
    CheckIn.find(q).lean(),
    FocusSession.find({ ...q, status: 'completed' }).lean(),
    BreakSession.find({ ...q, status: 'closed' }).lean(),
    SleepLog.find(q).lean(),
    Win.find(q).lean(),
    ActivityLog.find(q).lean(),
  ]);
  return { checkins, focusSessions, breaks, sleepLogs, wins, activityLogs };
}

/**
 * Re-evaluates quests, badges and streaks after any change, awards quest
 * rewards once per week and unlocks new badges. Emits `progress:updated`.
 */
export async function refreshProgress(userId, today) {
  let user = await User.findById(userId);
  if (!user) return null;
  const data = await loadProgressData(userId, today);

  // Weekly quest rewards (once per quest per week)
  const rewards = pendingQuestRewards(data, user.toObject(), today);
  for (const q of rewards) {
    const res = await User.updateOne(
      { _id: userId, questAwards: { $not: { $elemMatch: { weekId: q.weekId, code: q.code } } } },
      { $push: { questAwards: { weekId: q.weekId, code: q.code } } },
    );
    if (res.modifiedCount) await awardPoints(userId, q.reward, `Quest: ${q.title}`);
  }

  // Streaks
  const sStreak = sleepStreak(data.sleepLogs, today);
  const aStreak = activityStreak(data, today);
  user = await User.findByIdAndUpdate(userId, { streakDays: aStreak, $max: { bestSleepStreak: sStreak } }, { new: true });

  // Badges
  const earned = evaluateBadges(data, user.toObject(), today);
  const have = new Set((await Badge.find({ userId }).lean()).map((b) => b.code));
  const fresh = earned.filter((c) => !have.has(c));
  if (fresh.length) await Badge.insertMany(fresh.map((code) => ({ userId, code })), { ordered: false }).catch(() => {});

  const summary = {
    points: user.points,
    level: levelInfo(user.points),
    streakDays: aStreak,
    sleepStreak: sStreak,
    newBadges: fresh.map((c) => BADGES.find((b) => b.code === c)),
    questRewards: rewards.map((q) => ({ code: q.code, title: q.title, reward: q.reward })),
  };
  emitToUser(userId, 'progress:updated', summary);
  return summary;
}
