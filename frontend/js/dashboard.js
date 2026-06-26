const API_URL = '/api';
const token = localStorage.getItem('maddix_token');
let user = null;
let socket = null;
let currentBotType = null;
let currentBotCost = 0;
let currentBotDuration = 30;
let pairingInterval = null;
let pairingTimer = null;
let currentPairingInstance = null;
let allPackages = [];

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
    await loadAvailableBots();
    await loadPackages();
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
    
    if (!data.bots || data.bots.length === 0) {
      container.innerHTML = '<div class="empty-state">No bots are currently available for renting</div>';
      return;
    }

    container.innerHTML = data.bots.map(bot => `
      <div class="bot-card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3>${bot.icon} ${bot.displayName}</h3>
          <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 12px;">${bot.description}</p>
          <div style="font-size: 13px; color: var(--primary); margin-bottom: 12px; font-weight: 600;">
            📅 Default Plan: ${bot.durationDays || 30} Days
          </div>
          <div class="features">
            ${bot.features.slice(0, 4).map(f => `
              <div class="feature-item">
                <span>✓</span>
                <span>${f}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="cost" style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;">
          <span><strong>${bot.cost}</strong> coins</span>
          <button class="btn btn-primary btn-sm" onclick="openDeployModal('${bot.botId}', ${bot.cost}, ${bot.durationDays || 30})">Deploy</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Load bots error:', err);
  }
}

async function loadPackages() {
  try {
    const res = await fetch(`${API_URL}/bot/packages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    allPackages = data.packages || [];
    
    const container = document.getElementById('packages-cards-container');
    const section = document.getElementById('packages-section');
    
    if (allPackages.length === 0) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    container.innerHTML = allPackages.map(pkg => `
      <div class="bot-card" style="display: flex; flex-direction: column; justify-content: space-between; border-color: var(--warning);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h3 style="font-size: 16px; color: var(--warning); margin-bottom: 0;">🌟 ${pkg.name}</h3>
            <span class="status-badge status-pending" style="font-size: 10px; padding: 2px 8px;">Special</span>
          </div>
          <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">
            Rent plan for <strong>${pkg.botType === 'bot-one' ? 'Maddix Bot One' : 'Maddix Bot Two'}</strong>.
          </p>
          <div style="font-size: 14px; margin-bottom: 4px;">⏱️ Duration: <strong>${pkg.durationDays} Days</strong></div>
          <div style="font-size: 14px; margin-bottom: 4px;">💰 Total cost: <strong>${pkg.price} Coins</strong></div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openDeployWithPackage('${pkg.botType}', '${pkg._id}', ${pkg.price})" style="margin-top: 16px; background: var(--warning); color: #000;">Deploy Package</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Load packages error:', err);
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
  
  container.innerHTML = `<div class="bot-list">${bots.map(bot => {
    const expiresDate = bot.expiresAt ? new Date(bot.expiresAt).toLocaleDateString() : 'N/A';
    return `
      <div class="bot-item" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <strong>${bot.name}</strong>
          <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
            ID: ${bot.instanceId} | ${bot.botType === 'bot-one' ? '🤖 Maddix Bot One' : '⚔️ Maddix Bot Two'} | Phone: ${bot.phoneNumber || 'Not connected'}
          </div>
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">
            Plan duration: <strong>${bot.durationDays} Days</strong> | Expires: <span style="color: var(--warning);">${expiresDate}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class="status-badge status-${bot.status}">${bot.status}</span>
          ${bot.status === 'pending' || bot.status === 'connecting' || bot.status === 'waiting_for_pairing' ? `
            <button class="btn btn-secondary btn-sm" onclick="showPairingModal('${bot.instanceId}')">Pairing Code</button>
          ` : ''}
          <button class="btn btn-secondary btn-sm" onclick="viewLogs('${bot.instanceId}')">Logs</button>
          <button class="btn btn-secondary btn-sm" onclick="restartBot('${bot.instanceId}')">Restart</button>
          <button class="btn btn-secondary btn-sm" onclick="stopBot('${bot.instanceId}')">Stop</button>
          <button class="btn btn-danger btn-sm" onclick="deleteBot('${bot.instanceId}')" style="background:#e74c3c;color:white;border:none;">Delete</button>
        </div>
      </div>
    `;
  }).join('')}</div>`;
}

function openDeployModal(botType, cost, durationDays) {
  if (user.coins < cost) {
    showToast('error', 'Insufficient Coins', `You need ${cost} coins`);
    return;
  }
  currentBotType = botType;
  currentBotCost = cost;
  currentBotDuration = durationDays;
  
  document.getElementById('deploy-form').reset();
  
  // Populate packages dropdown in the modal
  const select = document.getElementById('deploy-package');
  select.innerHTML = `<option value="default" selected>Standard Plan (${durationDays} Days) - ${cost} coins</option>`;
  
  const botPkgs = allPackages.filter(p => p.botType === botType);
  botPkgs.forEach(pkg => {
    select.innerHTML += `<option value="${pkg._id}">${pkg.name} (${pkg.durationDays} Days) - ${pkg.price} coins</option>`;
  });
  
  document.getElementById('deploy-modal').classList.add('active');
}

function openDeployWithPackage(botType, packageId, price) {
  if (user.coins < price) {
    showToast('error', 'Insufficient Coins', `You need ${price} coins for this package`);
    return;
  }
  
  currentBotType = botType;
  currentBotCost = price;
  
  document.getElementById('deploy-form').reset();
  
  // Find bot duration from our default list or keep fallback
  const select = document.getElementById('deploy-package');
  select.innerHTML = '';
  
  const botPkgs = allPackages.filter(p => p.botType === botType);
  botPkgs.forEach(pkg => {
    const isSelected = pkg._id === packageId ? 'selected' : '';
    select.innerHTML += `<option value="${pkg._id}" ${isSelected}>${pkg.name} (${pkg.durationDays} Days) - ${pkg.price} coins</option>`;
  });
  
  // Add standard plan option too as fallback
  select.innerHTML += `<option value="default">Standard Plan (30 Days)</option>`;
  
  document.getElementById('deploy-modal').classList.add('active');
}

function updateSelectedPackageCost() {
  const val = document.getElementById('deploy-package').value;
  if (val === 'default') {
    currentBotCost = 5; // fallback
  } else {
    const pkg = allPackages.find(p => p._id === val);
    if (pkg) {
      currentBotCost = pkg.price;
    }
  }
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
  const packageId = document.getElementById('deploy-package').value;
  
  if (user.coins < currentBotCost) {
    showToast('error', 'Insufficient Coins', `You need ${currentBotCost} coins to deploy`);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/bot/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        botType: currentBotType, 
        instanceName: name, 
        phoneNumber: phone,
        packageId: packageId 
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Deploy failed');
    
    closeModal('deploy-modal');
    showToast('success', 'Deploying', 'Your bot deployment has started!');
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
      <div class="modal" style="max-width: 600px; width: 90%;">
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
