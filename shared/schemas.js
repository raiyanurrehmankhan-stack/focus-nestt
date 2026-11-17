// Input validation schemas shared by the API and the web app.
// Written as a factory so each side passes in its own copy of zod
// (the API and the web app install their dependencies separately).
import { DANGER_TIMES, MOODS, NIGHT_LOCK_APPS, STRUGGLES, USER_TYPES, WIND_DOWN_CHECKLIST } from './constants.js';

export function makeSchemas(z) {
  const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-01-31');
  const clock = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Use a time like 23:30');
  const text = (max) => z.string().trim().max(max);
  const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

  const profileFields = {
    name: text(40).min(1, 'Please enter your name'),
    userType: z.enum(USER_TYPES),
    ageGroup: z.enum(['Under 18', '18-24', '25-34', '35+']).optional(),
    struggles: z.array(z.enum(STRUGGLES.map((s) => s.id))).max(STRUGGLES.length),
    dangerTime: z.enum(DANGER_TIMES).optional(),
    screenGoalHours: z.number().min(0.5).max(16),
    bedtimeGoal: clock,
    wakeGoal: clock.optional(),
    defaultBreakMinutes: z.number().int().min(1).max(120),
    theme: z.enum(['auto', 'light', 'dark', 'system']),
    demoMode: z.boolean(),
    soundOn: z.boolean(),
    buddyEmail: z.union([z.string().trim().toLowerCase().email().max(120), z.literal('')]),
    parentalConsent: z.boolean().optional(),
  };

  const register = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(120),
    password: z.string().min(8, 'Use at least 8 characters').max(128)
      .regex(/[A-Za-z]/, 'Include at least one letter').regex(/\d/, 'Include at least one number'),
    ...profileFields,
    userType: profileFields.userType.default('University student'),
    struggles: profileFields.struggles.default([]),
    screenGoalHours: profileFields.screenGoalHours.default(4),
    bedtimeGoal: profileFields.bedtimeGoal.default('23:00'),
    defaultBreakMinutes: profileFields.defaultBreakMinutes.default(30),
    theme: profileFields.theme.default('auto'),
    demoMode: profileFields.demoMode.default(false),
    soundOn: profileFields.soundOn.default(true),
    buddyEmail: profileFields.buddyEmail.default(''),
    importGuestData: z.boolean().optional(),
  }).refine((v) => v.ageGroup !== 'Under 18' || v.parentalConsent === true, {
    message: 'Users under 18 need a parent or guardian to agree before creating an account', path: ['parentalConsent'],
  });

  const login = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z.string().min(1, 'Enter your password').max(128),
  });

  const profileUpdate = z.object(profileFields).partial().strict();

  const checkIn = z.object({
    date: dateKey,
    screenHours: z.number().min(0).max(24),
    mainApps: z.array(text(30)).max(8).default([]),
    bedtime: clock,
    mood: z.enum(MOODS.map((m) => m.id)),
    note: text(280).optional(),
  });

  const focusStart = z.object({
    date: dateKey,
    goalText: text(120).default(''),
    plannedMinutes: z.number().int().min(1).max(180).default(25),
    demo: z.boolean().default(false),
  });
  const focusUpdate = z.object({ action: z.enum(['pause', 'resume', 'complete', 'cancel']) });

  const breakStart = z.object({
    date: dateKey,
    minutes: z.number().int().min(1).max(120).default(30),
    demo: z.boolean().default(false),
  });
  const breakExtend = z.object({
    reason: text(200).min(3, 'Tell yourself why in a few words'),
    minutes: z.number().int().min(1).max(15).default(5),
  });
  const breakClose = z.object({ date: dateKey, startFocus: z.boolean().default(true), goalText: text(120).optional() });

  const sleepLog = z.object({
    date: dateKey,
    bedtimeGoal: clock.optional(),
    actualBedtime: clock.optional(),
    wakeTime: clock.optional(),
    hoursSlept: z.number().min(0).max(24).optional(),
    checklistDone: z.array(z.enum(WIND_DOWN_CHECKLIST.map((c) => c.id))).max(WIND_DOWN_CHECKLIST.length).optional(),
  });

  const wins = z.object({
    date: dateKey,
    items: z.array(text(140)).min(1, 'Add at least one win').max(3).transform((a) => a.filter(Boolean)),
  }).refine((v) => v.items.length > 0, { message: 'Add at least one win', path: ['items'] });

  const goalCreate = z.object({
    title: text(100).min(1, 'Give your goal a name'),
    target: z.number().int().min(1).max(1000).default(1),
    dueDate: dateKey.optional(),
  });
  const goalUpdate = z.object({
    title: text(100).min(1).optional(),
    target: z.number().int().min(1).max(1000).optional(),
    progress: z.number().int().min(0).max(1000).optional(),
    dueDate: z.union([dateKey, z.literal(null)]).optional(),
  });

  const activityDone = z.object({ date: dateKey, activityId: text(40).min(1) });

  const nightLock = z.object({
    enabled: z.boolean(),
    bedtime: clock,
    apps: z.array(z.enum(NIGHT_LOCK_APPS.map((a) => a.id))).max(NIGHT_LOCK_APPS.length),
    emergencyOverride: z.boolean(),
  }).partial();

  const device = z.object({
    deviceId: z.string().trim().min(8).max(64),
    type: z.enum(['laptop', 'phone', 'tablet']),
    label: text(60).default('My device'),
    pushSubscription: z.object({
      endpoint: z.string().url().max(1000),
      expirationTime: z.number().nullable().optional(),
      keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
    }).nullable().optional(),
  });

  const joinEvent = z.object({ joined: z.boolean() });
  const range = z.object({ from: dateKey.optional(), to: dateKey.optional() });

  return {
    dateKey, clock, objectId, register, login, profileUpdate, checkIn, focusStart, focusUpdate, breakStart,
    breakExtend, breakClose, sleepLog, wins, goalCreate, goalUpdate, activityDone, nightLock, device, joinEvent, range,
  };
}
