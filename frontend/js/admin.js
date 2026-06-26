const API_URL = '/api';
const token = localStorage.getItem('maddix_token');

if (!token) {
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadUsers();
  loadBots();
  loadBotPricing();
  loadPackages();
});

// ==================== STATS ====================
async function loadStats() {
  try {
    const res = await fetch(`${API_URL}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load stats');
    const data = await res.json();
    document.getElementById('admin-users').textContent = data.stats.users;
    document.getElementById('admin-bots').textContent = data.stats.totalBots;
    document.getElementById('admin-active').textContent = data.stats.activeBots;
    document.getElementById('admin-coins').textContent = data.stats.totalCoins;
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

// ==================== USER MANAGEMENT ====================
async function loadUsers() {
  try {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('users-list');
    
    if (!data.users || data.users.length === 0) {
      container.innerHTML = '<div class="empty-state">No users registered yet</div>';
      return;
    }

    container.innerHTML = data.users.map(u => {
      const userJson = encodeURIComponent(JSON.stringify(u));
      return `
        <div class="bot-item">
          <div>
            <strong>${u.username}</strong> ${u.role === 'admin' ? '<span class="status-badge status-pending" style="font-size: 10px;">Admin</span>' : ''}
            <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
              ${u.email} | Status: <span style="color: ${u.isActive ? 'var(--success)' : 'var(--danger)'}">${u.isActive ? 'Active' : 'Disabled'}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="coins-badge">${u.coins} coins</span>
            <button class="btn btn-secondary btn-sm" onclick="addCoins('${u._id}', 50)">+50</button>
            <button class="btn btn-secondary btn-sm" onclick="addCoins('${u._id}', 100)">+100</button>
            <button class="btn btn-primary btn-sm" onclick="openEditUser('${userJson}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser('${u._id}')" style="background: var(--danger);">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    showToast('error', 'Error', 'Failed to load users');
  }
}

async function addCoins(userId, amount) {
  try {
    const res = await fetch(`${API_URL}/admin/user/${userId}/coins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount })
    });
    if (!res.ok) throw new Error('Failed to update coins');
    showToast('success', 'Success', `Updated user balance by ${amount} coins`);
    loadUsers();
    loadStats();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

function openEditUser(encodedUser) {
  const u = JSON.parse(decodeURIComponent(encodedUser));
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.id = 'edit-user-modal';
  modal.innerHTML = `
    <div class="modal" style="max-width: 450px;">
      <h2>Edit User</h2>
      <p>Modify account options for ${u.username}</p>
      <form id="edit-user-form" onsubmit="saveUser(event, '${u._id}')">
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="edit-username" value="${u.username}" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="edit-email" value="${u.email}" required>
        </div>
        <div class="form-group">
          <label>Coins</label>
          <input type="number" id="edit-coins" value="${u.coins}" required>
        </div>
        <div class="form-group">
          <label>Role</label>
          <select id="edit-role" class="duration-select" style="width: 100%; padding: 12px 16px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px;">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
          <input type="checkbox" id="edit-active" ${u.isActive ? 'checked' : ''} style="width: auto;">
          <label for="edit-active" style="margin-bottom: 0;">Account Active</label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('edit-user-modal').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

async function saveUser(e, userId) {
  e.preventDefault();
  const username = document.getElementById('edit-username').value;
  const email = document.getElementById('edit-email').value;
  const coins = parseInt(document.getElementById('edit-coins').value);
  const role = document.getElementById('edit-role').value;
  const isActive = document.getElementById('edit-active').checked;

  try {
    const res = await fetch(`${API_URL}/admin/user/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username, email, coins, role, isActive })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update user');
    }

    showToast('success', 'User Updated', 'User account updated successfully');
    document.getElementById('edit-user-modal').remove();
    loadUsers();
    loadStats();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function deleteUser(userId) {
  if (!confirm('⚠️ Are you sure you want to permanently delete this user?\nAll their deployed bots and configuration will be terminated!')) return;
  try {
    const res = await fetch(`${API_URL}/admin/user/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to delete user');
    showToast('success', 'User Deleted', 'User deleted successfully');
    loadUsers();
    loadStats();
    loadBots();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

// ==================== BOT MONITORING & CONTROL ====================
async function loadBots() {
  try {
    const res = await fetch(`${API_URL}/admin/bots`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('bots-list');
    
    if (!data.bots || data.bots.length === 0) {
      container.innerHTML = '<div class="empty-state">No bots deployed on the system</div>';
      return;
    }

    container.innerHTML = data.bots.map(b => {
      const expDate = b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : 'N/A';
      return `
        <div class="bot-item">
          <div>
            <strong>${b.name}</strong> <span style="font-size: 11px; color: var(--text-muted);">(${b.instanceId})</span>
            <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
              Owner: <strong>${b.user?.username || 'Deleted User'}</strong> (${b.user?.email || 'N/A'})
            </div>
            <div style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">
              Type: ${b.botType} | Phone: ${b.phoneNumber || 'Not bound'} | Expires: <span style="color: var(--warning); font-weight: 600;">${expDate}</span> (${b.durationDays} days)
            </div>
            ${b.pairingCode ? `<div style="margin-top: 4px; font-size: 12px; color: var(--primary);">Pairing Code: <strong>${b.pairingCode}</strong></div>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="status-badge status-${b.status}">${b.status}</span>
            <button class="btn btn-secondary btn-sm" onclick="viewBotLogs('${b.instanceId}')">Logs</button>
            <button class="btn btn-secondary btn-sm" onclick="restartBotInstance('${b.instanceId}')">Restart</button>
            <button class="btn btn-secondary btn-sm" onclick="stopBotInstance('${b.instanceId}')">Stop</button>
            <button class="btn btn-danger btn-sm" onclick="deleteBotInstance('${b.instanceId}')" style="background: var(--danger);">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    showToast('error', 'Error', 'Failed to load bots');
  }
}

async function viewBotLogs(instanceId) {
  try {
    const res = await fetch(`${API_URL}/admin/bot/${instanceId}/logs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load logs');
    const data = await res.json();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'logs-modal';
    modal.innerHTML = `
      <div class="modal" style="max-width: 650px; width: 90%;">
        <h2>Bot Logs - ${instanceId}</h2>
        <p>Real-time terminal output logs</p>
        <div class="logs-container" style="max-height: 350px; background: #000; color: #0f0; padding: 16px;">
          ${data.logs && data.logs.length > 0 ? data.logs.map(log => `
            <div class="log-entry" style="border: none; padding: 2px 0;">
              <span class="timestamp" style="color: #888;">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span class="log-${log.level}" style="color: ${log.level === 'error' ? '#ff5555' : '#55ff55'};">${log.message}</span>
            </div>
          `).join('') : '<p style="color: #888;">No logs are registered for this bot yet.</p>'}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="document.getElementById('logs-modal').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function restartBotInstance(instanceId) {
  try {
    const res = await fetch(`${API_URL}/admin/bot/${instanceId}/restart`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to restart bot');
    showToast('success', 'Bot Restarted', 'Restart command sent successfully');
    loadBots();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function stopBotInstance(instanceId) {
  try {
    const res = await fetch(`${API_URL}/admin/bot/${instanceId}/stop`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to stop bot');
    showToast('info', 'Bot Stopped', 'Bot instance has been stopped');
    loadBots();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function deleteBotInstance(instanceId) {
  if (!confirm('⚠️ Permanently delete this bot? This will kill its process and purge its storage directory!')) return;
  try {
    const res = await fetch(`${API_URL}/admin/bot/${instanceId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to delete bot');
    showToast('success', 'Bot Deleted', 'Bot instance permanently removed');
    loadBots();
    loadStats();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

// ==================== BOT CONFIGURATION & PRICING ====================
async function loadBotPricing() {
  try {
    const res = await fetch(`${API_URL}/admin/bot-pricing`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('bot-pricing-list');
    
    container.innerHTML = data.pricing.map(p => `
      <div class="package-card" style="margin-bottom: 12px;" data-bot-id="${p.botId}">
        <div style="font-weight: 700; margin-bottom: 8px; font-size: 15px; color: var(--primary);">${p.displayName || p.name} (${p.botId})</div>
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 12px;">Rent Cost (Coins)</label>
          <input type="number" class="bot-cost-input" value="${p.cost}" style="padding: 6px 12px;">
        </div>
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 12px;">Rent Duration (Days)</label>
          <input type="number" class="bot-duration-input" value="${p.durationDays || 30}" style="padding: 6px 12px;">
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
          <input type="checkbox" class="bot-active-input" ${p.isActive ? 'checked' : ''} style="width: auto;">
          <label style="margin-bottom: 0; font-size: 13px;">Active / Available to rent</label>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast('error', 'Error', 'Failed to load bot pricing');
  }
}

async function saveBotPrices() {
  const cards = document.querySelectorAll('#bot-pricing-list .package-card');
  const pricing = [];
  
  cards.forEach(card => {
    const botId = card.getAttribute('data-bot-id');
    const cost = parseInt(card.querySelector('.bot-cost-input').value);
    const durationDays = parseInt(card.querySelector('.bot-duration-input').value);
    const isActive = card.querySelector('.bot-active-input').checked;
    
    pricing.push({ botId, cost, durationDays, isActive });
  });

  try {
    const res = await fetch(`${API_URL}/admin/bot-pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ pricing })
    });
    if (!res.ok) throw new Error('Failed to save prices');
    showToast('success', 'Prices Saved', 'Bot prices and durations updated successfully');
    loadBotPricing();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

// ==================== RENTAL PACKAGES ====================
async function loadPackages() {
  try {
    const res = await fetch(`${API_URL}/admin/packages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('packages-list');
    
    if (!data.packages || data.packages.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding: 20px;">No custom rental packages created yet</div>';
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px;">
        ${data.packages.map(p => `
          <div class="package-card" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h4 style="color: var(--primary); margin-bottom: 6px;">${p.name}</h4>
              <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Bot: ${p.botType === 'bot-one' ? 'Maddix Bot One' : 'Maddix Bot Two'}</div>
              <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Duration: <strong>${p.durationDays} Days</strong></div>
              <div style="font-size: 15px; font-weight: 700; color: var(--warning); margin-top: 8px;">${p.price} Coins</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deletePackage('${p._id}')" style="margin-top: 12px; width: 100%;">Delete Package</button>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    showToast('error', 'Error', 'Failed to load packages');
  }
}

async function createPackage() {
  const name = document.getElementById('pkg-name').value.trim();
  const botType = document.getElementById('pkg-bot-type').value;
  const price = parseInt(document.getElementById('pkg-price').value);
  const durationDays = parseInt(document.getElementById('pkg-duration').value);

  if (!name) {
    showToast('error', 'Validation Error', 'Please enter a package name');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/admin/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, botType, price, durationDays })
    });
    
    if (!res.ok) throw new Error('Failed to create package');
    
    showToast('success', 'Package Created', 'Package created successfully');
    document.getElementById('pkg-name').value = '';
    loadPackages();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

async function deletePackage(pkgId) {
  if (!confirm('Are you sure you want to delete this package?')) return;
  try {
    const res = await fetch(`${API_URL}/admin/packages/${pkgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to delete package');
    showToast('success', 'Package Deleted', 'Package deleted successfully');
    loadPackages();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

// ==================== COMMON UTILITIES ====================
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
