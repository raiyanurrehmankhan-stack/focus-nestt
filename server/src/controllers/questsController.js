import { buildQuests } from '../services/insightsService.js';
import { refreshProgress } from '../services/pointsService.js';
import { User } from '../models/index.js';
import { clientDate } from '../utils/dates.js';

export async function getQuests(req, res) {
  const today = clientDate(req.query.date);
  await refreshProgress(req.userId, today); // award anything newly completed
  const user = await User.findById(req.userId);
  res.json(await buildQuests(user, today));
}
