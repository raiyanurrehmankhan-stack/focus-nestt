// Functional tests for the guest/offline API (src/services/localApi.js).
// The module is bundled with esbuild (to resolve the @shared alias) and run
// against an in-memory localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i],
  get length() { return store.size; },
};
globalThis.navigator ??= { userAgent: 'node-test' };

async function load() {
  mkdirSync(join(root, 'node_modules/.cache'), { recursive: true });
  const out = join(mkdtempSync(join(root, 'node_modules/.cache/fn-')), 'localApi.mjs'); // inside the project so 'zod' resolves
  const r = await build({ entryPoints: [join(root, 'src/services/localApi.js')], bundle: true, format: 'esm', platform: 'node', write: false, alias: { '@shared': join(root, 'shared') }, external: ['zod'], nodePaths: [join(root, 'node_modules')] });
  writeFileSync(out, r.outputFiles[0].text);
  return import(pathToFileURL(out).href + `?t=${Date.now()}`);
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('legacy prototype data is migrated', async () => {
  store.clear();
  store.set('focusnest-v1', JSON.stringify({ onboarded: true, name: 'Alex', userType: 'University student', struggle: 'Gaming', theme: 'dark', demo: true, bedtime: '23:00', breakMinutes: 20, screenGoal: 3, points: 55,
    checkins: [{ date: '2026-11-10', screenHours: 5, app: 'Instagram / reels', bedtime: '01:00', mood: '😴 Tired' }],
    sleeps: [{ date: '2026-11-10', goal: '23:00', actual: '23:10', hours: 7, onTarget: true }],
    wins: [{ date: '2026-11-10', items: ['Walked'] }], focusSessions: [{ date: '2026-11-10', goal: 'Notes', minutes: 25 }],
    activityHistory: [{ date: '2026-11-10', label: 'Take a 15-minute walk' }], nightApps: ['Instagram', 'PUBG'] }));
  const api = await load();
  assert.equal(api.migrateLegacyData(), true);
  const { user } = await api.me();
  assert.equal(user.name, 'Alex');
  assert.deepEqual(user.struggles, ['gaming']);
  assert.equal(user.defaultBreakMinutes, 20);
  assert.equal(user.points >= 55, true);
  const { items } = await api.listCheckIns({ from: '2026-11-01', to: '2026-11-30' });
  assert.equal(items[0].mood, 'tired');
  assert.deepEqual(items[0].mainApps, ['Instagram']);
  assert.deepEqual((await api.getNightLock()).nightLock.apps.sort(), ['games', 'social']);
  assert.equal(api.migrateLegacyData(), false, 'runs only once');
});

test('guest flow: onboarding, check-in, focus, break, extend, close', async () => {
  store.clear();
  const api = await load();
  await api.createGuestProfile({ name: 'Sam', userType: 'Working professional', struggles: ['reels'], screenGoalHours: 4, bedtimeGoal: '23:00', demoMode: true });
  assert.equal((await api.me()).user.name, 'Sam');

  await assert.rejects(api.saveCheckIn({ date: today(), screenHours: 40, bedtime: '23:00', mood: 'good' }), /24|less/i);
  const ci = await api.saveCheckIn({ date: today(), screenHours: 3, mainApps: ['YouTube'], bedtime: '23:30', mood: 'good' });
  assert.equal(ci.checkIn.screenHours, 3);
  const dash = await api.getDashboard(today());
  assert.equal(dash.screenTime.hours, 3);
  assert.equal(dash.weekScreen.length, 7);

  // Focus session in demo mode (30 s) — simulate time passing by editing endAt.
  const { timer: f } = await api.startFocus({ date: today(), goalText: 'Report', plannedMinutes: 25, demo: true });
  assert.equal(f.kind, 'focus');
  assert.equal(new Date(f.endAt) - new Date(f.startAt), 30000);
  const paused = (await api.updateFocus(f.id, 'pause')).timer;
  assert.equal(paused.status, 'paused');
  const resumed = (await api.updateFocus(f.id, 'resume')).timer;
  assert.equal(resumed.status, 'running');
  const db = JSON.parse(store.get('fn:db:v2'));
  db.focusSessions.at(-1).endAt = new Date(Date.now() - 1000).toISOString();
  store.set('fn:db:v2', JSON.stringify(db));
  api.reloadLocalDb();
  assert.equal((await api.getTimer()).active, null, 'finished focus is no longer active');
  const done = await api.updateFocus(f.id, 'complete');
  assert.equal(done.timer.status, 'completed');
  assert.equal(done.timer.pointsAwarded, 10);

  // Break → ends → extend twice (max) → close
  const { timer: b } = await api.startBreak({ date: today(), minutes: 30, demo: false });
  assert.equal(b.extensionsLeft, 2);
  const db2 = JSON.parse(store.get('fn:db:v2'));
  db2.breaks.at(-1).endAt = new Date(Date.now() - 500).toISOString();
  store.set('fn:db:v2', JSON.stringify(db2));
  api.reloadLocalDb();
  const ended = (await api.getTimer()).active;
  assert.equal(ended.status, 'ended');
  await assert.rejects(api.extendBreak(b.id, { reason: 'x' }), /why/i);
  const e1 = await api.extendBreak(b.id, { reason: 'Finishing a call' });
  assert.equal(e1.timer.status, 'running');
  assert.equal(e1.timer.extensionsLeft, 1);
  await api.extendBreak(b.id, { reason: 'One more minute' });
  await assert.rejects(api.extendBreak(b.id, { reason: 'And another' }), /both extensions/);
  const closed = await api.closeBreak(b.id, { date: today(), startFocus: true });
  assert.equal(closed.returnedOnTime, true);
  assert.equal(closed.points, 5);
  assert.equal(closed.timer.kind, 'focus');

  const q = await api.getQuests(today());
  assert.ok(q.quests.some((x) => x.code === 'under-limit'), 'quest generated from the "reels" struggle');
  assert.ok(q.badges.find((x) => x.code === 'first-flight').unlocked);
});

test('sleep, wins, goals, activities, community', async () => {
  store.clear();
  const api = await load();
  await api.createGuestProfile({ name: 'Ria', bedtimeGoal: '23:00' });
  const s = await api.saveSleep({ date: today(), actualBedtime: '23:20', hoursSlept: 7 });
  assert.equal(s.sleepLog.onTarget, true);
  assert.equal(s.points, 10);
  const again = await api.saveSleep({ date: today(), checklistDone: ['charger'] });
  assert.equal(again.points, 0, 'bedtime points only once per night');
  assert.equal((await api.getSleepWeek(today())).streak, 1);

  await api.addWins({ date: today(), items: ['Walked', '', 'Read'] });
  assert.deepEqual((await api.listWins()).items[0].items, ['Walked', 'Read']);

  const { goal } = await api.createGoal({ title: 'Read 10 pages', target: 3 });
  const upd = await api.updateGoal(goal._id, { progress: 5 });
  assert.equal(upd.goal.progress, 3);
  assert.equal(upd.goal.done, true);

  const { activity } = await api.randomActivity({ category: 'Calm' });
  assert.equal(activity.category, 'Calm');
  let pts = 0;
  for (let i = 0; i < 4; i++) pts += (await api.completeActivity({ date: today(), activityId: activity.id })).points;
  assert.equal(pts, 15, 'activity points capped at 3 per day');

  await api.joinEvent('evt-walk', true);
  assert.ok((await api.getCampus()).events.find((e) => e.id === 'evt-walk').joined);

  const bundle = api.buildImportBundle(today());
  assert.equal(bundle.sleepLogs.length, 1);
  assert.equal(bundle.activityLogs.length, 4);
  await api.deleteAllData();
  assert.equal(api.hasLocalProfile(), false);
});
