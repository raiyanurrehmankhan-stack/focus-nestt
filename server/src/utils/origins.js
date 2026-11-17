// Allowed-origin parsing and matching for CORS. Dependency-free, so it can be
// unit tested without installing the server's packages.
//
// CORS_ORIGIN           Comma-separated exact origins, e.g.
//                       https://focus-nestt.vercel.app,https://focusnest.example.org
// CORS_ORIGIN_PATTERNS  Optional, comma-separated wildcard patterns for Vercel
//                       preview URLs, e.g. https://focus-nestt-*-myteam.vercel.app
//
// Patterns are deliberately limited (not free-form regular expressions):
//   - https only, host only (no port, path, query or fragment)
//   - exactly one "*", inside the first DNS label only
//   - the "*" must sit between literal text: at least 3 characters before it
//     and at least 3 after it (e.g. "focus-nestt-*-myteam"), so patterns such
//     as "*.vercel.app" or "https://*-x.vercel.app" are refused
//   - "*" matches one or more of [a-z0-9-] and never crosses a dot
// Each pattern compiles to an anchored regular expression (^…$).

const WILDCARD = '[a-z0-9-]+';
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parses one exact origin. Returns { origin } or { error }.
 * Requires the value to already be in canonical form (scheme://host[:port]),
 * which rejects paths, query strings, fragments, trailing slashes and
 * credentials.
 */
export function parseOrigin(raw, { requireHttps = false } = {}) {
  const value = String(raw ?? '').trim();
  if (!value) return { error: 'empty origin' };
  if (value.includes('*')) return { error: `"${value}" contains a wildcard; use CORS_ORIGIN_PATTERNS for preview URLs` };
  let url;
  try {
    url = new URL(value);
  } catch {
    return { error: `"${value}" is not a valid URL origin (expected e.g. https://your-app.vercel.app)` };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: `"${value}" must start with https://` };
  if (requireHttps && url.protocol !== 'https:') return { error: `"${value}" must use https:// in production` };
  if (url.username || url.password) return { error: `"${value}" must not contain credentials` };
  if (value.endsWith('/')) return { error: `"${value}" must not end with a slash` };
  if (url.pathname !== '/' || url.search || url.hash) return { error: `"${value}" must not contain a path, query string or fragment` };
  if (value !== url.origin) return { error: `"${value}" is not in canonical form; use "${url.origin}"` };
  return { origin: url.origin };
}

/** Parses one wildcard pattern. Returns { pattern, regex } or { error }. */
export function parseOriginPattern(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { error: 'empty pattern' };
  const m = /^https:\/\/([a-z0-9*.-]+)$/.exec(value);
  if (!m) return { error: `"${value}" must look like https://name-*-team.example.com (https, lowercase host only, no path or port)` };
  const host = m[1];
  const labels = host.split('.');
  if (labels.some((l) => !l)) return { error: `"${value}" has an empty domain label` };
  const stars = (host.match(/\*/g) || []).length;
  if (stars !== 1) return { error: `"${value}" must contain exactly one "*"` };
  if (!labels[0].includes('*')) return { error: `"${value}": the "*" is only allowed in the first part of the host name` };
  if (labels.length < 3) return { error: `"${value}" is too broad; include your app's full domain` };
  const [before, after] = labels[0].split('*');
  if (before.length < 3 || after.length < 3) return { error: `"${value}" is too broad; put at least 3 fixed characters on both sides of "*"` };
  const regex = new RegExp(`^https://${escapeRegex(before)}${WILDCARD}${escapeRegex(after)}${escapeRegex(`.${labels.slice(1).join('.')}`)}$`);
  return { pattern: value, regex };
}

const splitList = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/**
 * Reads CORS_ORIGIN / CORS_ORIGIN_PATTERNS.
 * Returns { origins, patterns, errors, warnings }.
 */
export function parseCorsConfig({ CORS_ORIGIN, CORS_ORIGIN_PATTERNS } = {}, { production = false } = {}) {
  const errors = [];
  const warnings = [];
  const origins = [];
  const patterns = [];

  const listed = splitList(CORS_ORIGIN);
  if (!listed.length) {
    if (production) {
      errors.push('CORS_ORIGIN is required in production. Set it to your web app origin(s), e.g. CORS_ORIGIN=https://focus-nestt.vercel.app');
    } else {
      origins.push('http://localhost:5173', 'http://localhost:4173');
      warnings.push('CORS_ORIGIN is not set; allowing http://localhost:5173 and http://localhost:4173 for development only.');
    }
  }
  for (const item of listed) {
    if (item === '*') {
      errors.push('CORS_ORIGIN must not be "*"; list your web app origins explicitly.');
      continue;
    }
    const r = parseOrigin(item, { requireHttps: production });
    if (r.error) errors.push(`CORS_ORIGIN: ${r.error}`);
    else if (!origins.includes(r.origin)) origins.push(r.origin);
  }
  for (const item of splitList(CORS_ORIGIN_PATTERNS)) {
    const r = parseOriginPattern(item);
    if (r.error) errors.push(`CORS_ORIGIN_PATTERNS: ${r.error}`);
    else patterns.push(r);
  }
  return { origins, patterns, errors, warnings };
}

/**
 * The single origin check used by both Express CORS and Socket.IO.
 * Requests without an Origin header (same-origin, server-to-server, health
 * checks) are allowed; browsers always send Origin on cross-origin requests.
 */
export function createOriginMatcher({ origins = [], patterns = [] } = {}) {
  const exact = new Set(origins);
  const regexes = patterns.map((p) => p.regex);
  return function isOriginAllowed(origin) {
    if (origin === undefined || origin === null || origin === '') return true;
    if (typeof origin !== 'string' || origin.length > 253 + 16) return false;
    if (exact.has(origin)) return true;
    return regexes.some((re) => re.test(origin));
  };
}

/** Adapter for the `cors` package / Socket.IO `cors.origin` option. */
export function corsOriginOption(isOriginAllowed) {
  return (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(Object.assign(new Error('Origin not allowed by CORS'), { status: 403 }));
  };
}
