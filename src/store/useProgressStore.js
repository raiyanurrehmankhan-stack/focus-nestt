import { create } from 'zustand';

/** Points, level and streaks (doc 6.2: useProgressStore). */
export const useProgressStore = create((set) => ({
  points: 0,
  level: { level: 1, name: 'Hatchling', progress: 0, toNext: 800, intoLevel: 0, perLevel: 800 },
  streakDays: 0,
  sleepStreak: 0,
  apply: (p) => {
    if (!p) return;
    set((s) => ({
      points: p.points ?? s.points,
      level: p.level && typeof p.level === 'object' ? p.level : s.level,
      streakDays: p.streakDays ?? s.streakDays,
      sleepStreak: p.sleepStreak ?? s.sleepStreak,
    }));
  },
}));
