import { Router } from 'express';
import { schemas } from '../config/validation.js';
import * as auth from '../controllers/authController.js';
import * as dash from '../controllers/dashboardController.js';
import * as checkins from '../controllers/checkinsController.js';
import * as timer from '../controllers/timerController.js';
import * as sleep from '../controllers/sleepController.js';
import * as wins from '../controllers/winsController.js';
import * as goals from '../controllers/goalsController.js';
import * as quests from '../controllers/questsController.js';
import * as activities from '../controllers/activitiesController.js';
import * as campus from '../controllers/campusController.js';
import * as night from '../controllers/nightLockController.js';
import * as devices from '../controllers/devicesController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/httpError.js';

const S = schemas;
const objectIdParams = (req, _res, next) => {
  const r = S.objectId.safeParse(req.params.id);
  return r.success ? next() : next(r.error);
};

// ---------- public ----------
export const publicRouter = Router();
publicRouter.post('/auth/register', authLimiter, validate(S.register), h(auth.register));
publicRouter.post('/auth/login', authLimiter, validate(S.login), h(auth.login));
publicRouter.get('/push/public-key', devices.publicKey);

// ---------- authenticated (Authorization: Bearer <token>) ----------
export const privateRouter = Router();
privateRouter.use(h(requireAuth), writeLimiter);

privateRouter.get('/auth/me', h(auth.me));
privateRouter.patch('/auth/me', validate(S.profileUpdate), h(auth.updateMe));
privateRouter.post('/auth/logout-all', h(auth.logoutAll));
privateRouter.delete('/auth/me', authLimiter, h(auth.deleteMe));
privateRouter.get('/auth/export', h(auth.exportData));
privateRouter.post('/auth/import', h(auth.importGuest));

privateRouter.get('/state', h(dash.state));
privateRouter.get('/dashboard', h(dash.dashboard));

privateRouter.post('/checkins', validate(S.checkIn), h(checkins.saveCheckIn));
privateRouter.get('/checkins', validate(S.range, 'query'), h(checkins.listCheckIns));

privateRouter.get('/timer', h(timer.active));
privateRouter.get('/focus/today', h(timer.todaySessions));
privateRouter.post('/focus', validate(S.focusStart), h(timer.postFocus));
privateRouter.patch('/focus/:id', objectIdParams, validate(S.focusUpdate), h(timer.patchFocus));
privateRouter.post('/breaks', validate(S.breakStart), h(timer.postBreak));
privateRouter.post('/breaks/:id/extend', objectIdParams, validate(S.breakExtend), h(timer.extend));
privateRouter.post('/breaks/:id/close', objectIdParams, validate(S.breakClose), h(timer.close));

privateRouter.get('/sleep/week', h(sleep.getWeek));
privateRouter.post('/sleep', validate(S.sleepLog), h(sleep.saveSleep));

privateRouter.get('/wins', h(wins.listWins));
privateRouter.post('/wins', validate(S.wins), h(wins.addWins));
privateRouter.delete('/wins/:id', objectIdParams, h(wins.deleteWin));

privateRouter.get('/goals', h(goals.listGoals));
privateRouter.post('/goals', validate(S.goalCreate), h(goals.createGoal));
privateRouter.patch('/goals/:id', objectIdParams, validate(S.goalUpdate), h(goals.updateGoal));
privateRouter.delete('/goals/:id', objectIdParams, h(goals.deleteGoal));

privateRouter.get('/quests', h(quests.getQuests));

privateRouter.get('/activities', h(activities.listActivities));
privateRouter.get('/activities/random', h(activities.randomActivity));
privateRouter.get('/activities/history', h(activities.activityHistory));
privateRouter.post('/activities/complete', validate(S.activityDone), h(activities.completeActivity));

privateRouter.get('/campus/events', h(campus.events));
privateRouter.post('/campus/events/:key/join', validate(S.joinEvent), h(campus.join));

privateRouter.get('/nightlock', h(night.getNightLock));
privateRouter.put('/nightlock', validate(S.nightLock), h(night.saveNightLock));

privateRouter.get('/devices', h(devices.listDevices));
privateRouter.post('/devices', validate(S.device), h(devices.registerDevice));
privateRouter.delete('/devices/:deviceId', h(devices.removeDevice));
privateRouter.post('/push/test', h(devices.testPush));

