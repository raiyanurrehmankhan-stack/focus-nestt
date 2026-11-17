// Prints configuration warnings/errors and stops the process on errors.
// Dependency-free so the exit behaviour can be unit tested with fakes.
export function applyConfig({ config, errors, warnings }, { log = console, exit = (code) => process.exit(code) } = {}) {
  for (const w of warnings) log.warn(`[config] ${w}`);
  if (errors.length) {
    log.error(`[config] FocusNest API cannot start (NODE_ENV=${config.nodeEnv}, ${config.isProd ? 'production rules' : 'relaxed rules'}):`);
    for (const e of errors) log.error(`[config]  - ${e}`);
    log.error('[config] See server/.env.example and the README section "Production configuration".');
    exit(1);
    return null;
  }
  return config;
}
