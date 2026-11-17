import mongoose from 'mongoose';

const campusEventSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  date: String, // human readable schedule, e.g. "Every Tuesday, 5:30 PM"
  place: String,
  type: { type: String, enum: ['Campus', 'Local', 'Workplace'] },
  link: String,
  emoji: String,
});

export const CampusEvent = mongoose.model('CampusEvent', campusEventSchema);
