import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), v: user.tokenVersion || 0 }, env.jwtSecret, { expiresIn: env.jwtExpiresIn, algorithm: 'HS256' });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
