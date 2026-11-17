// Validates the API's environment variables. Pure and dependency-free (only
// Node built-ins), so it can be unit tested without the server's packages.
//
//   const { config, errors, warnings } = validateEnv(process.env);
//
// Production (NODE_ENV=production) is strict: anything unsafe is an error and
// the server refuses to start. Development stays convenient: problems become
// warnings and safe fallbacks are used. Secret values are never included in
// messages.
import { randomBytes } from 'node:crypto';
import { createOriginMatcher, parseCorsConfig } from '../utils/origins.js';

export const JWT_MIN_LENGTH = 32;
export const JWT_MIN_DISTINCT_CHARS = 10;
const JWT_HELP = 'Generate one with: openssl rand -base64 32';

// Substrings that mark a copied placeholder rather than a real secret.
const PLACEHOLDER_PARTS = ['change-me', 'changeme', 'change_me', 'replace-me', 'replaceme', 'your-secret', 'your_secret', 'yoursecret', 'example', 'placeholder', 'dummy'];
// Well-known default values (compared case-insensitively).
const KNOWN_DEFAULTS = new Set(['secret', 'jwt-secret', 'jwt_secret', 'jwtsecret', 'supersecret', 'super-secret', 'mysecret', 'my-secret', 'password', 'focusnest', 'default', 'test', 'testing', 'development', 'keyboard cat', 'shhhhh', '12345678901234567890123456789012']);

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
export function checkVapidSubject(subject, { production = false } = {}) {
  const s = String(subject ?? '').trim();
  if (!s) return { ok: false, error: 'VAPID_SUBJECT is missing' };
  if (s.startsWith('mailto:')) {
    const m = EMAIL_RE.exec(s.slice(7));
    if (!m) return { ok: false, error: 'VAPID_SUBJECT must be mailto:<email address> or an https:// URL' };
    if (production && PLACEHOLDER_DOMAINS.test(m[1])) return { ok: false, error: 'VAPID_SUBJECT uses a placeholder domain; use a mailbox on a domain you control' };
    return { ok: true };
  }
  if (s.startsWith('https://')) {
    let url;
    try { url = new URL(s); } catch { return { ok: false, error: 'VAPID_SUBJECT is not a valid https:// URL' }; }
    if (production && PLACEHOLDER_DOMAINS.test(url.hostname)) return { ok: false, error: 'VAPID_SUBJECT uses a placeholder domain; use a URL you control' };
    return { ok: true };
  }
  return { ok: false, error: 'VAPID_SUBJECT must be mailto:<email address> or an https:// URL' };
}

/** MAIL_FROM: "Name <address>" or a bare address. Returns { ok, error }. */
export function checkMailFrom(from, { production = false } = {}) {
  const s = String(from ?? '').trim();
  if (!s) return { ok: false, error: 'MAIL_FROM is missing' };
  const angle = /<([^<>]+)>\s*$/.exec(s);
  const address = (angle ? angle[1] : s).trim();
  const m = EMAIL_RE.exec(address);
  if (!m) return { ok: false, error: 'MAIL_FROM must be an email address, e.g. "FocusNest <no-reply@yourdomain>"' };
  if (production && PLACEHOLDER_DOMAINS.test(m[1])) return { ok: false, error: 'MAIL_FROM uses a placeholder domain; use an address on a domain verified with your email provider' };
  return { ok: true };
}

const has = (v) => typeof v === 'string' && v.trim() !== '';

export function validateEnv(env = {}) {
  const production = env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  // ---- database ----
  if (!has(env.MONGO_URI)) errors.push('MONGO_URI is required. See server/.env.example.');

  // ---- JWT secret ----
  let jwtSecret = env.JWT_SECRET;
  const jwtProblems = checkJwtSecret(jwtSecret);
  if (jwtProblems.length) {
    if (production) {
      jwtProblems.forEach((p) => errors.push(`${p} ${JWT_HELP}`));
    } else if (!has(jwtSecret)) {
      jwtSecret = randomBytes(32).toString('base64');
      warnings.push(`JWT_SECRET is not set; using a temporary random secret for development (sign-ins reset on every restart). ${JWT_HELP}`);
    } else {
      warnings.push(`JWT_SECRET is weak (${jwtProblems.join(' ')}) This is allowed in development only. ${JWT_HELP}`);
    }
  }

  // ---- CORS ----
  const cors = parseCorsConfig(env, { production });
  errors.push(...cors.errors);
  warnings.push(...cors.warnings);
  if (cors.patterns.some((p) => p.regex.source.includes('vercel\\.app'))) {
    warnings.push('CORS_ORIGIN_PATTERNS matches *.vercel.app addresses. Anyone can create Vercel projects, so prefer listing your exact preview alias in CORS_ORIGIN, or use a separate staging API.');
  }

  // ---- Web Push (VAPID) ----
  const vapid = { enabled: false, publicKey: '', privateKey: '', subject: '' };
  const hasPub = has(env.VAPID_PUBLIC_KEY);
  const hasPriv = has(env.VAPID_PRIVATE_KEY);
  if (hasPub !== hasPriv) {
    const msg = 'Only one of VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY is set. Set both (npm run vapid) or neither.';
    if (production) errors.push(msg);
    else warnings.push(`${msg} Push notifications are disabled.`);
  } else if (hasPub && hasPriv) {
    const subject = checkVapidSubject(env.VAPID_SUBJECT, { production });
    if (subject.ok) {
      Object.assign(vapid, { enabled: true, publicKey: env.VAPID_PUBLIC_KEY.trim(), privateKey: env.VAPID_PRIVATE_KEY.trim(), subject: env.VAPID_SUBJECT.trim() });
    } else if (!has(env.VAPID_SUBJECT)) {
      // Missing subject: run safely without push rather than invent a sender.
      warnings.push('VAPID keys are set but VAPID_SUBJECT is missing, so push notifications are disabled. Set VAPID_SUBJECT=mailto:you@yourdomain or an https:// URL you control.');
    } else if (production) {
      errors.push(`${subject.error}.`);
    } else {
      warnings.push(`${subject.error}. Push notifications are disabled.`);
    }
  }

  // ---- Email (SMTP) — disabled unless fully configured ----
  const smtp = { enabled: false, host: '', port: Number(env.SMTP_PORT) || 587, user: '', pass: '', from: '' };
  const smtpParts = [has(env.SMTP_HOST), has(env.SMTP_USER), has(env.SMTP_PASS)];
  if (smtpParts.some(Boolean)) {
    if (!smtpParts.every(Boolean)) {
      const msg = 'SMTP is only partly configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS together, or leave all three empty to keep email disabled.';
      if (production) errors.push(msg);
      else warnings.push(`${msg} Email is disabled.`);
    } else {
      const from = checkMailFrom(env.MAIL_FROM, { production });
      if (from.ok) {
        Object.assign(smtp, { enabled: true, host: env.SMTP_HOST.trim(), user: env.SMTP_USER.trim(), pass: env.SMTP_PASS, from: env.MAIL_FROM.trim() });
      } else if (production) {
        errors.push(`SMTP is configured but ${from.error}. Set MAIL_FROM to an address on a domain verified with your email provider, or remove the SMTP settings to keep email disabled.`);
      } else {
        warnings.push(`SMTP is configured but ${from.error}. Email is disabled.`);
      }
    }
  }

  const config = {
    nodeEnv: env.NODE_ENV || 'development',
    isProd: production,
    port: Number(env.PORT) || 4000,
    mongoUri: env.MONGO_URI,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '30d',
    cors: { origins: cors.origins, patterns: cors.patterns.map((p) => p.pattern) },
    isOriginAllowed: createOriginMatcher(cors),
    vapid,
    smtp,
    appUrl: (env.APP_URL || '').trim().replace(/\/$/, ''),
  };
  return { config, errors, warnings };
}
