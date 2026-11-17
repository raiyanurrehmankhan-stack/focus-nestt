import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true },
    type: { type: String, enum: ['laptop', 'phone', 'tablet'], required: true },
    label: { type: String, default: 'My device', maxlength: 60 },
    pushSubscription: {
      endpoint: String,
      expirationTime: Number,
      keys: { p256dh: String, auth: String },
    },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export const Device = mongoose.model('Device', deviceSchema);
