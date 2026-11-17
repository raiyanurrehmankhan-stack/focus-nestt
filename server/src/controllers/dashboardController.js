import { buildDashboard } from '../services/insightsService.js';
import { getActiveTimer } from '../services/timerService.js';
import { mailEnabled } from '../services/mailService.js';
import { pushEnabled, pushPublicKey } from '../services/pushService.js';
import { clientDate } from '../utils/dates.js';

export async function dashboard(req, res) {
  res.json(await buildDashboard(req.user, clientDate(req.query.date)));
}

/** Small bootstrap payload: profile + active timer + server capabilities. */
export async function state(req, res) {
  res.json({
    user: req.user.toPublic(),
    active: await getActiveTimer(req.userId),
    serverTime: Date.now(),
    capabilities: { push: pushEnabled, vapidPublicKey: pushPublicKey(), email: mailEnabled },
  });
}
