import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // local YYYY-MM-DD
    screenHours: { type: Number, min: 0, max: 24, required: true },
    mainApps: { type: [String], default: [] },
    bedtime: { type: String, required: true },
    mood: { type: String, required: true },
    note: { type: String, maxlength: 280 },
  },
  { timestamps: true },
);
checkInSchema.index({ userId: 1, date: 1 }, { unique: true });

export const CheckIn = mongoose.model('CheckIn', checkInSchema);
