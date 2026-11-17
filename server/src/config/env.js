import 'dotenv/config';
import { applyConfig } from './startup.js';
import { validateEnv } from './validateEnv.js';

// All checks live in validateEnv.js (dependency-free and unit tested).
// Strict (production) rules refuse to start on unsafe settings; development
// and test only warn.
export const env = applyConfig(validateEnv(process.env));
