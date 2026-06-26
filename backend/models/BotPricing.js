import mongoose from 'mongoose';

const botPricingSchema = new mongoose.Schema({
  botType: { type: String, required: true, unique: true },
  price: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model('BotPricing', botPricingSchema);
