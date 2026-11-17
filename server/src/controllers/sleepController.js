import { POINTS } from '../../../shared/constants.js';
import { isBedtimeOnTarget, sleepStreak, weeklySleepSeries } from '../../../shared/rules.js';
import { SleepLog } from '../models/index.js';
import { awardPoints, refreshProgress } from '../services/pointsService.js';
import { emitToUser } from '../services/realtime.js';
import { clientDate, windowFrom } from '../utils/dates.js';

export async function getWeek(req, res) {
  const today = clientDate(req.query.date);
  const logs = await SleepLog.find({ userId: req.userId, date: { $gte: windowFrom(today, 60) } }).sort({ date: 1 }).lean();
  res.json({
    today: logs.find((l) => l.date === today) || null,
    week: weeklySleepSeries(logs, today),
    streak: sleepStreak(logs, today),
    bestStreak: req.user.bestSleepStreak,
    history: logs.slice(-60).map((l) => ({ date: l.date, onTarget: l.onTarget, hoursSlept: l.hoursSlept, actualBedtime: l.actualBedtime })),
    bedtimeGoal: req.user.bedtimeGoal,
  });
}

export async function saveSleep(req, res) {
  const { date, ...fields } = req.body;
  const userId = req.userId;
  const existing = await SleepLog.findOne({ userId, date });
  const doc = existing || new SleepLog({ userId, date });
  Object.assign(doc, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)));
  doc.bedtimeGoal = doc.bedtimeGoal || req.user.bedtimeGoal;
  doc.onTarget = doc.actualBedtime ? isBedtimeOnTarget(doc.bedtimeGoal, doc.actualBedtime) : false;
  let points = 0;
  if (doc.onTarget && !doc.pointsAwarded) {
    doc.pointsAwarded = true;
    points = POINTS.bedtimeOnTarget;
  }
  await doc.save();
  if (points) await awardPoints(userId, points, 'Bedtime on target');
  const progress = await refreshProgress(userId, date);
  emitToUser(userId, 'data:changed', { type: 'sleep' });
  res.status(201).json({ sleepLog: doc, points, progress });
}
