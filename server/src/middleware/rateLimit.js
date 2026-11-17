import rateLimit from 'express-rate-limit';

const json = (message) => ({ error: message });

/** Login/register: slow down password guessing. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many attempts. Please wait a few minutes and try again.'),
});

/** All write routes. */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
  message: json('You are going a bit fast. Please slow down.'),
});

/** Everything under /api. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Too many requests. Please try again later.'),
});
