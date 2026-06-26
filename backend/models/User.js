import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  coins: { type: Number, default: 0 },
  referralCode: { type: String, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isActive: { type: Boolean, default: true },
  botInstances: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BotInstance' }]
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.canDeploy = function(cost) {
  return this.coins >= cost;
};

userSchema.methods.deductCoins = async function(amount, reason, botInstanceId) {
  if (this.coins < amount) throw new Error('Insufficient coins');
  this.coins -= amount;
  await this.save();
  return this;
};

userSchema.methods.addCoins = async function(amount, reason) {
  this.coins += amount;
  await this.save();
  return this;
};

export default mongoose.model('User', userSchema);
