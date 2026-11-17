import mongoose from 'mongoose';

// A completed offline activity (+5 points).
const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    activityKey: { type: String, required: true },
    title: String,
    points: { type: Number, default: 0 },
  },
  { timestamps: true },
);
activityLogSchema.index({ userId: 1, date: -1 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
