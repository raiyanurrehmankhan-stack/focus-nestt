import { Win } from '../models/index.js';
import { refreshProgress } from '../services/pointsService.js';
import { emitToUser } from '../services/realtime.js';
import { notFound } from '../utils/httpError.js';

export async function listWins(req, res) {
  const items = await Win.find({ userId: req.userId }).sort({ date: -1, createdAt: -1 }).limit(60).lean();
  res.json({ items });
}

export async function addWins(req, res) {
  const { date, items } = req.body;
  // One journal entry per day; saving again replaces that day's wins.
  const win = await Win.findOneAndUpdate({ userId: req.userId, date }, { userId: req.userId, date, items }, { upsert: true, new: true });
  const progress = await refreshProgress(req.userId, date);
  emitToUser(req.userId, 'data:changed', { type: 'wins' });
  res.status(201).json({ win, progress });
}

export async function deleteWin(req, res) {
  const r = await Win.deleteOne({ _id: req.params.id, userId: req.userId });
  if (!r.deletedCount) throw notFound('Entry');
  res.json({ ok: true });
}
