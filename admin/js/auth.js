// 後台登入 / token 管理（規格書 §17）

var TOKEN_KEY = 'adminToken';
var TOKEN_EXPIRY_KEY = 'adminTokenExpiry';

function callGAS(payload) {
  return fetch(CONFIG.GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  }).then(function (res) { return res.json(); });
}

function getToken() { return localStorage.getItem(TOKEN_KEY); }

function isLoggedIn() {
  var token = getToken();
  var expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) return false;
  return new Date(expiry) > new Date();
}

function saveToken(token, expiresAt) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  showScreen('login');
}

function setupPassword() {
  var pw = document.getElementById('setup-password').value;
  callGAS({ action: 'setupPassword', password: pw })
    .then(function (res) {
      if (res.ok) { showScreen('login'); }
      else { document.getElementById('setup-error').textContent = res.error; }
    });
}

function login() {
  var pw = document.getElementById('login-password').value;
  callGAS({ action: 'adminLogin', password: pw })
    .then(function (res) {
      if (res.ok) {
        saveToken(res.adminToken, res.expiresAt);
        showScreen('dashboard');
        loadDashboard();
      } else {
        document.getElementById('login-error').textContent = res.error;
      }
    });
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  document.getElementById('screen-' + name).classList.add('active');
}

function goTo(page) { window.location.href = page; }

// 初始化：已登入則直接顯示後台
document.addEventListener('DOMContentLoaded', function () {
  if (isLoggedIn()) {
    showScreen('dashboard');
    if (typeof loadDashboard === 'function') loadDashboard();
  }
});
