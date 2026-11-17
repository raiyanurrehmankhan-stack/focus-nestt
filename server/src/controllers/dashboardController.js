import { buildDashboard } from '../services/insightsService.js';
import { getActiveTimer } from '../services/timerService.js';
import { pushEnabled } from '../services/pushService.js';
import { env } from '../config/env.js';
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
    capabilities: { push: pushEnabled, vapidPublicKey: env.vapid.publicKey || null },
  });
}
