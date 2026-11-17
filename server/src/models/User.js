import mongoose from 'mongoose';

const pointsEntry = new mongoose.Schema({ at: { type: Date, default: Date.now }, amount: Number, reason: String }, { _id: false });
const questAward = new mongoose.Schema({ weekId: String, code: String, at: { type: Date, default: Date.now } }, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0, select: false },

    // Onboarding quiz
    userType: { type: String, default: 'University student' },
    ageGroup: { type: String },
    parentalConsent: { type: Boolean, default: false },
    struggles: { type: [String], default: [] },
    dangerTime: { type: String },

    // Preferences
    screenGoalHours: { type: Number, default: 4 },
    bedtimeGoal: { type: String, default: '23:00' },
    wakeGoal: { type: String, default: '07:00' },
    defaultBreakMinutes: { type: Number, default: 30 },
    theme: { type: String, enum: ['auto', 'light', 'dark', 'system'], default: 'auto' },
    demoMode: { type: Boolean, default: false },
    soundOn: { type: Boolean, default: true },
    buddyEmail: { type: String, default: '', lowercase: true, trim: true },

    // Night Lock (simulated in the web app; enforced by the Android app in Phase 3)
    nightLock: {
      enabled: { type: Boolean, default: false },
      bedtime: { type: String, default: '23:30' },
      apps: { type: [String], default: ['social', 'video'] },
      emergencyOverride: { type: Boolean, default: true },
    },

    // Community hub
    joinedEvents: { type: [String], default: [] },

    // Progress (doc 7.3: points stored on User)
    points: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1 },
    streakDays: { type: Number, default: 0 },
    bestSleepStreak: { type: Number, default: 0 },
    questAwards: { type: [questAward], default: [] },
    pointsHistory: { type: [pointsEntry], default: [] },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  const o = this.toObject({ versionKey: false });
  delete o.passwordHash;
  delete o.tokenVersion;
  o.id = String(o._id);
  delete o._id;
  return o;
};

export const User = mongoose.model('User', userSchema);
