import { closeBreak, extendBreak, getActiveTimer, startBreak, startFocus, updateFocus } from '../services/timerService.js';
import { FocusSession } from '../models/index.js';
import { clientDate } from '../utils/dates.js';

export const active = async (req, res) => res.json({ active: await getActiveTimer(req.userId) });
export const postFocus = async (req, res) => res.status(201).json({ timer: await startFocus(req.user, req.body) });
export const patchFocus = async (req, res) => res.json({ timer: await updateFocus(req.user, req.params.id, req.body.action) });
export const postBreak = async (req, res) => res.status(201).json({ timer: await startBreak(req.user, req.body) });
export const extend = async (req, res) => res.json(await extendBreak(req.user, req.params.id, req.body));
export const close = async (req, res) => res.json(await closeBreak(req.user, req.params.id, req.body));

export async function todaySessions(req, res) {
  const date = clientDate(req.query.date);
  const items = await FocusSession.find({ userId: req.userId, date, status: 'completed' }).sort({ completedAt: -1 }).lean();
  res.json({ items: items.map((f) => ({ id: String(f._id), goalText: f.goalText, minutes: f.demo ? 25 : f.actualMinutes || f.plannedMinutes, points: f.pointsAwarded, demo: f.demo, completedAt: f.completedAt })) });
}
