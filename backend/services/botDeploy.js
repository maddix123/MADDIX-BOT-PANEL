import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_PATHS = {
  'bot-one': path.join(__dirname, '../../bots/bot-one'),
  'bot-two': path.join(__dirname, '../../bots/bot-two')
};

const PANEL_URL = process.env.PANEL_URL || 'http://localhost:4000';
const WHATSAPP_GROUP = 'K9EzrPMPsb10GThtpalAyM';

export async function deployBot(botInstance, botInstances, io) {
  try {
    await botInstance.addLog('info', `Starting deployment of ${botInstance.botType}...`);

    const instanceDir = path.join(BOT_PATHS[botInstance.botType], 'instances', botInstance.instanceId);
    fs.mkdirSync(instanceDir, { recursive: true });

    await copyBotFiles(botInstance.botType, instanceDir);
    await createInstanceConfig(instanceDir, botInstance);

    botInstance.status = 'connecting';
    await botInstance.save();

    io.to(`user:${botInstance.user}`).emit('bot:status', {
      instanceId: botInstance.instanceId,
      status: 'connecting',
      message: 'Starting bot, requesting pairing code from WhatsApp...'
    });

    await startBotProcess(botInstance, instanceDir, botInstances, io);
  } catch (err) {
    console.error('Deploy error:', err);
    botInstance.status = 'error';
    await botInstance.addLog('error', err.message);
    await botInstance.save();
  }
}

async function copyBotFiles(botType, destDir) {
  const srcDir = BOT_PATHS[botType];
  if (!fs.existsSync(srcDir)) throw new Error(`Bot source not found: ${botType}`);

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'session' || entry.name === 'instances') continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyBotFilesRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // copy node_modules if present in source to speed up
  const srcNodeModules = path.join(srcDir, 'node_modules');
  const destNodeModules = path.join(destDir, 'node_modules');
  if (fs.existsSync(srcNodeModules) && !fs.existsSync(destNodeModules)) {
    console.log(`[DEPLOY] Copying node_modules for ${botType}...`);
    fs.cpSync(srcNodeModules, destNodeModules, { recursive: true });
  }
}

async function copyBotFilesRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'session') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyBotFilesRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function createInstanceConfig(instanceDir, botInstance) {
  const pairingNumber = (botInstance.phoneNumber || '256752972945').replace(/\D/g, '');

  // Owner of THIS bot instance is the renter, not the panel admin.
  // Previously hardcoded to 256752972945 which sent every bot's
  // "connected" DM to the panel admin instead of the actual user.
  const envContent = `
SESSION_ID=${botInstance.instanceId}
BOT_NAME="Maddix ${botInstance.botType === 'bot-one' ? 'Bot One' : 'Bot Two'}"
BOT_OWNER="Maddix Portal"
OWNER_NUMBER="${pairingNumber}"
INSTANCE_ID="${botInstance.instanceId}"
PAIRING_NUMBER="${pairingNumber}"
PANEL_URL="${PANEL_URL}"
WHATSAPP_GROUP="${WHATSAPP_GROUP}"
  `.trim();

  fs.writeFileSync(path.join(instanceDir, '.env'), envContent);

  const panelConfig = {
    instanceId: botInstance.instanceId,
    panelUrl: PANEL_URL,
    botType: botInstance.botType
  };
  fs.writeFileSync(path.join(instanceDir, 'panel.json'), JSON.stringify(panelConfig, null, 2));
}

async function startBotProcess(botInstance, instanceDir, botInstances, io) {
  await installDependencies(instanceDir);

  const botProcess = spawn('node', ['index.js'], {
    cwd: instanceDir,
    env: {
      ...process.env,
      INSTANCE_ID: botInstance.instanceId,
      SESSION_ID: botInstance.instanceId,
      PAIRING_NUMBER: (botInstance.phoneNumber || '256752972945').replace(/\D/g, ''),
      PANEL_URL
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const instanceData = {
    process: botProcess,
    instanceId: botInstance.instanceId,
    directory: instanceDir,
    startTime: new Date(),
    restartCount: 0
  };

  botInstances.set(botInstance.instanceId, instanceData);
  botInstance.processId = botProcess.pid;
  await botInstance.save();

  botProcess.stdout.on('data', async (data) => {
    const output = data.toString();
    await handleOutput(botInstance, output, 'info', io);
  });

  botProcess.stderr.on('data', async (data) => {
    const output = data.toString();
    await handleOutput(botInstance, output, 'error', io);
  });

  botProcess.on('exit', async (code) => {
    console.log(`Bot ${botInstance.instanceId} exited with code ${code}`);
    const instance = botInstances.get(botInstance.instanceId);
    if (!instance) return;

    // Reset the restart counter if the bot ran healthily for a while
    // (>= 5 min). Otherwise a bot that once hit maxRestarts is dead forever,
    // which is exactly the "bot suddenly went off and never came back" bug.
    const uptimeMs = Date.now() - new Date(instance.startTime).getTime();
    if (uptimeMs > 5 * 60 * 1000) {
      instance.restartCount = 0;
    }

    if (instance.restartCount < botInstance.maxRestarts) {
      instance.restartCount++;
      instance.process = null;
      // Exponential-ish backoff: 5s, 10s, 20s, capped at 60s
      const delayMs = Math.min(60000, 5000 * Math.pow(2, instance.restartCount - 1));
      setTimeout(() => {
        startBotProcess(botInstance, instanceDir, botInstances, io).catch(console.error);
      }, delayMs);
    } else {
      await botInstance.addLog('error',
        `Bot exceeded ${botInstance.maxRestarts} restarts within 5 min. ` +
        `Marking disconnected. Use Restart from the panel to retry.`);
      await botInstance.markDisconnected();
      botInstances.delete(botInstance.instanceId);
    }
  });
}

async function installDependencies(dir) {
  return new Promise((resolve) => {
    // if node_modules exists, skip or just patch
    const nm = path.join(dir, 'node_modules');
    if (fs.existsSync(nm)) {
      patchBaileys(dir).then(() => resolve());
      return;
    }
    exec('npm install --legacy-peer-deps --silent 2>&1', { cwd: dir, timeout: 180000 }, (error) => {
      if (error) console.error('npm install error:', error.message);
      patchBaileys(dir).then(() => resolve());
    });
  });
}

async function patchBaileys(dir) {
  try {
    const v1 = path.join(dir, 'node_modules', '@whiskeysockets', 'baileys', 'lib', 'Utils', 'validate-connection.js');
    const v2 = path.join(dir, 'node_modules', '@whiskeysockets', 'baileys', 'lib', 'Socket', 'socket.js');
    if (fs.existsSync(v1)) {
      let c = fs.readFileSync(v1, 'utf8');
      c = c.replace(/passive:\s*true,/g, 'passive: false,');
      c = c.replace(/\s*lidDbMigrated:\s*false,?\n/g, '\n');
      fs.writeFileSync(v1, c);
    }
    if (fs.existsSync(v2)) {
      let c = fs.readFileSync(v2, 'utf8');
      c = c.replace(/await noise\.finishInit\(\);/g, 'noise.finishInit();');
      fs.writeFileSync(v2, c);
    }
  } catch(e) {
    console.log('Patch warning:', e.message);
  }
}

async function handleOutput(botInstance, output, level, io) {
  // Detect real WhatsApp pairing codes - supports both formats:
  // PAIRING CODE FROM WHATSAPP: XXXX-XXXX
  // Raw: XXXXXXXX
  // Also legacy 6-8 digit
  let code = null;
  
  const patterns = [
    /PAIRING CODE FROM WHATSAPP:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i,
    /Raw:\s*([A-Z0-9]{8})/i,
    /PAIRING_CODE[:\s]+([A-Z0-9\-]{8,9})/i,
    /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/,
    /\b([A-Z0-9]{8})\b/,
    /code[:\s]*([0-9]{6,8})/i
  ];
  
  for (const re of patterns) {
    const m = output.match(re);
    if (m && m[1]) {
      code = m[1].toUpperCase().replace(/\s/g, '');
      // Validate: 8 alphanumeric, or XXXX-XXXX, or 6-8 digits
      if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) || /^[A-Z0-9]{8}$/.test(code) || /^[0-9]{6,8}$/.test(code)) {
        break;
      } else {
        code = null;
      }
    }
  }

  if (code) {
    // Normalize to XXXX-XXXX for display
    if (/^[A-Z0-9]{8}$/.test(code)) {
      code = code.slice(0,4) + '-' + code.slice(4);
    }
    botInstance.pairingCode = code;
    botInstance.status = 'waiting_for_pairing';
    await botInstance.save();
    io.to(`user:${botInstance.user}`).emit('bot:pairing-code', { instanceId: botInstance.instanceId, code });
    await botInstance.addLog('info', `✅ Pairing code from WhatsApp: ${code}`);
    console.log(`[LIVE] ${botInstance.instanceId} => ${code}`);
    return;
  }

  if (output.toLowerCase().includes('connected') || output.toLowerCase().includes('authenticated') || output.includes('✅ Connected')) {
    if (botInstance.status !== 'connected') {
      await botInstance.markConnected();
      io.to(`user:${botInstance.user}`).emit('bot:status', {
        instanceId: botInstance.instanceId,
        status: 'connected',
        message: 'WhatsApp connected!'
      });
    }
  }

  const message = output.length > 300 ? output.substring(0, 300) + '...' : output;
  if (output.trim().length > 0) {
    await botInstance.addLog(level, message);
    io.to(`user:${botInstance.user}`).emit('bot:log', {
      instanceId: botInstance.instanceId,
      level,
      message,
      timestamp: new Date()
    });
  }
}

export async function stopBot(botInstance, botInstances) {
  const instance = botInstances.get(botInstance.instanceId);
  if (instance && instance.process) {
    instance.process.kill('SIGTERM');
    botInstances.delete(botInstance.instanceId);
  }
  await botInstance.markDisconnected();
  await botInstance.addLog('info', 'Bot stopped by user');
  return { success: true };
}

export async function restartBot(botInstance, botInstances, io) {
  const instance = botInstances.get(botInstance.instanceId);
  if (instance && instance.process) {
    instance.process.kill('SIGTERM');
    botInstances.delete(botInstance.instanceId);
  }
  
  // clear session to force fresh code
  try {
    const instanceDir = path.join(BOT_PATHS[botInstance.botType], 'instances', botInstance.instanceId);
    const sessionDir = path.join(instanceDir, 'session');
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  } catch(e) {}

  botInstance.pairingCode = null;
  botInstance.status = 'connecting';
  await botInstance.save();
  await botInstance.addLog('info', 'Restarting bot, requesting fresh pairing code from WhatsApp...');
  
  io.to(`user:${botInstance.user}`).emit('bot:status', {
    instanceId: botInstance.instanceId,
    status: 'connecting',
    message: 'Restarting bot, requesting fresh pairing code from WhatsApp...'
  });
  
  setTimeout(() => {
    const instanceDir = path.join(BOT_PATHS[botInstance.botType], 'instances', botInstance.instanceId);
    startBotProcess(botInstance, instanceDir, botInstances, io).catch(console.error);
  }, 2000);
  return { success: true };
}
