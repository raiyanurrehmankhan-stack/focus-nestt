import mongoose from 'mongoose';

const focusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    goalText: { type: String, default: '', maxlength: 120 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    plannedMinutes: { type: Number, required: true },
    actualMinutes: { type: Number, default: 0 },
    demo: { type: Boolean, default: false },
    status: { type: String, enum: ['running', 'paused', 'completed', 'cancelled'], default: 'running', index: true },
    pausedRemainingMs: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    pointsAwarded: { type: Number, default: 0 },
    completedAt: Date,
  },
  { timestamps: true },
);
focusSchema.index({ userId: 1, date: -1 });

export const FocusSession = mongoose.model('FocusSession', focusSchema);
