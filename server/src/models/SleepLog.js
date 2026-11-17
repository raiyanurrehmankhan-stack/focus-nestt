import mongoose from 'mongoose';

const sleepSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // the night that started on this local date
    bedtimeGoal: { type: String },
    actualBedtime: { type: String },
    wakeTime: { type: String },
    hoursSlept: { type: Number, min: 0, max: 24 },
    checklistDone: { type: [String], default: [] },
    onTarget: { type: Boolean, default: false },
    pointsAwarded: { type: Boolean, default: false },
  },
  { timestamps: true },
);
sleepSchema.index({ userId: 1, date: 1 }, { unique: true });

export const SleepLog = mongoose.model('SleepLog', sleepSchema);
