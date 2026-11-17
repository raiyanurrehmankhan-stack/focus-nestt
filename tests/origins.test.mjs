// Tests for server/src/utils/origins.js (dependency-free; runs without the
// server's npm packages). Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { corsOriginOption, createOriginMatcher, parseCorsConfig, parseOrigin, parseOriginPattern } from '../server/src/utils/origins.js';

const PROD = { production: true };
const matcher = (env, opts = PROD) => {
  const c = parseCorsConfig(env, opts);
  assert.deepEqual(c.errors, [], `unexpected errors: ${c.errors.join(' | ')}`);
  return createOriginMatcher(c);
};

test('exact origin match', () => {
  const ok = matcher({ CORS_ORIGIN: 'https://focus-nestt.vercel.app' });
  assert.equal(ok('https://focus-nestt.vercel.app'), true);
  assert.equal(ok('https://other-app.vercel.app'), false);
  assert.equal(ok('http://focus-nestt.vercel.app'), false, 'scheme must match');
  assert.equal(ok('https://focus-nestt.vercel.app:8443'), false, 'port must match');
});

test('multiple origins, whitespace and duplicates', () => {
  const c = parseCorsConfig({ CORS_ORIGIN: ' https://a.example.org , https://b.example.org,https://a.example.org ' }, PROD);
  assert.deepEqual(c.errors, []);
  assert.deepEqual(c.origins, ['https://a.example.org', 'https://b.example.org']);
  const ok = createOriginMatcher(c);
  assert.equal(ok('https://a.example.org'), true);
  assert.equal(ok('https://b.example.org'), true);
  assert.equal(ok('https://c.example.org'), false);
});

test('invalid origins are rejected', () => {
  for (const bad of ['not a url', 'ftp://files.example.org', 'https://user:pw@app.example.org', 'focus-nestt.vercel.app']) {
    assert.ok(parseOrigin(bad).error, `should reject ${bad}`);
  }
  const c = parseCorsConfig({ CORS_ORIGIN: 'https://ok.example.org,not a url' }, PROD);
  assert.equal(c.errors.length, 1);
});

test('production requires https; development allows http', () => {
  assert.ok(parseCorsConfig({ CORS_ORIGIN: 'http://app.example.org' }, PROD).errors[0].includes('https'));
  assert.deepEqual(parseCorsConfig({ CORS_ORIGIN: 'http://localhost:5173' }, { production: false }).errors, []);
});

test('wildcard origins are rejected', () => {
  assert.ok(parseCorsConfig({ CORS_ORIGIN: '*' }, PROD).errors.length);
  assert.ok(parseCorsConfig({ CORS_ORIGIN: '*' }, { production: false }).errors.length, 'also refused in development');
  assert.ok(parseCorsConfig({ CORS_ORIGIN: 'https://*.vercel.app' }, PROD).errors[0].includes('wildcard'));
});

test('trailing slash, path, query and fragment are rejected', () => {
  for (const bad of ['https://app.example.org/', 'https://app.example.org/path', 'https://app.example.org?x=1', 'https://app.example.org#top']) {
    const r = parseOrigin(bad, { requireHttps: true });
    assert.ok(r.error, `should reject ${bad}`);
  }
  assert.match(parseOrigin('https://app.example.org/').error, /slash/);
  assert.match(parseOrigin('https://App.Example.org').error, /canonical/, 'non-canonical case is rejected with a hint');
});

test('look-alike and unrelated domains are rejected', () => {
  const ok = matcher({ CORS_ORIGIN: 'https://focus-nestt.vercel.app', CORS_ORIGIN_PATTERNS: 'https://focus-nestt-*-myteam.vercel.app' });
  for (const evil of [
    'https://focus-nestt.vercel.app.evil.com',
    'https://evilfocus-nestt.vercel.app',
    'https://focus-nestt.vercel.app.',
    'https://focus-nestt-abc-myteam.vercel.app.evil.com',
    'https://focus-nestt-abc-myteam-vercel.app',
    'https://focus-nestt-a.b-myteam.vercel.app',
    'https://x.focus-nestt-abc-myteam.vercel.app',
    'http://focus-nestt-abc-myteam.vercel.app',
    'https://focus-nestt-abc-otherteam.vercel.app',
    'https://xfocus-nestt-abc-myteam.vercel.app',
    'null',
  ]) assert.equal(ok(evil), false, `should reject ${evil}`);
});

test('explicitly configured pattern matching', () => {
  const ok = matcher({ CORS_ORIGIN: 'https://focus-nestt.vercel.app', CORS_ORIGIN_PATTERNS: 'https://focus-nestt-*-myteam.vercel.app' });
  assert.equal(ok('https://focus-nestt-git-staging-myteam.vercel.app'), true);
  assert.equal(ok('https://focus-nestt-a1b2c3d4e-myteam.vercel.app'), true);
  const p = parseOriginPattern('https://focus-nestt-*-myteam.vercel.app');
  assert.ok(p.regex.source.startsWith('^') && p.regex.source.endsWith('$'), 'pattern is anchored');
});

test('broad or malformed patterns are refused', () => {
  for (const bad of [
    'https://*.vercel.app',
    'https://*-myteam.vercel.app',
    'https://ab*cd.vercel.app',
    'https://focus-nestt-*.vercel.app',
    'https://focus-*-*-team.vercel.app',
    'https://app.*.example.org',
    'http://focus-nestt-*-myteam.vercel.app',
    'https://focus-nestt-*-myteam.vercel.app/path',
    'https://focus-nestt-*-myteam.vercel.app:8443',
    'https://foo-*-bar.app',
    '^https://.*$',
  ]) assert.ok(parseOriginPattern(bad).error, `should refuse ${bad}`);
});

test('missing CORS_ORIGIN: error in production, localhost fallback in development', () => {
  const prod = parseCorsConfig({}, PROD);
  assert.equal(prod.errors.length, 1);
  assert.match(prod.errors[0], /CORS_ORIGIN is required in production/);
  const dev = parseCorsConfig({}, { production: false });
  assert.deepEqual(dev.errors, []);
  assert.deepEqual(dev.origins, ['http://localhost:5173', 'http://localhost:4173']);
  assert.equal(dev.warnings.length, 1);
});

test('requests without an Origin header are allowed; the cors adapter rejects with 403', () => {
  const ok = matcher({ CORS_ORIGIN: 'https://focus-nestt.vercel.app' });
  assert.equal(ok(undefined), true);
  assert.equal(ok(''), true);
  const option = corsOriginOption(ok);
  option('https://focus-nestt.vercel.app', (err, allowed) => { assert.equal(err, null); assert.equal(allowed, true); });
  option('https://evil.example.org', (err) => { assert.equal(err.status, 403); });
});
