import mongoose from 'mongoose';

const winSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    items: { type: [String], validate: [(a) => a.length >= 1 && a.length <= 3, 'One to three wins'] },
  },
  { timestamps: true },
);
winSchema.index({ userId: 1, date: -1 });

export const Win = mongoose.model('Win', winSchema);
