import { User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { verifyToken } from '../utils/tokens.js';

/** Requires `Authorization: Bearer <token>` and loads req.user. */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Please sign in to continue');
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new HttpError(401, 'Your session has expired. Please sign in again');
    }
    const user = await User.findById(payload.sub).select('+tokenVersion');
    if (!user || (user.tokenVersion || 0) !== payload.v) throw new HttpError(401, 'Your session has expired. Please sign in again');
    req.user = user;
    req.userId = user._id;
    req.deviceId = String(req.headers['x-device-id'] || '').slice(0, 64) || null;
    next();
  } catch (err) {
    next(err);
  }
}
