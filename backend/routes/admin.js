import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import BotInstance from '../models/BotInstance.js';
import Bot from '../models/Bot.js';
import Package from '../models/Package.js';
import BotPricing from '../models/BotPricing.js';

const router = express.Router();

// Existing routes
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

router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/bots', authenticate, requireAdmin, async (req, res) => {
  try {
    const bots = await BotInstance.find().populate('user', 'username email').sort({ createdAt: -1 });
    res.json({ bots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get bots' });
  }
});

router.post('/user/:id/coins', authenticate, requireAdmin, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.addCoins(parseInt(amount), 'Admin added coins');
    res.json({ message: 'Coins added', coins: user.coins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add coins' });
  }
});

// ==================== NEW: BOT PRICING ROUTES ====================

router.get('/bot-pricing', authenticate, requireAdmin, async (req, res) => {
  try {
    let pricing = await BotPricing.find();
    
    // Create default pricing if none exists
    if (pricing.length === 0) {
      await BotPricing.create([
        { botType: 'bot-one', price: 5 },
        { botType: 'bot-two', price: 5 }
      ]);
      pricing = await BotPricing.find();
    }
    
    res.json({ pricing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

router.post('/bot-pricing', authenticate, requireAdmin, async (req, res) => {
  try {
    const { pricing } = req.body;
    
    for (const p of pricing) {
      await BotPricing.findOneAndUpdate(
        { botType: p.botType },
        { price: p.price },
        { upsert: true }
      );
    }
    
    res.json({ message: 'Prices updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// ==================== NEW: PACKAGES ROUTES ====================

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
    
    res.json({ message: 'Package created', package: pkg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create package' });
  }
});

router.delete('/packages/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.json({ message: 'Package deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

export default router;
