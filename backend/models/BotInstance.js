import mongoose from 'mongoose';

const botInstanceSchema = new mongoose.Schema({
  instanceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  botType: { type: String, enum: ['bot-one', 'bot-two'], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  phoneNumber: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'connecting', 'waiting_for_pairing', 'connected', 'disconnected', 'error', 'restarting'], default: 'pending' },
  pairingCode: { type: String, default: null },
  cost: { type: Number, default: 5 },
  processId: { type: Number },
  logs: [{ level: String, message: String, timestamp: { type: Date, default: Date.now } }],
  maxRestarts: { type: Number, default: 5 }
}, { timestamps: true });

botInstanceSchema.methods.addLog = async function(level, message) {
  this.logs.push({ level, message, timestamp: new Date() });
  if (this.logs.length > 100) this.logs = this.logs.slice(-100);
  await this.save();
};

botInstanceSchema.methods.markConnected = async function(phone) {
  this.status = 'connected';
  this.phoneNumber = phone || this.phoneNumber;
  await this.save();
};

botInstanceSchema.methods.markDisconnected = async function() {
  this.status = 'disconnected';
  await this.save();
};

export default mongoose.model('BotInstance', botInstanceSchema);
