import express from 'express';
import BotInstance from '../models/BotInstance.js';

const router = express.Router();

router.post('/bot-pairing-code', async (req, res) => {
  try {
    const { instanceId, code } = req.body;
    const bot = await BotInstance.findOne({ instanceId });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    bot.pairingCode = code;
    bot.status = 'waiting_for_pairing';
    await bot.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${bot.user}`).emit('bot:pairing-code', { instanceId, code, message: `Your pairing code: ${code}` });
      io.to(`user:${bot.user}`).emit('bot:status', { instanceId, status: 'waiting_for_pairing', message: `Enter code: ${code}` });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process pairing code' });
  }
});

router.post('/bot-status', async (req, res) => {
  try {
    const { instanceId, status, phone } = req.body;
    const bot = await BotInstance.findOne({ instanceId });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    bot.status = status;
    if (phone) bot.phoneNumber = phone;
    await bot.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${bot.user}`).emit('bot:status', {
        instanceId,
        status,
        phone,
        message: status === 'connected' ? 'WhatsApp connected!' : `Status: ${status}`
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.post('/bot-logs', async (req, res) => {
  try {
    const { instanceId, level, message } = req.body;
    const bot = await BotInstance.findOne({ instanceId });
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    await bot.addLog(level || 'info', message);

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${bot.user}`).emit('bot:log', { instanceId, level: level || 'info', message, timestamp: new Date() });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log' });
  }
});

export default router;
