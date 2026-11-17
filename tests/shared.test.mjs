// Unit tests for the shared business rules and validation schemas.
// Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import * as R from '../shared/rules.js';
import { makeSchemas } from '../shared/schemas.js';

const S = makeSchemas(z);

test('date helpers', () => {
  assert.equal(R.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(R.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(R.weekStart('2026-11-17'), '2026-11-16'); // Tuesday -> Monday
  assert.equal(R.weekStart('2026-11-22'), '2026-11-16'); // Sunday -> Monday
  assert.deepEqual(R.lastNDays('2026-11-17', 3), ['2026-11-15', '2026-11-16', '2026-11-17']);
});

test('bedtime on target wraps around midnight', () => {
  assert.equal(R.isBedtimeOnTarget('23:45', '00:10'), true);
  assert.equal(R.isBedtimeOnTarget('23:00', '23:31'), false);
  assert.equal(R.isBedtimeOnTarget('22:30', '22:00'), true);
  assert.equal(R.clockDistance('23:50', '00:20'), 30);
  assert.equal(R.formatClock('00:05'), '12:05 AM');
  assert.equal(R.formatClock('13:30'), '1:30 PM');
});

test('focus points follow +10 per 25 minutes', () => {
  assert.equal(R.focusPoints(25), 10);
  assert.equal(R.focusPoints(50), 20);
  assert.equal(R.focusPoints(24), 0);
  assert.equal(R.focusPoints(0, { demo: true }), 10);
});

test('level info matches design (3,420 points -> level 5, 580 to next)', () => {
  const l = R.levelInfo(3420);
  assert.equal(l.level, 5);
  assert.equal(l.name, 'Fledgling Focus');
  assert.equal(l.toNext, 580);
});

test('sleep streak counts consecutive on-target nights', () => {
  const logs = ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'].map((date) => ({ date, onTarget: true }));
  assert.equal(R.sleepStreak(logs, '2026-11-17'), 4); // today not logged yet
  assert.equal(R.sleepStreak([...logs, { date: '2026-11-17', onTarget: true }], '2026-11-17'), 5);
  assert.equal(R.sleepStreak([...logs.slice(0, 2), ...logs.slice(3)], '2026-11-17'), 1);
  assert.equal(R.sleepStreak([], '2026-11-17'), 0);
});

test('danger hour insight detects late-night use', () => {
  const late = [1, 2, 3, 4].map((i) => ({ date: `2026-11-1${i}`, bedtime: '01:30', screenHours: 6 }));
  const r = R.dangerHourInsight(late);
  assert.equal(r.level, 'warning');
  assert.match(r.message, /after 12 AM/);
  const early = [1, 2, 3].map((i) => ({ date: `2026-11-1${i}`, bedtime: '21:30', screenHours: 2 }));
  assert.equal(R.dangerHourInsight(early).level, 'success');
  assert.equal(R.dangerHourInsight([]).level, 'info');
});

test('weekly screen series has 7 days with gaps as null', () => {
  const s = R.weeklyScreenSeries([{ date: '2026-11-17', screenHours: 3 }], '2026-11-17');
  assert.equal(s.length, 7);
  assert.equal(s[6].hours, 3);
  assert.equal(s[0].hours, null);
});

test('quests are personalised from struggles and track progress', () => {
  const codes = R.questCodesFor(['gaming', 'comparison']);
  assert.ok(codes.includes('game-over-on-time'));
  assert.ok(codes.includes('my-own-race'));
  const data = {
    focusSessions: [1, 2, 3].map(() => ({ date: '2026-11-17', completed: true, plannedMinutes: 25 })),
    sleepLogs: [], checkins: [], breaks: [], wins: [], activityLogs: [],
  };
  const quests = R.weeklyQuests(data, { struggles: [] }, '2026-11-17');
  const mm = quests.find((q) => q.code === 'mindful-morning');
  assert.equal(mm.completed, true);
  assert.equal(mm.percent, 100);
  assert.equal(R.pendingQuestRewards(data, { struggles: [] }, '2026-11-17').length, 1);
  assert.equal(R.pendingQuestRewards(data, { struggles: [], questAwards: [{ weekId: '2026-11-16', code: 'mindful-morning' }] }, '2026-11-17').length, 0);
});

test('badges unlock from data', () => {
  const data = { focusSessions: [{ date: '2026-11-17', completed: true }], sleepLogs: [], wins: [], activityLogs: [] };
  const b = R.evaluateBadges(data, { points: 1200 }, '2026-11-17');
  assert.ok(b.includes('first-flight'));
  assert.ok(b.includes('century-club'));
  assert.ok(!b.includes('deep-thinker'));
});

test('break helpers', () => {
  const end = new Date('2026-11-17T10:00:00Z');
  assert.equal(R.returnedOnTime(end, new Date('2026-11-17T10:01:00Z')), true);
  assert.equal(R.returnedOnTime(end, new Date('2026-11-17T10:05:00Z')), false);
  assert.equal(R.canExtend([{}, {}]), false);
  assert.equal(R.remainingMs({ status: 'paused', pausedRemainingMs: 5000 }), 5000);
});

test('schemas accept valid input and reject bad input', () => {
  assert.equal(S.checkIn.safeParse({ date: '2026-11-17', screenHours: 3.5, mainApps: ['Instagram'], bedtime: '23:30', mood: 'good' }).success, true);
  assert.equal(S.checkIn.safeParse({ date: '17-11-2026', screenHours: 30, bedtime: '25:00', mood: 'meh' }).success, false);
  const reg = S.register.safeParse({ email: 'A@Example.com ', password: 'secret123', name: 'Alex' });
  assert.equal(reg.success, true);
  assert.equal(reg.data.email, 'a@example.com');
  assert.equal(reg.data.bedtimeGoal, '23:00');
  assert.equal(S.register.safeParse({ email: 'a@b.co', password: 'short', name: 'A' }).success, false);
  assert.equal(S.register.safeParse({ email: 'a@b.co', password: 'secret123', name: 'A', ageGroup: 'Under 18' }).success, false);
  assert.equal(S.register.safeParse({ email: 'a@b.co', password: 'secret123', name: 'A', ageGroup: 'Under 18', parentalConsent: true }).success, true);
  assert.equal(S.profileUpdate.safeParse({ isAdmin: true }).success, false, 'unknown keys rejected');
  assert.equal(S.wins.safeParse({ date: '2026-11-17', items: ['', ''] }).success, false);
  assert.equal(S.breakExtend.safeParse({ reason: 'ok' }).success, false);
});
