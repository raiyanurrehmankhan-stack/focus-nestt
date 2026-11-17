import { LIMITS, POINTS } from '../../../shared/constants.js';
import { Activity, ActivityLog } from '../models/index.js';
import { awardPoints, refreshProgress } from '../services/pointsService.js';
import { emitToUser } from '../services/realtime.js';
import { notFound } from '../utils/httpError.js';

const pub = (a) => ({ id: a.key, title: a.title, description: a.description, minutes: a.minutes, category: a.category, emoji: a.emoji });

export async function listActivities(_req, res) {
  res.json({ items: (await Activity.find().lean()).map(pub) });
}

export async function randomActivity(req, res) {
  const match = {};
  if (req.query.category) match.category = String(req.query.category);
  if (req.query.exclude) match.key = { $ne: String(req.query.exclude) };
  const [a] = await Activity.aggregate([{ $match: match }, { $sample: { size: 1 } }]);
  if (!a) throw notFound('Activity');
  res.json({ activity: pub(a) });
}

export async function completeActivity(req, res) {
  const { date, activityId } = req.body;
  const activity = await Activity.findOne({ key: activityId }).lean();
  if (!activity) throw notFound('Activity');
  const todayCount = await ActivityLog.countDocuments({ userId: req.userId, date, points: { $gt: 0 } });
  const points = todayCount < LIMITS.activityPointsPerDay ? POINTS.offlineActivity : 0;
  const log = await ActivityLog.create({ userId: req.userId, date, activityKey: activity.key, title: activity.title, points });
  if (points) await awardPoints(req.userId, points, `Offline: ${activity.title}`);
  const progress = await refreshProgress(req.userId, date);
  emitToUser(req.userId, 'data:changed', { type: 'activities' });
  res.status(201).json({ log, points, progress });
}

export async function activityHistory(req, res) {
  const items = await ActivityLog.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ items });
}
