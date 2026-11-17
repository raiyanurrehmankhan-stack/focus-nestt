// Tests for server/src/config/validateEnv.js (dependency-free; runs without the
// server's npm packages). Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkJwtSecret, checkVapidKeys, resolveMode, validateEnv } from '../server/src/config/validateEnv.js';

const strongSecret = () => randomBytes(32).toString('base64'); // = openssl rand -base64 32
const prodEnv = (extra = {}) => ({
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/focusnest',
  JWT_SECRET: strongSecret(),
  CORS_ORIGIN: 'https://focus-nestt.vercel.app',
  ...extra,
});
const devEnv = (extra = {}) => ({ NODE_ENV: 'development', MONGO_URI: 'mongodb://127.0.0.1:27017/focusnest', ...extra });
const noSecretIn = (messages, secret) => messages.every((m) => !m.includes(secret));

/** A real P-256 VAPID key pair, encoded like `web-push generate-vapid-keys`. */
function vapidPair() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const priv = ecdh.getPrivateKey();
  const priv32 = Buffer.concat([Buffer.alloc(32 - priv.length), priv]);
  return { VAPID_PUBLIC_KEY: ecdh.getPublicKey().toString('base64url'), VAPID_PRIVATE_KEY: priv32.toString('base64url') };
}

// ---------------- NODE_ENV (fail closed) ----------------
test('NODE_ENV: production, development and test are the only accepted values', () => {
  assert.deepEqual(resolveMode('production'), { mode: 'production', strict: true });
  assert.deepEqual(resolveMode('development'), { mode: 'development', strict: false });
  assert.deepEqual(resolveMode('test'), { mode: 'test', strict: false });
});

test('NODE_ENV: missing applies production rules (with a warning)', () => {
  for (const v of [undefined, '', '  ']) {
    const r = resolveMode(v);
    assert.equal(r.strict, true);
    assert.equal(r.mode, 'production');
    assert.ok(r.warning && !r.error);
  }
  const { errors } = validateEnv({ MONGO_URI: 'mongodb://x', JWT_SECRET: 'change-me-to-a-long-random-string', CORS_ORIGIN: 'https://focus-nestt.vercel.app' });
  assert.ok(errors.some((e) => e.includes('placeholder')), 'placeholder secret refused when NODE_ENV is unset');
  const { config } = validateEnv({ MONGO_URI: 'mongodb://x', JWT_SECRET: strongSecret(), CORS_ORIGIN: 'https://focus-nestt.vercel.app' });
  assert.equal(config.isProd, true);
});

test('NODE_ENV: uppercase, misspelled or unknown values stop start-up and never relax rules', () => {
  for (const [v, hint] of [['Production', 'production'], ['PRODUCTION', 'production'], ['Development', 'development'], [' development ', 'development'], ['prod', null], ['staging', null], ['dev', null]]) {
    const r = resolveMode(v);
    assert.equal(r.strict, true, v);
    assert.match(r.error, /is not supported/, v);
    if (hint) assert.match(r.error, new RegExp(`did you mean "${hint}"`), v);
    const { errors, config } = validateEnv({ NODE_ENV: v, MONGO_URI: 'mongodb://x', JWT_SECRET: 'change-me-to-a-long-random-string', CORS_ORIGIN: 'http://localhost:5173' });
    assert.ok(errors.some((e) => e.includes('NODE_ENV')), v);
    assert.ok(errors.some((e) => e.includes('placeholder')), `${v}: strict JWT rules still applied`);
    assert.ok(errors.some((e) => e.includes('https')), `${v}: strict CORS rules still applied`);
    assert.equal(config.isProd, true, `${v}: production behaviour (e.g. no debug output)`);
  }
});

test('NODE_ENV=test is relaxed like development', () => {
  const { errors, config } = validateEnv({ NODE_ENV: 'test', MONGO_URI: 'mongodb://x' });
  assert.deepEqual(errors, []);
  assert.equal(config.isProd, false);
});

// ---------------- JWT ----------------
test('a complete, safe production config has no errors', () => {
  const { errors, config } = validateEnv(prodEnv());
  assert.deepEqual(errors, []);
  assert.equal(config.isProd, true);
  assert.equal(config.vapid.enabled, false);
  assert.equal(config.smtp.enabled, false);
});

test('JWT: empty secret is rejected in production', () => {
  for (const value of [undefined, '', '   ']) {
    const { errors } = validateEnv(prodEnv({ JWT_SECRET: value }));
    assert.ok(errors.some((e) => e.includes('JWT_SECRET is empty') && e.includes('openssl rand -base64 32')), `value ${JSON.stringify(value)}`);
  }
});

test('JWT: placeholder secrets are rejected even when long enough', () => {
  for (const p of ['change-me-to-a-long-random-string', 'changeme-changeme-changeme-12345678', 'your-secret-goes-here-1234567890abcd', 'example-secret-ABCDEFGHIJKLMNOPQRSTUV']) {
    assert.ok(p.length >= 32, 'precondition: placeholder meets the length requirement');
    const { errors } = validateEnv(prodEnv({ JWT_SECRET: p }));
    assert.ok(errors.some((e) => e.includes('placeholder')), p);
    assert.ok(noSecretIn(errors, p), 'secret value must not appear in messages');
  }
  assert.ok(checkJwtSecret('secret').some((m) => m.includes('well-known')));
  assert.ok(checkJwtSecret('PASSWORD').some((m) => m.includes('well-known')));
});

test('JWT: too-short secret is rejected', () => {
  const s = randomBytes(12).toString('base64');
  const { errors } = validateEnv(prodEnv({ JWT_SECRET: s }));
  assert.ok(errors.some((e) => e.includes('too short')));
  assert.ok(noSecretIn(errors, s));
});

test('JWT: low-variety secret is rejected', () => {
  for (const s of ['a'.repeat(64), 'ab'.repeat(18), '012345678'.repeat(5)]) {
    const { errors } = validateEnv(prodEnv({ JWT_SECRET: s }));
    assert.ok(errors.some((e) => e.includes('too little variety')), s);
  }
});

test('JWT: valid random secrets (openssl rand -base64 32 format) are accepted', () => {
  for (let i = 0; i < 200; i++) assert.deepEqual(checkJwtSecret(strongSecret()), []);
});

test('JWT: Render-generated secrets (both known formats) are accepted', () => {
  // Real value of Render's older 32-character format, from community.render.com/t/15346
  assert.deepEqual(checkJwtSecret('5D3LsbzZ30v44VEEoXuHzwJsHcx1lOD1'), []);
  const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 20000; i++) {
    assert.deepEqual(checkJwtSecret(randomBytes(32).toString('base64')), []); // current: base64 of 256 bits
    const s = Array.from(randomBytes(32), (b) => alnum[b % alnum.length]).join('');
    assert.deepEqual(checkJwtSecret(s), [], s.slice(0, 4)); // older: 32 alphanumeric characters
  }
  assert.ok(checkJwtSecret('dummy-secret-value-1234567890abcdef').some((m) => m.includes('placeholder')));
});

test('JWT: development is convenient, production is strict', () => {
  const missing = validateEnv(devEnv());
  assert.deepEqual(missing.errors, []);
  assert.ok(missing.config.jwtSecret.length >= 32, 'temporary random secret in development');
  assert.ok(missing.warnings.some((w) => w.includes('changes on every restart') && w.includes('signs everyone out')));
  const again = validateEnv(devEnv());
  assert.notEqual(again.config.jwtSecret, missing.config.jwtSecret, 'a new secret each start');

  const weak = validateEnv(devEnv({ JWT_SECRET: 'change-me-to-a-long-random-string' }));
  assert.deepEqual(weak.errors, []);
  assert.ok(weak.warnings.some((w) => w.includes('allowed in development only')));
  assert.ok(noSecretIn(weak.warnings, 'change-me-to-a-long-random-string'));
  assert.ok(validateEnv(prodEnv({ JWT_SECRET: 'change-me-to-a-long-random-string' })).errors.length > 0);
});

test('MONGO_URI is required in every mode', () => {
  assert.ok(validateEnv(prodEnv({ MONGO_URI: '' })).errors.some((e) => e.includes('MONGO_URI')));
  assert.ok(validateEnv({ NODE_ENV: 'development' }).errors.some((e) => e.includes('MONGO_URI')));
});

// ---------------- CORS (through validateEnv) ----------------
test('CORS: missing production CORS_ORIGIN stops start-up; matcher is exposed', () => {
  assert.ok(validateEnv(prodEnv({ CORS_ORIGIN: '' })).errors.some((e) => e.includes('CORS_ORIGIN is required in production')));
  const { config } = validateEnv(prodEnv());
  assert.equal(config.isOriginAllowed('https://focus-nestt.vercel.app'), true);
  assert.equal(config.isOriginAllowed('https://focus-nestt.vercel.app.evil.com'), false);
});

test('CORS: production never accepts http origins; patterns are refused', () => {
  assert.ok(validateEnv(prodEnv({ CORS_ORIGIN: 'https://focus-nestt.vercel.app,http://localhost:5173' })).errors.some((e) => e.includes('https')));
  assert.ok(validateEnv(prodEnv({ CORS_ORIGIN_PATTERNS: 'https://focus-nestt-*-team.vercel.app' })).errors.some((e) => e.includes('CORS_ORIGIN_PATTERNS')));
});

// ---------------- Push (VAPID) ----------------
test('VAPID keys: valid generated pairs are accepted', () => {
  for (let i = 0; i < 20; i++) {
    const k = vapidPair();
    assert.deepEqual(checkVapidKeys(k.VAPID_PUBLIC_KEY, k.VAPID_PRIVATE_KEY), []);
  }
});

test('VAPID keys: malformed keys are rejected with messages that contain no keys', () => {
  const good = vapidPair();
  const other = vapidPair();
  const cases = [
    ['pub', 'priv', /65 bytes|URL-safe/],
    [good.VAPID_PUBLIC_KEY + '=', good.VAPID_PRIVATE_KEY, /URL-safe base64 without "="/],
    [`${good.VAPID_PUBLIC_KEY.slice(0, -1)}+`, good.VAPID_PRIVATE_KEY, /URL-safe base64/], // standard-base64 character
    [`${good.VAPID_PUBLIC_KEY.slice(0, -1)}/`, good.VAPID_PRIVATE_KEY, /URL-safe base64/],
    [good.VAPID_PUBLIC_KEY.slice(0, 40), good.VAPID_PRIVATE_KEY, /65 bytes/],
    [good.VAPID_PUBLIC_KEY, good.VAPID_PRIVATE_KEY.slice(0, 20), /32 bytes/],
    [good.VAPID_PUBLIC_KEY, other.VAPID_PRIVATE_KEY, /matching pair/],
    [good.VAPID_PRIVATE_KEY, good.VAPID_PUBLIC_KEY, /65 bytes|32 bytes/], // swapped
    [Buffer.concat([Buffer.from([0x02]), Buffer.alloc(64, 1)]).toString('base64url'), good.VAPID_PRIVATE_KEY, /uncompressed P-256/],
    [good.VAPID_PUBLIC_KEY, Buffer.alloc(32, 0).toString('base64url'), /not a valid P-256 private key|matching pair/],
  ];
  for (const [pub, priv, expected] of cases) {
    const problems = checkVapidKeys(pub, priv);
    assert.ok(problems.length > 0, `should reject pub=${pub.slice(0, 8)}…`);
    assert.match(problems.join(' '), expected);
    assert.ok(noSecretIn(problems, priv) && noSecretIn(problems, pub));
  }
});

test('push: malformed keys stop production start-up, disable push in development', () => {
  const env = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'https://focus-nestt.vercel.app' };
  const prod = validateEnv(prodEnv(env));
  assert.ok(prod.errors.some((e) => e.includes('VAPID_PUBLIC_KEY')));
  assert.equal(prod.config.vapid.enabled, false);
  const dev = validateEnv(devEnv(env));
  assert.deepEqual(dev.errors, []);
  assert.equal(dev.config.vapid.enabled, false);
  assert.ok(dev.warnings.some((w) => w.includes('Push notifications are disabled')));
});

test('push: missing VAPID keys → push disabled, no error', () => {
  const { errors, config } = validateEnv(prodEnv());
  assert.deepEqual(errors, []);
  assert.equal(config.vapid.enabled, false);
});

test('push: missing VAPID_SUBJECT disables push with a warning (no invented sender)', () => {
  for (const env of [prodEnv(vapidPair()), devEnv(vapidPair())]) {
    const { errors, warnings, config } = validateEnv(env);
    assert.deepEqual(errors, []);
    assert.equal(config.vapid.enabled, false);
    assert.equal(config.vapid.publicKey, '', 'public key is not advertised while push is disabled');
    assert.ok(warnings.some((w) => w.includes('VAPID_SUBJECT is missing')));
  }
});

test('push: valid keys with a valid mailto: or https: subject enable push', () => {
  for (const subject of ['mailto:shameer@my-own-domain.pk', 'https://focus-nestt.vercel.app']) {
    const keys = vapidPair();
    const { errors, config } = validateEnv(prodEnv({ ...keys, VAPID_SUBJECT: subject }));
    assert.deepEqual(errors, [], subject);
    assert.equal(config.vapid.enabled, true);
    assert.equal(config.vapid.subject, subject);
    assert.equal(config.vapid.publicKey, keys.VAPID_PUBLIC_KEY);
  }
});

test('push: invalid, placeholder or localhost subjects are rejected', () => {
  for (const subject of ['admin@focusnest.app', 'mailto:not-an-email', 'http://focus-nestt.vercel.app', 'mailto:you@example.com', 'https://yourdomain.com', 'https://localhost:5173']) {
    assert.ok(validateEnv(prodEnv({ ...vapidPair(), VAPID_SUBJECT: subject })).errors.length > 0, subject);
  }
  assert.equal(validateEnv(devEnv({ ...vapidPair(), VAPID_SUBJECT: 'https://localhost:5173' })).config.vapid.enabled, false, 'localhost refused in development too');
});

test('push: only one VAPID key set is an error in production', () => {
  assert.ok(validateEnv(prodEnv({ VAPID_PUBLIC_KEY: vapidPair().VAPID_PUBLIC_KEY, VAPID_SUBJECT: 'https://focus-nestt.vercel.app' })).errors.length > 0);
});

// ---------------- Email ----------------
const SMTP = { SMTP_HOST: 'smtp.provider.test', SMTP_USER: 'apikey', SMTP_PASS: 'smtp-password-value' };

test('email: SMTP completely disabled is fine and sends nothing', () => {
  for (const env of [prodEnv(), devEnv(), prodEnv({ MAIL_FROM: 'FocusNest <no-reply@my-own-domain.pk>' })]) {
    const { errors, config } = validateEnv(env);
    assert.deepEqual(errors, []);
    assert.equal(config.smtp.enabled, false);
  }
});

test('email: SMTP enabled without MAIL_FROM fails safely in production', () => {
  const { errors, config } = validateEnv(prodEnv(SMTP));
  assert.ok(errors.some((e) => e.includes('MAIL_FROM is missing')));
  assert.equal(config.smtp.enabled, false);
  assert.ok(noSecretIn(errors, SMTP.SMTP_PASS));
  const dev = validateEnv(devEnv(SMTP));
  assert.deepEqual(dev.errors, []);
  assert.equal(dev.config.smtp.enabled, false, 'development disables email instead of guessing a sender');
});

test('email: valid MAIL_FROM enables SMTP; placeholder domains and header injection are rejected', () => {
  const ok = validateEnv(prodEnv({ ...SMTP, MAIL_FROM: 'FocusNest <no-reply@my-own-domain.pk>' }));
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.config.smtp.enabled, true);
  for (const from of ['FocusNest <no-reply@example.com>', 'no-reply@yourdomain.com', 'not an address', 'a@my-own-domain.pk\r\nBcc: x@evil.test']) {
    assert.ok(validateEnv(prodEnv({ ...SMTP, MAIL_FROM: from })).errors.length > 0, from);
  }
});

test('email: partly configured SMTP is refused in production', () => {
  assert.ok(validateEnv(prodEnv({ SMTP_HOST: 'smtp.provider.test', MAIL_FROM: 'a@my-own-domain.pk' })).errors.some((e) => e.includes('partly configured')));
});

// ---------------- configuration files ----------------
function parseDotenv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return out;
}

test('server/.env.example works as-is for local development (README local setup)', () => {
  const env = parseDotenv(readFileSync(new URL('../server/.env.example', import.meta.url), 'utf8'));
  assert.equal(env.NODE_ENV, 'development');
  const { errors, config } = validateEnv(env);
  assert.deepEqual(errors, []);
  assert.equal(config.isOriginAllowed('http://localhost:5173'), true, 'local Vite dev server allowed');
  assert.equal(config.smtp.enabled, false, 'email disabled by default');
  assert.equal(config.vapid.enabled, false, 'push disabled until configured');
});

test('server/.env.example cannot be used for production without changes', () => {
  const env = { ...parseDotenv(readFileSync(new URL('../server/.env.example', import.meta.url), 'utf8')), NODE_ENV: 'production' };
  const { errors } = validateEnv(env);
  assert.ok(errors.some((e) => e.includes('JWT_SECRET')), 'empty JWT secret refused');
  assert.ok(errors.some((e) => e.includes('https')), 'http://localhost origin refused');
});

test('render.yaml provides every variable production requires', () => {
  const yaml = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
  assert.match(yaml, /key: NODE_ENV\s+value: production/);
  assert.match(yaml, /key: JWT_SECRET\s+generateValue: true/);
  for (const k of ['MONGO_URI', 'CORS_ORIGIN']) assert.match(yaml, new RegExp(`key: ${k}\\s+sync: false`), k);
  assert.doesNotMatch(yaml, /CORS_ORIGIN_PATTERNS/);
});

test('no hard-coded sender domain remains in the server', () => {
  const root = new URL('../server/src', import.meta.url).pathname;
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  assert.deepEqual(walk(root).filter((f) => readFileSync(f, 'utf8').includes('focusnest.app')), []);
});
