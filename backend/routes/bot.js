import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import Bot from '../models/Bot.js';
import User from '../models/User.js';
import BotInstance from '../models/BotInstance.js';
import { deployBot, stopBot, restartBot } from '../services/botDeploy.js';

const router = express.Router();

router.get('/available', authenticate, async (req, res) => {
  try {
    const bots = await Bot.find({ isActive: true });
    res.json({ bots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get bots' });
  }
});

router.post('/deploy', authenticate, [
  body('botType').isIn(['bot-one', 'bot-two']),
  body('instanceName').trim().isLength({ min: 2, max: 50 }),
  body('phoneNumber').trim().notEmpty().matches(/^\+?[0-9\s\-]{10,20}$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { botType, instanceName, phoneNumber } = req.body;
    const user = await User.findById(req.user._id);

    const bot = await Bot.findOne({ botId: botType });
    if (!bot) return res.status(400).json({ error: 'Invalid bot type' });

    if (!user.canDeploy(bot.cost)) {
      return res.status(400).json({ error: 'Insufficient coins', required: bot.cost, current: user.coins });
    }

    const userBotCount = await BotInstance.countDocuments({ user: user._id });
    if (userBotCount >= (process.env.MAX_BOTS_PER_USER || 10)) {
      return res.status(400).json({ error: 'Maximum bot limit reached' });
    }

    const instanceId = uuidv4().substring(0, 8).toUpperCase();
    const botInstance = new BotInstance({
      instanceId,
      name: instanceName,
      botType,
      user: user._id,
      cost: bot.cost,
      status: 'pending',
      phoneNumber: phoneNumber.replace(/[\s\-]/g, '').replace(/^\+/, '')
    });

    await botInstance.save();
    await User.findByIdAndUpdate(user._id, { $push: { botInstances: botInstance._id } });
    await user.deductCoins(bot.cost, `Deployed ${bot.displayName}`, botInstance._id);

    const io = req.app.get('io');
    const botInstances = req.app.get('botInstances');

    deployBot(botInstance, botInstances, io).catch(err => {
      console.error('Deploy error:', err);
    });

    res.status(201).json({
      message: 'Bot deployment started',
      instance: {
        instanceId: botInstance.instanceId,
        name: botInstance.name,
        botType: botInstance.botType,
        status: botInstance.status,
        cost: botInstance.cost
      }
    });
  } catch (err) {
    console.error('Deploy route error:', err);
    res.status(500).json({ error: 'Failed to deploy bot' });
  }
});

router.get('/instance/:instanceId', authenticate, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({
      instanceId: req.params.instanceId,
      user: req.user._id
    });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    res.json({ bot });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get bot' });
  }
});

router.post('/restart/:instanceId', authenticate, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({ instanceId: req.params.instanceId, user: req.user._id });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    const io = req.app.get('io');
    const botInstances = req.app.get('botInstances');
    await restartBot(bot, botInstances, io);
    res.json({ message: 'Bot restart initiated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restart bot' });
  }
});

router.get('/logs/:instanceId', authenticate, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({ instanceId: req.params.instanceId, user: req.user._id });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    res.json({ logs: bot.logs.slice(-50) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

router.post('/stop/:instanceId', authenticate, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({ instanceId: req.params.instanceId, user: req.user._id });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    const botInstances = req.app.get('botInstances');
    await stopBot(bot, botInstances);
    res.json({ message: 'Bot stopped' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

router.delete('/:instanceId', authenticate, async (req, res) => {
  try {
    const bot = await BotInstance.findOne({ instanceId: req.params.instanceId, user: req.user._id });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    const botInstances = req.app.get('botInstances');
    const io = req.app.get('io');
    // stop process
    await stopBot(bot, botInstances).catch(()=>{});
    // delete session folder
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const base = path.join(__dirname, '../../bots', bot.botType, 'instances', bot.instanceId);
      if (fs.existsSync(base)) fs.rmSync(base, { recursive: true, force: true });
    } catch(e){}
    // remove from user
    await User.findByIdAndUpdate(req.user._id, { $pull: { botInstances: bot._id } });
    await BotInstance.deleteOne({ _id: bot._id });
    if (io) io.to(`user:${req.user._id}`).emit('bot:deleted', { instanceId: bot.instanceId });
    res.json({ success: true, message: 'Bot deleted permanently' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

export default router;
