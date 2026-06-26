import User from '../models/User.js';
import Bot from '../models/Bot.js';
import bcrypt from 'bcryptjs';

export async function initBots() {
  const defaultBots = [
    {
      botId: 'bot-one',
      name: 'bot-one',
      displayName: 'Maddix Bot One',
      description: 'Full-featured WhatsApp bot with 250+ commands, AI chat, media download, and group management.',
      version: '6.0.0',
      cost: 5,
      icon: '🤖',
      features: ['250+ Commands', 'AI Chat', 'Media Download', 'Group Management', 'Auto-Restart']
    },
    {
      botId: 'bot-two',
      name: 'bot-two',
      displayName: 'Maddix Bot Two',
      description: 'Group management focused WhatsApp bot with tag-all, mute, warns, and welcome messages.',
      version: '3.0.6',
      cost: 5,
      icon: '⚔️',
      features: ['Tag All', 'Mute/Unmute', 'Warn System', 'Welcome/Goodbye', 'Anti-link']
    }
  ];

  for (const botData of defaultBots) {
    const existing = await Bot.findOne({ botId: botData.botId });
    if (!existing) await Bot.create(botData);
  }
}

export async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@maddix.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'MaddixAdmin123!';

  const existing = await User.findOne({ email: adminEmail });
  if (!existing) {
    await User.create({
      username: 'admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      coins: 999999,
      referralCode: 'ADMIN00'
    });
    console.log('✅ Admin user created');
  }
}

export default async function seed() {
  await initBots();
  await seedAdmin();
}
