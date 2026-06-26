import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import BotInstance from '../models/BotInstance.js';

const router = express.Router();

router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('botInstances');
    const activeBots = user.botInstances.filter(b => b.status === 'connected').length;
    const totalBots = user.botInstances.length;

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        coins: user.coins,
        role: user.role,
        referralCode: user.referralCode,
        botInstances: user.botInstances
      },
      stats: {
        totalBots,
        activeBots
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

router.delete('/bot/:instanceId', authenticate, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({ instanceId: req.params.instanceId, user: req.user._id });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    await User.findByIdAndUpdate(req.user._id, { $pull: { botInstances: bot._id } });
    await BotInstance.findByIdAndDelete(bot._id);

    res.json({ message: 'Bot deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

export default router;
