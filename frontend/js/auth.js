const API_URL = '/api';

if (localStorage.getItem('maddix_token')) {
  window.location.href = '/dashboard';
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(`${tab}-form`).classList.add('active');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    
    localStorage.setItem('maddix_token', data.token);
    localStorage.setItem('maddix_user', JSON.stringify(data.user));
    window.location.href = '/dashboard';
  } catch (err) {
    showToast('error', 'Login Failed', err.message);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const referralCode = document.getElementById('register-referral').value;
  
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, referralCode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    
    localStorage.setItem('maddix_token', data.token);
    localStorage.setItem('maddix_user', JSON.stringify(data.user));
    window.location.href = '/dashboard';
  } catch (err) {
    showToast('error', 'Registration Failed', err.message);
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
  toast.innerHTML = `
    <h4>${title}</h4>
    <p>${message}</p>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
