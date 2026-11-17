import 'dotenv/config';
import { validateEnv } from './validateEnv.js';

// All checks live in validateEnv.js (dependency-free and unit tested).
// Production refuses to start on unsafe settings; development only warns.
const { config, errors, warnings } = validateEnv(process.env);

for (const w of warnings) console.warn(`[config] ${w}`);
if (errors.length) {
  console.error(`[config] FocusNest API cannot start (${config.isProd ? 'production' : 'development'}):`);
  for (const e of errors) console.error(`[config]  - ${e}`);
  console.error('[config] See server/.env.example and the README section "Production configuration".');
  process.exit(1);
}

export const env = config;
