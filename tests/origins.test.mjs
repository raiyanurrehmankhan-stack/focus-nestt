// Tests for server/src/utils/origins.js (dependency-free; runs without the
// server's npm packages). Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { corsOriginOption, createOriginMatcher, parseCorsConfig, parseOrigin, socketAllowRequest } from '../server/src/utils/origins.js';

const STRICT = { strict: true };
const matcher = (env, opts = STRICT) => {
  const c = parseCorsConfig(env, opts);
  assert.deepEqual(c.errors, [], `unexpected errors: ${c.errors.join(' | ')}`);
  return createOriginMatcher(c);
};

/** Calls a callback-style function and returns every callback invocation. */
function collect(fn, ...args) {
  const calls = [];
  fn(...args, (...cbArgs) => calls.push(cbArgs));
  return calls;
}

test('exact origin match', () => {
  const ok = matcher({ CORS_ORIGIN: 'https://focus-nestt.vercel.app' });
  assert.equal(ok('https://focus-nestt.vercel.app'), true);
  assert.equal(ok('https://other-app.vercel.app'), false);
  assert.equal(ok('http://focus-nestt.vercel.app'), false, 'scheme must match');
  assert.equal(ok('https://focus-nestt.vercel.app:8443'), false, 'port must match');
});

test('multiple origins, whitespace and duplicates', () => {
  const c = parseCorsConfig({ CORS_ORIGIN: ' https://a.example.org , https://b.example.org,https://a.example.org ' }, STRICT);
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
  assert.equal(parseCorsConfig({ CORS_ORIGIN: 'https://ok.example.org,not a url' }, STRICT).errors.length, 1);
});

test('strict rules require https; relaxed rules allow http://localhost', () => {
  assert.match(parseCorsConfig({ CORS_ORIGIN: 'http://app.example.org' }, STRICT).errors[0], /https/);
  assert.match(parseCorsConfig({ CORS_ORIGIN: 'http://localhost:5173' }, STRICT).errors[0], /https/);
  assert.deepEqual(parseCorsConfig({ CORS_ORIGIN: 'http://localhost:5173' }, { strict: false }).errors, []);
});

test('wildcard origins are rejected in every environment', () => {
  for (const opts of [STRICT, { strict: false }]) {
    assert.match(parseCorsConfig({ CORS_ORIGIN: '*' }, opts).errors[0], /must not be "\*"/);
    assert.match(parseCorsConfig({ CORS_ORIGIN: 'https://*.vercel.app' }, opts).errors[0], /wildcard/);
  }
});

test('CORS_ORIGIN_PATTERNS is no longer supported and stops start-up', () => {
  for (const opts of [STRICT, { strict: false }]) {
    const c = parseCorsConfig({ CORS_ORIGIN: 'https://focus-nestt.vercel.app', CORS_ORIGIN_PATTERNS: 'https://focus-nestt-*-team.vercel.app' }, opts);
    assert.ok(c.errors.some((e) => e.includes('CORS_ORIGIN_PATTERNS is not supported')));
  }
  assert.deepEqual(parseCorsConfig({ CORS_ORIGIN: 'https://focus-nestt.vercel.app', CORS_ORIGIN_PATTERNS: '   ' }, STRICT).errors, [], 'empty value is ignored');
});

test('trailing slash, path, query and fragment are rejected', () => {
  for (const bad of ['https://app.example.org/', 'https://app.example.org/path', 'https://app.example.org?x=1', 'https://app.example.org#top']) {
    assert.ok(parseOrigin(bad, { requireHttps: true }).error, `should reject ${bad}`);
  }
  assert.match(parseOrigin('https://app.example.org/').error, /slash/);
  assert.match(parseOrigin('https://App.Example.org').error, /canonical/, 'non-canonical case is rejected with a hint');
});

test('look-alike and unrelated domains are rejected (exact match only)', () => {
  const ok = matcher({ CORS_ORIGIN: 'https://focus-nestt.vercel.app,https://focus-nestt-git-staging-yourscope.vercel.app' });
  assert.equal(ok('https://focus-nestt-git-staging-yourscope.vercel.app'), true);
  for (const evil of [
    'https://focus-nestt.vercel.app.evil.com',
    'https://evilfocus-nestt.vercel.app',
    'https://focus-nestt.vercel.app.',
    'https://focus-nestt-attacker-yourscope.vercel.app',
    'https://focus-nestt-git-staging-yourscope.vercel.app.evil.com',
    'https://x.focus-nestt.vercel.app',
    'https://FOCUS-NESTT.vercel.app',
    'null',
  ]) assert.equal(ok(evil), false, `should reject ${evil}`);
});

test('missing CORS_ORIGIN: error under strict rules, localhost fallback when relaxed', () => {
  const strict = parseCorsConfig({}, STRICT);
  assert.equal(strict.errors.length, 1);
  assert.match(strict.errors[0], /CORS_ORIGIN is required in production/);
  const relaxed = parseCorsConfig({}, { strict: false });
  assert.deepEqual(relaxed.errors, []);
  assert.deepEqual(relaxed.origins, ['http://localhost:5173', 'http://localhost:4173']);
  assert.equal(relaxed.warnings.length, 1);
});

test('requests without an Origin header are allowed; non-string origins are not', () => {
  const ok = matcher({ CORS_ORIGIN: 'https://focus-nestt.vercel.app' });
  assert.equal(ok(undefined), true);
  assert.equal(ok(null), true);
  assert.equal(ok(''), true);
  assert.equal(ok(['https://focus-nestt.vercel.app']), false);
});

test('cors adapter: allows with (null, true), rejects with a 403 error, exactly one callback each', () => {
  const option = corsOriginOption(matcher({ CORS_ORIGIN: 'https://focus-nestt.vercel.app' }));
  const allowed = collect(option, 'https://focus-nestt.vercel.app');
  assert.equal(allowed.length, 1);
  assert.deepEqual(allowed[0], [null, true]);
  const denied = collect(option, 'https://evil.example.org');
  assert.equal(denied.length, 1);
  assert.ok(denied[0][0] instanceof Error);
  assert.equal(denied[0][0].status, 403);
  const noOrigin = collect(option, undefined);
  assert.deepEqual(noOrigin, [[null, true]]);
});

test('socket allowRequest adapter: same decision as the CORS check, for handshakes and upgrades', () => {
  const allow = socketAllowRequest(matcher({ CORS_ORIGIN: 'https://focus-nestt.vercel.app' }));
  const cases = [
    [{ headers: { origin: 'https://focus-nestt.vercel.app' } }, true],
    [{ headers: { origin: 'https://evil.example.org' } }, false],
    [{ headers: { origin: 'https://focus-nestt.vercel.app', upgrade: 'websocket' } }, true],
    [{ headers: { origin: 'https://evil.example.org', upgrade: 'websocket' } }, false],
    [{ headers: {} }, true],
  ];
  for (const [req, expected] of cases) {
    const calls = collect(allow, req);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], [null, expected], JSON.stringify(req.headers));
  }
});
