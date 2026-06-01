import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, getDocs, getDoc, doc, setDoc, updateDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── FIREBASE ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyA2-zZWiFW9-LmT8yC1fHyqqOAcSfhhAhk",
  authDomain: "kas-database.firebaseapp.com",
  projectId: "kas-database",
  storageBucket: "kas-database.firebasestorage.app",
  messagingSenderId: "1059230782602",
  appId: "1:1059230782602:web:f9a46b49e9ad9ef2a48973"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

// ── STATE ─────────────────────────────────────────────────
let allUsers = {};
let currentUser = null;

// ── THEME ─────────────────────────────────────────────────
window.toggleTheme = function () {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-btn').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('ks_theme', isDark ? 'light' : 'dark');
};

function initTheme() {
  const saved = localStorage.getItem('ks_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-btn').textContent = saved === 'dark' ? '🌙' : '☀️';
}

// ── UTILS ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getInitials(name) {
  return (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatNumber(num) {
  return num ? num.toLocaleString() : '0';
}

// ── RENDER LEADERBOARDS ───────────────────────────────────
function renderLeaderboard(elementId, metric, label) {
  const users = Object.values(allUsers)
    .filter(u => u[metric] > 0)
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
    .slice(0, 10);

  const listEl = document.getElementById(elementId);
  
  if (!users.length) {
    listEl.innerHTML = '<div class="loading">No users yet — go vote and be first! 🚀</div>';
    return;
  }

  listEl.innerHTML = users.map((user, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'first' : rank === 2 ? 'second' : rank === 3 ? 'third' : '';
    const initials = escHtml(getInitials(user.displayName));
    const count = formatNumber(user[metric] || 0);
    
    return `<div class="lb-row">
      <div class="lb-rank ${rankClass}">${rank}</div>
      <div class="lb-avatar">${initials}</div>
      <div class="lb-info">
        <div class="lb-name">${escHtml(user.displayName || 'Anonymous')}</div>
        ${user.email ? `<div class="lb-email">${escHtml(user.email || '')}</div>` : ''}
      </div>
      <div class="lb-stat">
        <div class="lb-stat-val">${count}</div>
        <div class="lb-stat-label">${label}</div>
      </div>
    </div>`;
  }).join('');
}

function renderTopContributors() {
  const users = Object.values(allUsers)
    .map(u => ({
      ...u,
      score: (u.votesCount || 0) + (u.itemsAdded || 0) * 2 + (u.commentsCount || 0)
    }))
    .filter(u => u.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const listEl = document.getElementById('contributors-list');
  
  if (!users.length) {
    listEl.innerHTML = '<div class="loading">No contributors yet — go vote and be first! 🚀</div>';
    return;
  }

  listEl.innerHTML = users.map((user, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'first' : rank === 2 ? 'second' : rank === 3 ? 'third' : '';
    const initials = escHtml(getInitials(user.displayName));
    
    return `<div class="lb-row">
      <div class="lb-rank ${rankClass}">${rank}</div>
      <div class="lb-avatar">${initials}</div>
      <div class="lb-info">
        <div class="lb-name">${escHtml(user.displayName || 'Anonymous')}</div>
        ${user.email ? `<div class="lb-email">${escHtml(user.email || '')}</div>` : ''}
      </div>
      <div class="lb-stats" style="display:flex; gap:.5rem; flex-wrap:wrap;">
        <div class="lb-stat">
          <div class="lb-stat-val">${formatNumber(user.votesCount || 0)}</div>
          <div class="lb-stat-label">Votes</div>
        </div>
        <div class="lb-stat">
          <div class="lb-stat-val">${formatNumber(user.itemsAdded || 0)}</div>
          <div class="lb-stat-label">Items</div>
        </div>
        <div class="lb-stat">
          <div class="lb-stat-val">${formatNumber(user.commentsCount || 0)}</div>
          <div class="lb-stat-label">Comments</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── SUBSCRIBE TO USERS ────────────────────────────────────
function subscribeUsers() {
  onSnapshot(collection(db, 'users'), (snap) => {
    allUsers = {};
    snap.docs.forEach(d => {
      allUsers[d.id] = { uid: d.id, ...d.data() };
    });
    renderAll();
  }, (err) => console.error('Users error:', err.code));
}

function renderAll() {
  renderLeaderboard('votes-list', 'votesCount', 'votes');
  renderLeaderboard('items-list', 'itemsAdded', 'items');
  renderLeaderboard('comments-list', 'commentsCount', 'comments');
  renderTopContributors();
}

// ── INIT ──────────────────────────────────────────────────
async function init() {
  initTheme();
  subscribeUsers();
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });
}

init();
