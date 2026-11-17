// Allowed-origin parsing and matching for CORS. Dependency-free, so it can be
// unit tested without installing the server's packages.
//
// CORS_ORIGIN  Comma-separated EXACT origins, e.g.
//              https://focus-nestt.vercel.app,https://focus-nestt-git-staging-yourscope.vercel.app
//
// Only exact origins are supported. Wildcards ("*") and pattern matching are
// intentionally NOT supported: on shared hosting domains such as vercel.app
// anyone can create projects, so a pattern can be matched by a site you do
// not own (name squatting). List each trusted origin explicitly instead.
//
// CORS is not authentication: it only tells browsers which sites may read API
// responses. Every API route still requires a valid sign-in token, and CORS
// does not protect or hide preview deployments.

/**
 * Parses one exact origin. Returns { origin } or { error }.
 * The value must already be canonical (scheme://host[:port], lowercase), which
 * rejects paths, query strings, fragments, trailing slashes and credentials.
 */
export function parseOrigin(raw, { requireHttps = false } = {}) {
  const value = String(raw ?? '').trim();
  if (!value) return { error: 'empty origin' };
  if (value.includes('*')) return { error: `"${value}" contains a wildcard; wildcards are not supported, list each origin exactly` };
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

const splitList = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/**
 * Reads CORS_ORIGIN. `strict` (production rules) requires the variable and
 * https origins. Returns { origins, errors, warnings }.
 */
export function parseCorsConfig({ CORS_ORIGIN, CORS_ORIGIN_PATTERNS } = {}, { strict = true } = {}) {
  const errors = [];
  const warnings = [];
  const origins = [];

  if (String(CORS_ORIGIN_PATTERNS ?? '').trim()) {
    errors.push('CORS_ORIGIN_PATTERNS is not supported (wildcard origins can be matched by sites you do not own). Remove it and list each trusted origin exactly in CORS_ORIGIN.');
  }

  const listed = splitList(CORS_ORIGIN);
  if (!listed.length) {
    if (strict) {
      errors.push('CORS_ORIGIN is required in production. Set it to your web app origin(s), e.g. CORS_ORIGIN=https://focus-nestt.vercel.app');
    } else {
      origins.push('http://localhost:5173', 'http://localhost:4173');
      warnings.push('CORS_ORIGIN is not set; allowing http://localhost:5173 and http://localhost:4173 for local development only.');
    }
  }
  for (const item of listed) {
    if (item === '*') {
      errors.push('CORS_ORIGIN must not be "*" (intentionally refused in every environment); list your web app origins exactly.');
      continue;
    }
    const r = parseOrigin(item, { requireHttps: strict });
    if (r.error) errors.push(`CORS_ORIGIN: ${r.error}`);
    else if (!origins.includes(r.origin)) origins.push(r.origin);
  }
  return { origins, errors, warnings };
}

/**
 * The single origin check used by Express CORS and Socket.IO.
 * Requests without an Origin header (same-origin, server-to-server, health
 * checks) are allowed; browsers always send Origin on cross-origin requests.
 */
export function createOriginMatcher({ origins = [] } = {}) {
  const exact = new Set(origins);
  return function isOriginAllowed(origin) {
    if (origin === undefined || origin === null || origin === '') return true;
    if (typeof origin !== 'string') return false;
    return exact.has(origin);
  };
}

/** Adapter for the `cors` package (Express and Socket.IO's polling transport). */
export function corsOriginOption(isOriginAllowed) {
  return (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(Object.assign(new Error('Origin not allowed by CORS'), { status: 403 }));
  };
}

/**
 * Adapter for Socket.IO's `allowRequest` option. Engine.IO calls it for the
 * handshake and for WebSocket upgrades; browsers do not apply CORS to
 * WebSockets, so this is what blocks cross-site WebSocket connections.
 */
export function socketAllowRequest(isOriginAllowed) {
  return (req, callback) => callback(null, isOriginAllowed(req?.headers?.origin));
}
