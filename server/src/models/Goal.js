import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 100 },
    target: { type: Number, default: 1, min: 1 },
    progress: { type: Number, default: 0, min: 0 },
    dueDate: { type: String },
    done: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Goal = mongoose.model('Goal', goalSchema);
