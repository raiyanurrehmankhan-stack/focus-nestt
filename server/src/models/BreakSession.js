import mongoose from 'mongoose';

const extensionSchema = new mongoose.Schema({ reason: { type: String, maxlength: 200 }, minutes: Number, at: { type: Date, default: Date.now } }, { _id: false });

const breakSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    plannedMinutes: { type: Number, required: true },
    demo: { type: Boolean, default: false },
    extensions: { type: [extensionSchema], default: [] },
    // running -> ended (alarm shown) -> closed (back to focus) | cancelled
    status: { type: String, enum: ['running', 'ended', 'closed', 'cancelled'], default: 'running', index: true },
    endedAt: Date,
    closedAt: Date,
    returnedOnTime: { type: Boolean, default: false },
  },
  { timestamps: true },
);
breakSchema.index({ userId: 1, date: -1 });

export const BreakSession = mongoose.model('BreakSession', breakSchema);
