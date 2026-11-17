import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true },
  unlockedAt: { type: Date, default: Date.now },
});
badgeSchema.index({ userId: 1, code: 1 }, { unique: true });

export const Badge = mongoose.model('Badge', badgeSchema);
