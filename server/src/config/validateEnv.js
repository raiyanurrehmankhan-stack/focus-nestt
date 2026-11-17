// Validates the API's environment variables. Pure and dependency-free (only
// Node built-ins), so it can be unit tested without the server's packages.
//
//   const { config, errors, warnings } = validateEnv(process.env);
//
// Environment modes (NODE_ENV), failing closed:
//   production  strict rules (also used when NODE_ENV is unset)
//   development relaxed rules for local work
//   test        relaxed rules for automated tests
//   anything else (e.g. "Production", "prod", "staging") is a start-up error,
//   so a typo can never switch production into relaxed mode.
// Strict mode turns anything unsafe into an error and the server refuses to
// start. Relaxed mode warns and uses safe fallbacks. Secret values are never
// included in messages.
import { createECDH, randomBytes } from 'node:crypto';
import { createOriginMatcher, parseCorsConfig } from '../utils/origins.js';

export const ENV_MODES = ['production', 'development', 'test'];
export const JWT_MIN_LENGTH = 32;
export const JWT_MIN_DISTINCT_CHARS = 10;
const JWT_HELP = 'Generate one with: openssl rand -base64 32';

// Substrings that mark a copied placeholder rather than a real secret.
// Matched case-insensitively, so every marker is either at least 7 letters
// long or contains "-"/"_" (which standard base64 never produces). That keeps
// genuinely random secrets — e.g. Render's generated base64 values — from
// matching by chance (measured: 0 of 1,000,000; with the 5-letter "dummy" it
// was about 1 in 200,000).
const PLACEHOLDER_PARTS = ['change-me', 'changeme', 'change_me', 'replace-me', 'replaceme', 'your-secret', 'your_secret', 'yoursecret', 'example', 'placeholder', 'dummy-', 'dummy_', '-dummy', '_dummy'];
// Well-known default values (compared case-insensitively).
const KNOWN_DEFAULTS = new Set(['secret', 'jwt-secret', 'jwt_secret', 'jwtsecret', 'supersecret', 'super-secret', 'mysecret', 'my-secret', 'password', 'focusnest', 'default', 'test', 'testing', 'development', 'keyboard cat', 'shhhhh', '12345678901234567890123456789012']);

/**
 * Resolves NODE_ENV. Returns { mode, strict, error?, warning? }.
 * Unset → production rules. Unknown or differently-capitalised → error.
 */
export function resolveMode(nodeEnv) {
  const raw = nodeEnv === undefined || nodeEnv === null ? '' : String(nodeEnv);
  if (raw.trim() === '') {
    return { mode: 'production', strict: true, warning: 'NODE_ENV is not set; applying production rules. Set NODE_ENV=development for local work.' };
  }
  if (ENV_MODES.includes(raw)) return { mode: raw, strict: raw === 'production' };
  const hint = ENV_MODES.find((m) => m === raw.trim().toLowerCase());
  return {
    mode: 'production',
    strict: true,
    error: `NODE_ENV="${raw}" is not supported. Use exactly one of: ${ENV_MODES.join(', ')}${hint ? ` (did you mean "${hint}"?)` : ''}.`,
  };
}

/** Returns a list of problems with a JWT secret (never containing the secret). */
export function checkJwtSecret(secret) {
  const s = String(secret ?? '');
  if (!s.trim()) return ['JWT_SECRET is empty.'];
  const problems = [];
  const lower = s.toLowerCase();
  if (KNOWN_DEFAULTS.has(lower.trim())) problems.push('JWT_SECRET is a well-known default value.');
  if (PLACEHOLDER_PARTS.some((p) => lower.includes(p))) problems.push('JWT_SECRET looks like a placeholder (for example the value from .env.example).');
  if (s.length < JWT_MIN_LENGTH) problems.push(`JWT_SECRET is too short (${s.length} characters; at least ${JWT_MIN_LENGTH} required).`);
  if (new Set(s).size < JWT_MIN_DISTINCT_CHARS) problems.push(`JWT_SECRET has too little variety (fewer than ${JWT_MIN_DISTINCT_CHARS} different characters).`);
  return problems;
}

const PLACEHOLDER_DOMAINS = /(^|\.)(example\.(com|org|net)|yourdomain\.[a-z]+|your-domain\.[a-z]+|localhost)$/i;
const EMAIL_RE = /^[^\s@<>]+@([a-z0-9-]+(\.[a-z0-9-]+)+)$/i;

/** VAPID subject: mailto:<address> or an https:// URL. Returns { ok, error }. */
export function checkVapidSubject(subject, { strict = true } = {}) {
  const s = String(subject ?? '').trim();
  if (!s) return { ok: false, error: 'VAPID_SUBJECT is missing' };
  if (s.startsWith('mailto:')) {
    const m = EMAIL_RE.exec(s.slice(7));
    if (!m) return { ok: false, error: 'VAPID_SUBJECT must be mailto:<email address> or an https:// URL' };
    if (strict && PLACEHOLDER_DOMAINS.test(m[1])) return { ok: false, error: 'VAPID_SUBJECT uses a placeholder domain; use a mailbox on a domain you control' };
    return { ok: true };
  }
  if (s.startsWith('https://')) {
    let url;
    try { url = new URL(s); } catch { return { ok: false, error: 'VAPID_SUBJECT is not a valid https:// URL' }; }
    // web-push only warns for localhost; push services reject it, so refuse it.
    if (PLACEHOLDER_DOMAINS.test(url.hostname) && (strict || url.hostname === 'localhost')) return { ok: false, error: 'VAPID_SUBJECT uses a placeholder or localhost address; use a URL you control' };
    return { ok: true };
  }
  return { ok: false, error: 'VAPID_SUBJECT must be mailto:<email address> or an https:// URL' };
}

// Same rules as web-push 3.6.7 (src/vapid-helper.js, src/urlsafe-base64-helper.js):
// URL-safe base64 without "=", public key 65 bytes and private key 32 bytes
// when decoded. Additionally the private key must produce the public key.
const URLSAFE_B64 = /^[A-Za-z0-9\-_]+$/;

/** Returns a list of problems with a VAPID key pair (never containing the keys). */
export function checkVapidKeys(publicKey, privateKey) {
  const problems = [];
  const pub = String(publicKey ?? '').trim();
  const priv = String(privateKey ?? '').trim();
  let pubBuf = null;
  let privBuf = null;
  if (!URLSAFE_B64.test(pub)) problems.push('VAPID_PUBLIC_KEY must be URL-safe base64 without "=" padding.');
  else if ((pubBuf = Buffer.from(pub, 'base64url')).length !== 65) problems.push('VAPID_PUBLIC_KEY must decode to 65 bytes.');
  else if (pubBuf[0] !== 0x04) problems.push('VAPID_PUBLIC_KEY is not an uncompressed P-256 public key.');
  if (!URLSAFE_B64.test(priv)) problems.push('VAPID_PRIVATE_KEY must be URL-safe base64 without "=" padding.');
  else if ((privBuf = Buffer.from(priv, 'base64url')).length !== 32) problems.push('VAPID_PRIVATE_KEY must decode to 32 bytes.');
  if (!problems.length) {
    try {
      const ecdh = createECDH('prime256v1');
      ecdh.setPrivateKey(privBuf);
      if (!ecdh.getPublicKey().equals(pubBuf)) problems.push('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not a matching pair.');
    } catch {
      problems.push('VAPID_PRIVATE_KEY is not a valid P-256 private key.');
    }
  }
  return problems;
}

/** MAIL_FROM: "Name <address>" or a bare address. Returns { ok, error }. */
export function checkMailFrom(from, { strict = true } = {}) {
  const s = String(from ?? '').trim();
  if (!s) return { ok: false, error: 'MAIL_FROM is missing' };
  if (/[\r\n]/.test(s)) return { ok: false, error: 'MAIL_FROM must be a single line' };
  const angle = /<([^<>]+)>\s*$/.exec(s);
  const address = (angle ? angle[1] : s).trim();
  const m = EMAIL_RE.exec(address);
  if (!m) return { ok: false, error: 'MAIL_FROM must be an email address, e.g. "FocusNest <no-reply@your-domain>"' };
  if (strict && PLACEHOLDER_DOMAINS.test(m[1])) return { ok: false, error: 'MAIL_FROM uses a placeholder domain; use an address on a domain verified with your email provider' };
  return { ok: true };
}

const has = (v) => typeof v === 'string' && v.trim() !== '';

export function validateEnv(env = {}) {
  const errors = [];
  const warnings = [];
  const { mode, strict, error: modeError, warning: modeWarning } = resolveMode(env.NODE_ENV);
  if (modeError) errors.push(modeError);
  if (modeWarning) warnings.push(modeWarning);
  const relaxed = (msg) => warnings.push(`${msg} (allowed in ${mode} only)`);

  // ---- database ----
  if (!has(env.MONGO_URI)) errors.push('MONGO_URI is required. See server/.env.example.');

  // ---- JWT secret ----
  let jwtSecret = env.JWT_SECRET;
  const jwtProblems = checkJwtSecret(jwtSecret);
  if (jwtProblems.length) {
    if (strict) {
      jwtProblems.forEach((p) => errors.push(`${p} ${JWT_HELP}`));
    } else if (!has(jwtSecret)) {
      jwtSecret = randomBytes(32).toString('base64');
      warnings.push(`JWT_SECRET is not set, so a temporary random secret is used. It changes on every restart, which signs everyone out. Set JWT_SECRET to keep sessions. ${JWT_HELP}`);
    } else {
      relaxed(`JWT_SECRET is weak: ${jwtProblems.join(' ')} ${JWT_HELP}`);
    }
  }

  // ---- CORS ----
  const cors = parseCorsConfig(env, { strict });
  errors.push(...cors.errors);
  warnings.push(...cors.warnings);

  // ---- Web Push (VAPID) ----
  const vapid = { enabled: false, publicKey: '', privateKey: '', subject: '' };
  const hasPub = has(env.VAPID_PUBLIC_KEY);
  const hasPriv = has(env.VAPID_PRIVATE_KEY);
  const pushProblem = (msg) => (strict ? errors.push(msg) : warnings.push(`${msg} Push notifications are disabled.`));
  if (hasPub !== hasPriv) {
    pushProblem('Only one of VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY is set. Set both (npm run vapid) or neither.');
  } else if (hasPub && hasPriv) {
    const keyProblems = checkVapidKeys(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    const subject = checkVapidSubject(env.VAPID_SUBJECT, { strict });
    if (keyProblems.length) {
      keyProblems.forEach((p) => pushProblem(`${p} Generate a new pair with: npm run vapid`));
    } else if (!has(env.VAPID_SUBJECT)) {
      // Missing subject: run safely without push rather than invent a sender.
      warnings.push('VAPID keys are set but VAPID_SUBJECT is missing, so push notifications are disabled. Set VAPID_SUBJECT=mailto:<a mailbox you read> or an https:// URL you control.');
    } else if (!subject.ok) {
      pushProblem(`${subject.error}.`);
    } else {
      Object.assign(vapid, { enabled: true, publicKey: env.VAPID_PUBLIC_KEY.trim(), privateKey: env.VAPID_PRIVATE_KEY.trim(), subject: env.VAPID_SUBJECT.trim() });
    }
  }

  // ---- Email (SMTP) — disabled unless fully configured ----
  const smtp = { enabled: false, host: '', port: Number(env.SMTP_PORT) || 587, user: '', pass: '', from: '' };
  const smtpParts = [has(env.SMTP_HOST), has(env.SMTP_USER), has(env.SMTP_PASS)];
  if (smtpParts.some(Boolean)) {
    if (!smtpParts.every(Boolean)) {
      const msg = 'SMTP is only partly configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS together, or leave all three empty to keep email disabled.';
      if (strict) errors.push(msg);
      else warnings.push(`${msg} Email is disabled.`);
    } else {
      const from = checkMailFrom(env.MAIL_FROM, { strict });
      if (from.ok) {
        Object.assign(smtp, { enabled: true, host: env.SMTP_HOST.trim(), user: env.SMTP_USER.trim(), pass: env.SMTP_PASS, from: env.MAIL_FROM.trim() });
      } else if (strict) {
        errors.push(`SMTP is configured but ${from.error}. Set MAIL_FROM to an address on a domain verified with your email provider, or remove the SMTP settings to keep email disabled.`);
      } else {
        warnings.push(`SMTP is configured but ${from.error}. Email is disabled.`);
      }
    }
  }

  const config = {
    nodeEnv: mode,
    isProd: strict, // strict rules apply: production, unset or invalid NODE_ENV
    port: Number(env.PORT) || 4000,
    mongoUri: env.MONGO_URI,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '30d',
    cors: { origins: cors.origins },
    isOriginAllowed: createOriginMatcher(cors),
    vapid,
    smtp,
    appUrl: (env.APP_URL || '').trim().replace(/\/$/, ''),
  };
  return { config, errors, warnings };
}
