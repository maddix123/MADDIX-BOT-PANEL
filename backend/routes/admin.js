import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import BotInstance from '../models/BotInstance.js';
import Bot from '../models/Bot.js';
import Package from '../models/Package.js';
import BotPricing from '../models/BotPricing.js';
import { stopBot, restartBot } from '../services/botDeploy.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== STATS ====================
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const stats = {
      users: await User.countDocuments(),
      totalBots: await BotInstance.countDocuments(),
      activeBots: await BotInstance.countDocuments({ status: 'connected' }),
      totalCoins: await User.aggregate([{ $group: { _id: null, total: { $sum: '$coins' } } }]).then(r => r[0]?.total || 0)
    };
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ==================== USER MANAGEMENT ====================
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.post('/user/:id/coins', authenticate, requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.addCoins(parseInt(amount), 'Admin updated coins');
    res.json({ message: 'Coins updated successfully', coins: user.coins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update coins' });
  }
});

router.put('/user/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, email, coins, role, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (username) user.username = username;
    if (email) user.email = email;
    if (coins !== undefined) user.coins = parseInt(coins);
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();
    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/user/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Stop and delete all bot instances owned by this user
    const instances = await BotInstance.find({ user: user._id });
    const botInstances = req.app.get('botInstances');
    for (const inst of instances) {
      await stopBot(inst, botInstances).catch(() => {});
      try {
        const base = path.join(__dirname, '../../bots', inst.botType, 'instances', inst.instanceId);
        if (fs.existsSync(base)) fs.rmSync(base, { recursive: true, force: true });
      } catch (e) {}
      await BotInstance.deleteOne({ _id: inst._id });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User and all their bot instances deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ==================== BOT INSTANCE MONITORING & CONTROLS ====================
router.get('/bots', authenticate, requireAdmin, async (req, res) => {
  try {
    const bots = await BotInstance.find().populate('user', 'username email').sort({ createdAt: -1 });
    res.json({ bots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get bots' });
  }
});

router.get('/bot/:instanceId/logs', authenticate, requireAdmin, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({ instanceId: req.params.instanceId });
    if (!bot) return res.status(404).json({ error: 'Bot instance not found' });
    res.json({ logs: bot.logs.slice(-50) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

router.post('/bot/:instanceId/restart', authenticate, requireAdmin, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({ instanceId: req.params.instanceId });
    if (!bot) return res.status(404).json({ error: 'Bot instance not found' });

    const io = req.app.get('io');
    const botInstances = req.app.get('botInstances');
    await restartBot(bot, botInstances, io);
    res.json({ message: 'Bot restart initiated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restart bot' });
  }
});

router.post('/bot/:instanceId/stop', authenticate, requireAdmin, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({ instanceId: req.params.instanceId });
    if (!bot) return res.status(404).json({ error: 'Bot instance not found' });

    const botInstances = req.app.get('botInstances');
    await stopBot(bot, botInstances);
    res.json({ message: 'Bot stopped successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

router.delete('/bot/:instanceId', authenticate, requireAdmin, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({ instanceId: req.params.instanceId });
    if (!bot) return res.status(404).json({ error: 'Bot instance not found' });

    const botInstances = req.app.get('botInstances');
    const io = req.app.get('io');

    await stopBot(bot, botInstances).catch(() => {});
    try {
      const base = path.join(__dirname, '../../bots', bot.botType, 'instances', bot.instanceId);
      if (fs.existsSync(base)) fs.rmSync(base, { recursive: true, force: true });
    } catch (e) {}

    await User.findByIdAndUpdate(bot.user, { $pull: { botInstances: bot._id } });
    await BotInstance.deleteOne({ _id: bot._id });

    if (io) {
      io.to(`user:${bot.user}`).emit('bot:deleted', { instanceId: bot.instanceId });
    }

    res.json({ message: 'Bot instance permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// ==================== BOT CONFIGURATION & PRICING ====================
router.get('/bot-pricing', authenticate, requireAdmin, async (req, res) => {
  try {
    // We return bots from the main Bot model as they hold display configurations, prices and default durations
    let pricing = await Bot.find();
    if (pricing.length === 0) {
      // Seed if missing
      await Bot.create([
        {
          botId: 'bot-one',
          name: 'bot-one',
          displayName: 'Maddix Bot One',
          description: 'Full-featured WhatsApp bot with 250+ commands.',
          cost: 5,
          durationDays: 30,
          isActive: true
        },
        {
          botId: 'bot-two',
          name: 'bot-two',
          displayName: 'Maddix Bot Two',
          description: 'Group management focused WhatsApp bot.',
          cost: 5,
          durationDays: 30,
          isActive: true
        }
      ]);
      pricing = await Bot.find();
    }
    res.json({ pricing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get bot pricing' });
  }
});

router.post('/bot-pricing', authenticate, requireAdmin, async (req, res) => {
  try {
    const { pricing } = req.body; // array of { botId, cost, durationDays, isActive }
    for (const p of pricing) {
      await Bot.findOneAndUpdate(
        { botId: p.botId },
        { 
          cost: parseInt(p.cost), 
          durationDays: parseInt(p.durationDays),
          isActive: p.isActive !== undefined ? p.isActive : true
        },
        { upsert: true }
      );
    }
    res.json({ message: 'Bot prices & durations updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// ==================== PACKAGES ====================
router.get('/packages', authenticate, requireAdmin, async (req, res) => {
  try {
    const packages = await Package.find().sort({ createdAt: -1 });
    res.json({ packages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get packages' });
  }
});

router.post('/packages', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, botType, price, durationDays } = req.body;
    const pkg = await Package.create({
      name,
      botType,
      price: parseInt(price),
      durationDays: parseInt(durationDays)
    });
    res.json({ message: 'Package created successfully', package: pkg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create package' });
  }
});

router.delete('/packages/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.json({ message: 'Package deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

export default router;
