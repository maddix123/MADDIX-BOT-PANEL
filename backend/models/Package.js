import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  botType: { type: String, enum: ['bot-one', 'bot-two'], required: true },
  price: { type: Number, required: true },
  durationDays: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model('Package', packageSchema);
