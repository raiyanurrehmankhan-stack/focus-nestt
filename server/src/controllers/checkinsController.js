import { CheckIn } from '../models/index.js';
import { refreshProgress } from '../services/pointsService.js';
import { emitToUser } from '../services/realtime.js';
import { windowFrom } from '../utils/dates.js';
import { toDateKey } from '../../../shared/rules.js';

export async function saveCheckIn(req, res) {
  const { date, ...fields } = req.body;
  const doc = await CheckIn.findOneAndUpdate({ userId: req.userId, date }, { ...fields, userId: req.userId, date }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const progress = await refreshProgress(req.userId, date);
  emitToUser(req.userId, 'data:changed', { type: 'checkin' });
  res.status(201).json({ checkIn: doc, progress });
}

export async function listCheckIns(req, res) {
  const to = req.validQuery?.to || toDateKey();
  const from = req.validQuery?.from || windowFrom(to, 30);
  const items = await CheckIn.find({ userId: req.userId, date: { $gte: from, $lte: to } }).sort({ date: -1 }).limit(400).lean();
  res.json({ items });
}
