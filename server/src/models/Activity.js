import mongoose from 'mongoose';

// Catalogue of offline activities for "Bored? Try this" (seeded).
const activitySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,
  minutes: { type: Number, default: 15 },
  category: { type: String, enum: ['Move', 'Connect', 'Calm', 'Create'] },
  emoji: String,
});

export const Activity = mongoose.model('Activity', activitySchema);
