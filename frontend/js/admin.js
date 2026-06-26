const API_URL = '/api';
const token = localStorage.getItem('maddix_token');

if (!token) {
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadUsers();
  loadBots();
});

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

async function loadUsers() {
  try {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('users-list');
    container.innerHTML = data.users.map(u => `
      <div class="bot-item">
        <div>
          <strong>${u.username}</strong>
          <div style="color: var(--text-muted); font-size: 13px;">${u.email} | Role: ${u.role}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="coins-badge">${u.coins} coins</span>
          <button class="btn btn-primary btn-sm" onclick="addCoins('${u._id}', 10)">+10</button>
          <button class="btn btn-primary btn-sm" onclick="addCoins('${u._id}', 50)">+50</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast('error', 'Error', 'Failed to load users');
  }
}

async function loadBots() {
  try {
    const res = await fetch(`${API_URL}/admin/bots`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('bots-list');
    container.innerHTML = data.bots.map(b => `
      <div class="bot-item">
        <div>
          <strong>${b.name}</strong>
          <div style="color: var(--text-muted); font-size: 13px;">
            User: ${b.user?.username || 'Unknown'} | Type: ${b.botType} | Phone: ${b.phoneNumber || 'None'}
          </div>
        </div>
        <span class="status-badge status-${b.status}">${b.status}</span>
      </div>
    `).join('');
  } catch (err) {
    showToast('error', 'Error', 'Failed to load bots');
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
    if (!res.ok) throw new Error('Failed to add coins');
    showToast('success', 'Success', `Added ${amount} coins`);
    loadUsers();
    loadStats();
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
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
