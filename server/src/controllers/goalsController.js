import { Goal } from '../models/index.js';
import { emitToUser } from '../services/realtime.js';
import { notFound } from '../utils/httpError.js';

export async function listGoals(req, res) {
  const items = await Goal.find({ userId: req.userId }).sort({ done: 1, createdAt: -1 }).limit(100).lean();
  res.json({ items });
}
export async function createGoal(req, res) {
  const count = await Goal.countDocuments({ userId: req.userId, done: false });
  if (count >= 30) return res.status(409).json({ error: 'You already have 30 open goals. Finish or remove some first.' });
  const goal = await Goal.create({ ...req.body, userId: req.userId });
  emitToUser(req.userId, 'data:changed', { type: 'goals' });
  res.status(201).json({ goal });
}
export async function updateGoal(req, res) {
  const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
  if (!goal) throw notFound('Goal');
  Object.assign(goal, req.body);
  if (goal.progress > goal.target) goal.progress = goal.target;
  goal.done = goal.progress >= goal.target;
  await goal.save();
  emitToUser(req.userId, 'data:changed', { type: 'goals' });
  res.json({ goal });
}
export async function deleteGoal(req, res) {
  const r = await Goal.deleteOne({ _id: req.params.id, userId: req.userId });
  if (!r.deletedCount) throw notFound('Goal');
  emitToUser(req.userId, 'data:changed', { type: 'goals' });
  res.json({ ok: true });
}
