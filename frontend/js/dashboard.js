const API_URL = '/api';
const token = localStorage.getItem('maddix_token');
let user = null;
let socket = null;
let currentBotType = null;
let currentBotCost = 0;
let pairingInterval = null;
let pairingTimer = null;
let currentPairingInstance = null;

if (!token) {
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  setupSocket();
});

async function loadDashboard() {
  try {
    const res = await fetch(`${API_URL}/user/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load dashboard');
    const data = await res.json();
    user = data.user;
    
    document.getElementById('user-coins').textContent = user.coins;
    document.getElementById('user-name').textContent = user.username;
    document.getElementById('coins-stat').textContent = user.coins;
    document.getElementById('total-bots').textContent = data.stats.totalBots;
    document.getElementById('active-bots').textContent = data.stats.activeBots;
    document.getElementById('referral-code').textContent = user.referralCode;
    
    renderDeployedBots(user.botInstances);
    loadAvailableBots();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function loadAvailableBots() {
  try {
    const res = await fetch(`${API_URL}/bot/available`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('available-bots');
    container.innerHTML = data.bots.map(bot => `
      <div class="bot-card">
        <h3>${bot.icon} ${bot.displayName}</h3>
        <p style="color: var(--text-muted); font-size: 14px;">${bot.description}</p>
        <div class="features">
          ${bot.features.slice(0, 4).map(f => `
            <div class="feature-item">
              <span>✓</span>
              <span>${f}</span>
            </div>
          `).join('')}
        </div>
        <div class="cost">
          <span><strong>${bot.cost}</strong> coins</span>
          <button class="btn btn-primary btn-sm" onclick="openDeployModal('${bot.botId}', ${bot.cost})">Deploy</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Load bots error:', err);
  }
}

function renderDeployedBots(bots) {
  const container = document.getElementById('deployed-bots');
  if (!bots || bots.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🤖</div>
        <h3>No bots deployed yet</h3>
        <p>Deploy a bot above to get started!</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `<div class="bot-list">${bots.map(bot => `
    <div class="bot-item">
      <div>
        <strong>${bot.name}</strong>
        <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
          ID: ${bot.instanceId} | ${bot.botType === 'bot-one' ? '⚔️ KnightBot' : '🚀 MEGA-MD'} | Phone: ${bot.phoneNumber || 'Not connected'}
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="status-badge status-${bot.status}">${bot.status}</span>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${bot.status === 'pending' || bot.status === 'connecting' || bot.status === 'waiting_for_pairing' ? `
            <button class="btn btn-secondary btn-sm" onclick="showPairingModal('${bot.instanceId}')">Pairing Code</button>
          ` : ''}
          <button class="btn btn-secondary btn-sm" onclick="viewLogs('${bot.instanceId}')">Logs</button>
          <button class="btn btn-secondary btn-sm" onclick="restartBot('${bot.instanceId}')">Restart</button>
          <button class="btn btn-secondary btn-sm" onclick="stopBot('${bot.instanceId}')">Stop</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBot('${bot.instanceId}')" style="background:#e74c3c;color:white;border:none;">Delete</button>
        </div>
      </div>
    </div>
  `).join('')}</div>`;
}

function openDeployModal(botType, cost) {
  if (user.coins < cost) {
    showToast('error', 'Insufficient Coins', `You need ${cost} coins`);
    return;
  }
  currentBotType = botType;
  currentBotCost = cost;
  document.getElementById('deploy-form').reset();
  document.getElementById('deploy-modal').classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (id === 'pairing-modal') {
    if (pairingInterval) clearInterval(pairingInterval);
    if (pairingTimer) clearInterval(pairingTimer);
  }
}

async function submitDeploy(e) {
  e.preventDefault();
  const name = document.getElementById('deploy-name').value.trim();
  const phone = document.getElementById('deploy-phone').value.trim().replace(/[\s\-]/g, '').replace(/^\+/, '');
  
  try {
    const res = await fetch(`${API_URL}/bot/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ botType: currentBotType, instanceName: name, phoneNumber: phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Deploy failed');
    
    closeModal('deploy-modal');
    showToast('success', 'Deploying', 'Your bot is starting...');
    loadDashboard();
    
    setTimeout(() => {
      showPairingModal(data.instance.instanceId);
    }, 2000);
  } catch (err) {
    showToast('error', 'Deploy Failed', err.message);
  }
}

async function showPairingModal(instanceId) {
  currentPairingInstance = instanceId;
  document.getElementById('pairing-code').textContent = '⏳';
  document.getElementById('pairing-timer').textContent = 'Code expires in 60 seconds';
  document.getElementById('pairing-modal').classList.add('active');
  document.getElementById('regenerate-btn').disabled = false;
  document.getElementById('regenerate-btn').textContent = 'Get New Code';
  
  try {
    const res = await fetch(`${API_URL}/bot/instance/${instanceId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.bot?.phoneNumber) {
      document.getElementById('pairing-phone').textContent = '+' + data.bot.phoneNumber;
    }
    if (data.bot?.pairingCode) {
      document.getElementById('pairing-code').textContent = data.bot.pairingCode;
      startPairingTimer(60);
    }
  } catch (err) {
    console.error('Check pairing code error:', err);
  }
  
  if (pairingInterval) clearInterval(pairingInterval);
  pairingInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/bot/instance/${instanceId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.bot?.status === 'connected') {
        closeModal('pairing-modal');
        showToast('success', 'Connected!', 'WhatsApp is now connected.');
        loadDashboard();
      }
      if (data.bot?.pairingCode && document.getElementById('pairing-code').textContent !== data.bot.pairingCode) {
        document.getElementById('pairing-code').textContent = data.bot.pairingCode;
        startPairingTimer(60);
      }
    } catch (err) {
      console.error('Pairing check error:', err);
    }
  }, 3000);
}

function startPairingTimer(seconds) {
  if (pairingTimer) clearInterval(pairingTimer);
  let remaining = seconds;
  const timerEl = document.getElementById('pairing-timer');
  const update = () => {
    remaining--;
    if (remaining <= 0) {
      timerEl.textContent = 'Code expired. Click Get New Code.';
      clearInterval(pairingTimer);
    } else {
      timerEl.textContent = `Code expires in ${remaining} seconds`;
    }
  };
  update();
  pairingTimer = setInterval(update, 1000);
}

async function regenerateCode() {
  if (!currentPairingInstance) return;
  const btn = document.getElementById('regenerate-btn');
  btn.disabled = true;
  btn.textContent = 'Requesting...';
  
  try {
    const res = await fetch(`${API_URL}/bot/restart/${currentPairingInstance}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to restart bot');
    
    document.getElementById('pairing-code').textContent = '⏳';
    document.getElementById('pairing-timer').textContent = 'Requesting new code from WhatsApp...';
    showToast('info', 'New Code', 'Requesting fresh pairing code from WhatsApp...');
    
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Get New Code';
    }, 5000);
  } catch (err) {
    showToast('error', 'Error', err.message);
    btn.disabled = false;
    btn.textContent = 'Get New Code';
  }
}

async function restartBot(instanceId) {
  try {
    const res = await fetch(`${API_URL}/bot/restart/${instanceId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Restart failed');
    showToast('success', 'Restarting', 'Bot restart initiated');
    loadDashboard();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function stopBot(instanceId) {
  if (!confirm('Stop this bot?')) return;
  try {
    const res = await fetch(`${API_URL}/bot/stop/${instanceId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Stop failed');
    showToast('info', 'Stopped', 'Bot stopped');
    loadDashboard();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function deleteBot(instanceId) {
  if (!confirm('⚠️ PERMANENTLY DELETE this bot?\n\nThis will:\n- Kill the process\n- Delete session files\n- Remove from your account\n\nThis cannot be undone!')) return;
  try {
    const res = await fetch(`${API_URL}/bot/${instanceId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    showToast('success', 'Deleted', 'Bot permanently deleted');
    loadDashboard();
  } catch (err) {
    showToast('error', 'Delete Failed', err.message);
  }
}

async function viewLogs(instanceId) {
  try {
    const res = await fetch(`${API_URL}/bot/logs/${instanceId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-width: 600px;">
        <h2>Bot Logs</h2>
        <div class="logs-container">
          ${data.logs.map(log => `
            <div class="log-entry">
              <span class="timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
              <span class="log-${log.level}">${log.message}</span>
            </div>
          `).join('') || '<p style="color: var(--text-muted);">No logs yet</p>'}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (err) {
    showToast('error', 'Error', 'Failed to load logs');
  }
}

function setupSocket() {
  socket = io({ auth: { token } });
  
  socket.on('bot:pairing-code', (data) => {
    document.getElementById('pairing-code').textContent = data.code;
    startPairingTimer(60);
  });
  
  socket.on('bot:status', (data) => {
    if (data.status === 'connected') {
      closeModal('pairing-modal');
      showToast('success', 'Connected!', data.message);
    }
    loadDashboard();
  });
  
  socket.on('bot:deleted', (data) => {
    showToast('info', 'Deleted', `Bot ${data.instanceId} removed`);
    loadDashboard();
  });
}

function showToast(type, title, message) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<h4>${title}</h4><p>${message}</p>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function logout() {
  localStorage.removeItem('maddix_token');
  localStorage.removeItem('maddix_user');
  window.location.href = '/';
}
