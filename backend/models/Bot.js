import mongoose from 'mongoose';

const botSchema = new mongoose.Schema({
  botId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  displayName: { type: String, required: true },
  description: { type: String },
  version: { type: String },
  cost: { type: Number, default: 5 },
  icon: { type: String, default: '🤖' },
  features: [{ type: String }],
  isActive: { type: Boolean, default: true },
  durationDays: { type: Number, default: 30 }
}, { timestamps: true });

export default mongoose.model('Bot', botSchema);
