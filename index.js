import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, increment, serverTimestamp, addDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup
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

// ── ADMIN UIDs — paste your Firebase UID here ──
const ADMIN_UIDS = ['REPLACE_WITH_YOUR_UID'];

// ── DEFAULT ITEMS ─────────────────────────────────────────
const DEFAULTS = [
  { id:'pineapple-pizza',   name:'Pineapple on Pizza',  cat:'Food',    desc:'The controversial Hawaiian pizza topping that divides the world.' },
  { id:'snooze-button',     name:'Alarm Snooze Button', cat:'Habits',  desc:'That extra 9 minutes of bliss... or morning ruin?' },
  { id:'infinite-scroll',   name:'Infinite Scroll',     cat:'Tech',    desc:'Social media feeds with no end — addictive or exhausting?' },
  { id:'crocs',             name:'Crocs Shoes',          cat:'Fashion', desc:'The foam clogs that went from ugly to iconic.' },
  { id:'netflix-autoplay',  name:'Netflix Autoplay',    cat:'Tech',    desc:'Next episode starts automatically. Convenient or pushy?' },
  { id:'open-plan-offices', name:'Open-Plan Offices',   cat:'Habits',  desc:'No walls, no privacy — does collaboration outweigh distraction?' },
  { id:'reboots-remakes',   name:'Reboots & Remakes',   cat:'Movies',  desc:'Hollywood reviving old franchises instead of new stories.' },
  { id:'cilantro',          name:'Cilantro',            cat:'Food',    desc:'Some taste fresh herb goodness, others taste soap. No in-between.' },
];

// ── STATE ─────────────────────────────────────────────────
let items        = [];
let currentIdx   = 0;
let lbTab        = 'keep';
let userVotes    = {};   // itemId -> 'keep'|'skip'
let userReactions = {};  // itemId -> Set of emojis
let currentUser  = null;
let isGuest      = false;
let unsubItems   = null;
let unsubComments = null;
let commentCount = 0;

const REACTION_IDS = { '🔥':'fire', '😂':'laugh', '😮':'wow', '💀':'skull', '❤️':'heart' };

// ── LOCAL STORAGE ─────────────────────────────────────────
function loadLocalVotes() {
  try { const v = localStorage.getItem('ks_votes'); if (v) userVotes = JSON.parse(v); } catch {}
}
function saveLocalVotes() {
  try { localStorage.setItem('ks_votes', JSON.stringify(userVotes)); } catch {}
}
function loadLocalReactions() {
  try {
    const r = localStorage.getItem('ks_reactions');
    if (r) { const p = JSON.parse(r); for (const id in p) userReactions[id] = new Set(p[id]); }
  } catch {}
}
function saveLocalReactions() {
  try {
    const out = {};
    for (const id in userReactions) out[id] = [...userReactions[id]];
    localStorage.setItem('ks_reactions', JSON.stringify(out));
  } catch {}
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

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

// ── AUTH ──────────────────────────────────────────────────
window.switchAuthTab = function (tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('field-username').style.display = tab === 'signup' ? 'flex' : 'none';
  document.getElementById('auth-submit').textContent = tab === 'signup' ? 'Create Account' : 'Sign In';
  document.getElementById('auth-error').textContent = '';
};

window.handleAuth = async function () {
  const isSignup = document.getElementById('tab-signup').classList.contains('active');
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const username = document.getElementById('auth-username').value.trim();
  const btn      = document.getElementById('auth-submit');
  const errEl    = document.getElementById('auth-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (isSignup && !username) { errEl.textContent = 'Please enter a username.'; return; }
  btn.disabled = true; btn.textContent = '...';
  try {
    if (isSignup) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: username });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    document.getElementById('auth-backdrop').style.display = 'none';
  } catch (e) {
    errEl.textContent = e.message.replace('Firebase: ', '').replace(/\(.*\)/, '').trim();
  }
  btn.disabled = false;
  btn.textContent = isSignup ? 'Create Account' : 'Sign In';
};

window.continueAsGuest = function () {
  isGuest = true;
  document.getElementById('auth-backdrop').style.display = 'none';
  document.getElementById('avatar-btn').textContent = '?';
  loadLocalVotes(); loadLocalReactions();
  init();
};

window.handleSignOut = async function () {
  await signOut(auth);
  closeProfile();
  document.getElementById('auth-backdrop').style.display = 'flex';
  document.getElementById('avatar-btn').textContent = '?';
  currentUser = null;
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user; isGuest = false;
    document.getElementById('auth-backdrop').style.display = 'none';
    const initial = (user.displayName || user.email || '?')[0].toUpperCase();
    document.getElementById('avatar-btn').textContent = initial;
    document.getElementById('profile-avatar-big').textContent = initial;
    document.getElementById('profile-name-display').textContent = user.displayName || 'Anonymous';
    document.getElementById('profile-email-display').textContent = user.email;
    loadLocalVotes(); loadLocalReactions();
  }
});

// ── PROFILE ───────────────────────────────────────────────
window.openProfile = function () {
  if (!currentUser) { document.getElementById('auth-backdrop').style.display = 'flex'; return; }
  let kept = 0, skipped = 0;
  for (const v of Object.values(userVotes)) { if (v === 'keep') kept++; else skipped++; }
  document.getElementById('pstat-kept').textContent     = kept;
  document.getElementById('pstat-skipped').textContent  = skipped;
  document.getElementById('pstat-comments').textContent = commentCount;
  const isAdmin = ADMIN_UIDS.includes(currentUser.uid);
  if (isAdmin && !document.getElementById('admin-open-btn')) {
    const btn = document.createElement('button');
    btn.id = 'admin-open-btn'; btn.className = 'submit-btn';
    btn.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)';
    btn.style.marginTop = '0'; btn.textContent = '⚙️ Admin Panel';
    btn.onclick = () => { closeProfile(); openAdmin(); };
    document.querySelector('#profile-backdrop .modal').appendChild(btn);
  }
  document.getElementById('profile-backdrop').style.display = 'flex';
};
window.closeProfile = function () { document.getElementById('profile-backdrop').style.display = 'none'; };

// ── SEED DEFAULTS ─────────────────────────────────────────
async function seedDefaults() {
  const snaps = await Promise.all(DEFAULTS.map(d => getDoc(doc(db, 'items', d.id))));
  const missing = DEFAULTS.filter((_, i) => !snaps[i].exists());
  if (!missing.length) return;
  await Promise.all(missing.map(d => setDoc(doc(db, 'items', d.id), {
    name: d.name, cat: d.cat, desc: d.desc, img: '', keep: 0, skip: 0,
    reactions: { fire:0, laugh:0, wow:0, skull:0, heart:0 },
    createdAt: serverTimestamp()
  })));
}

// ── SUBSCRIBE ITEMS ───────────────────────────────────────
// No orderBy — avoids needing a Firestore composite index
function subscribeItems() {
  if (unsubItems) unsubItems();
  unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
    const prevId = items[currentIdx]?.id;
    items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return ta - tb || a.id.localeCompare(b.id);
      });
    if (prevId) {
      const ni = items.findIndex(i => i.id === prevId);
      if (ni >= 0) currentIdx = ni;
    }
    if (currentIdx >= items.length) currentIdx = Math.max(0, items.length - 1);
    render(); renderLB(); updateStats();
    document.getElementById('loading-screen').classList.add('hidden');
  }, (err) => {
    console.error('Firestore error:', err.code, err.message);
    showToast('Connection error: ' + err.code);
    document.getElementById('loading-screen').classList.add('hidden');
  });
}

// ── SUBSCRIBE COMMENTS ────────────────────────────────────
// No orderBy — sorted client-side to avoid index requirement
function subscribeComments(itemId) {
  if (unsubComments) unsubComments();
  unsubComments = onSnapshot(collection(db, 'items', itemId, 'comments'), (snap) => {
    const sorted = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    const list = document.getElementById('comments-list');
    if (!sorted.length) {
      list.innerHTML = '<div class="no-comments">No comments yet — be the first!</div>';
      return;
    }
    list.innerHTML = sorted.map(c => {
      const time = c.createdAt?.toDate ? timeAgo(c.createdAt.toDate()) : 'just now';
      const canDelete = currentUser && (currentUser.uid === c.uid || ADMIN_UIDS.includes(currentUser.uid));
      return `<div class="comment-item">
        <div class="comment-avatar">${(c.username || '?')[0].toUpperCase()}</div>
        <div class="comment-body">
          <div class="comment-user">${escHtml(c.username || 'Guest')}</div>
          <div class="comment-text">${escHtml(c.text)}</div>
          <div class="comment-time">${time}</div>
        </div>
        ${canDelete ? `<button class="comment-delete" onclick="deleteComment('${itemId}','${c.id}')">✕</button>` : ''}
      </div>`;
    }).join('');
    commentCount = sorted.filter(c => currentUser && c.uid === currentUser.uid).length;
    list.scrollTop = list.scrollHeight;
  }, (err) => console.error('Comments error:', err.code));
}

// ── VOTE ──────────────────────────────────────────────────
window.vote = async function (type) {
  if (!items.length) return;
  const item = items[currentIdx];
  const prev = userVotes[item.id];
  if (prev === type) return;
  document.getElementById('btn-keep').disabled = true;
  document.getElementById('btn-skip').disabled = true;
  try {
    const updates = { [type]: increment(1) };
    if (prev) updates[prev] = increment(-1);
    await updateDoc(doc(db, 'items', item.id), updates);
    userVotes[item.id] = type;
    saveLocalVotes();
    const card = document.getElementById('vote-card');
    card.style.transform = type === 'keep' ? 'scale(1.03) rotate(.8deg)' : 'scale(1.03) rotate(-.8deg)';
    setTimeout(() => { card.style.transform = ''; }, 280);
    // Auto-advance after voting
    setTimeout(() => {
      if (currentIdx < items.length - 1) {
        navigateInternal(1);
      } else {
        render();
        document.getElementById('btn-keep').disabled = false;
        document.getElementById('btn-skip').disabled = false;
      }
    }, 600);
  } catch (e) {
    console.error('Vote error:', e);
    showToast('Could not save vote — try again');
    document.getElementById('btn-keep').disabled = false;
    document.getElementById('btn-skip').disabled = false;
  }
};

// ── REACT ─────────────────────────────────────────────────
window.react = async function (emoji) {
  if (!items.length) return;
  const item = items[currentIdx];
  const key = REACTION_IDS[emoji];
  if (!key) return;
  if (!userReactions[item.id]) userReactions[item.id] = new Set();
  const already = userReactions[item.id].has(emoji);
  try {
    await updateDoc(doc(db, 'items', item.id), { [`reactions.${key}`]: increment(already ? -1 : 1) });
    if (already) userReactions[item.id].delete(emoji); else userReactions[item.id].add(emoji);
    saveLocalReactions();
    const btns = document.querySelectorAll('.reaction-btn');
    const idx = Object.keys(REACTION_IDS).indexOf(emoji);
    if (btns[idx]) { btns[idx].classList.add('pop'); setTimeout(() => btns[idx].classList.remove('pop'), 300); }
  } catch (e) { showToast('Could not save reaction'); }
};

// ── COMMENTS ──────────────────────────────────────────────
window.postComment = async function () {
  if (!items.length) return;
  const input = document.getElementById('comment-input');
  const text = input.value.trim();
  if (!text) return;
  const username = currentUser?.displayName || (isGuest ? 'Guest' : null);
  if (!username) { showToast('Sign in to comment'); return; }
  input.value = '';
  try {
    await addDoc(collection(db, 'items', items[currentIdx].id, 'comments'), {
      text, username, uid: currentUser?.uid || 'guest', createdAt: serverTimestamp()
    });
  } catch (e) { showToast('Could not post comment'); input.value = text; }
};

window.deleteComment = async function (itemId, commentId) {
  try { await deleteDoc(doc(db, 'items', itemId, 'comments', commentId)); }
  catch (e) { showToast('Could not delete comment'); }
};

// ── RENDER ────────────────────────────────────────────────
function render() {
  if (!items.length) return;
  const item = items[currentIdx];
  document.getElementById('card-cat').textContent  = item.cat || '—';
  document.getElementById('card-name').textContent = item.name;
  document.getElementById('card-desc').textContent = item.desc || '';
  const imgWrap = document.getElementById('card-image');
  const imgEl   = document.getElementById('card-img-el');
  if (item.img) { imgEl.src = item.img; imgWrap.style.display = 'block'; }
  else { imgWrap.style.display = 'none'; }
  const total = (item.keep || 0) + (item.skip || 0);
  const kpct  = total ? Math.round((item.keep || 0) / total * 100) : 50;
  const bar   = document.getElementById('bar-inner');
  bar.style.width      = kpct + '%';
  bar.style.background = kpct >= 50 ? 'var(--keep)' : 'var(--skip)';
  document.getElementById('keep-count').textContent  = (item.keep || 0) + ' keep';
  document.getElementById('skip-count').textContent  = (item.skip || 0) + ' skip';
  document.getElementById('progress-info').textContent = (currentIdx + 1) + ' / ' + items.length;
  document.getElementById('prev-btn').disabled = currentIdx === 0;
  document.getElementById('next-btn').disabled = currentIdx === items.length - 1;
  document.getElementById('btn-keep').disabled = false;
  document.getElementById('btn-skip').disabled = false;
  const uv = userVotes[item.id];
  const ov = document.getElementById('voted-overlay');
  if (uv) { ov.className = 'voted-overlay show ' + uv; ov.textContent = uv === 'keep' ? '✓ KEPT' : '✕ SKIPPED'; }
  else    { ov.className = 'voted-overlay'; ov.textContent = ''; }
  const reacted = userReactions[item.id] || new Set();
  const r = item.reactions || {};
  document.getElementById('r-fire').textContent  = r.fire  || 0;
  document.getElementById('r-laugh').textContent = r.laugh || 0;
  document.getElementById('r-wow').textContent   = r.wow   || 0;
  document.getElementById('r-skull').textContent = r.skull || 0;
  document.getElementById('r-heart').textContent = r.heart || 0;
  document.querySelectorAll('.reaction-btn').forEach((btn, i) => {
    btn.classList.toggle('reacted', reacted.has(Object.keys(REACTION_IDS)[i]));
  });
  subscribeComments(item.id);
}

function updateStats() {
  const total = items.reduce((a, i) => a + (i.keep || 0) + (i.skip || 0), 0);
  document.getElementById('total-votes').textContent = total.toLocaleString();
  document.getElementById('total-items').textContent = items.length;
}

function renderLB() {
  const sorted = [...items]
    .filter(i => (i.keep || 0) + (i.skip || 0) > 0)
    .sort((a, b) => {
      const ta = (a.keep||0)+(a.skip||0), tb = (b.keep||0)+(b.skip||0);
      return lbTab === 'keep'
        ? ((b.keep||0)/Math.max(tb,1)) - ((a.keep||0)/Math.max(ta,1))
        : ((b.skip||0)/Math.max(tb,1)) - ((a.skip||0)/Math.max(ta,1));
    }).slice(0, 5);
  const list = document.getElementById('lb-list');
  if (!sorted.length) { list.innerHTML = '<div style="color:var(--muted);font-size:.85rem">No votes yet!</div>'; return; }
  list.innerHTML = sorted.map((item, i) => {
    const total = (item.keep||0) + (item.skip||0);
    const pct   = lbTab === 'keep' ? Math.round((item.keep||0)/total*100) : Math.round((item.skip||0)/total*100);
    return `<div class="lb-item">
      <div class="lb-rank">#${i+1}</div>
      <div class="lb-name">${escHtml(item.name)}</div>
      <div class="lb-pct ${lbTab}">${pct}%</div>
    </div>`;
  }).join('');
}

// ── NAVIGATE ──────────────────────────────────────────────
function navigateInternal(dir) {
  const newIdx = currentIdx + dir;
  if (newIdx < 0 || newIdx >= items.length) return;
  const card = document.getElementById('vote-card');
  card.classList.add(dir < 0 ? 'slide-out-right' : 'slide-out-left');
  setTimeout(() => {
    card.classList.remove('slide-out-left', 'slide-out-right');
    card.style.opacity = '0';
    currentIdx = newIdx;
    render();
    card.classList.add('slide-in');
    card.style.opacity = '1';
    setTimeout(() => card.classList.remove('slide-in'), 350);
  }, 270);
}
window.navigate = (dir) => navigateInternal(dir);

window.setLbTab = function (tab) {
  lbTab = tab;
  document.getElementById('lbtab-keep').className = 'lb-tab' + (tab === 'keep' ? ' active keep' : '');
  document.getElementById('lbtab-skip').className = 'lb-tab' + (tab === 'skip' ? ' active skip' : '');
  renderLB();
};

window.toggleAddForm = () => document.getElementById('add-form').classList.toggle('open');

window.addItem = async function () {
  const name = document.getElementById('new-name').value.trim();
  if (!name) { showToast('Please enter an item name'); return; }
  const cat  = document.getElementById('new-cat').value;
  const desc = document.getElementById('new-desc').value.trim();
  const img  = document.getElementById('new-img').value.trim();
  const btn  = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
    await setDoc(doc(db, 'items', id), {
      name, cat, desc, img, keep: 0, skip: 0,
      reactions: { fire:0, laugh:0, wow:0, skull:0, heart:0 },
      createdAt: serverTimestamp()
    });
    ['new-name','new-desc','new-img'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('add-form').classList.remove('open');
    showToast('Item added! 🎉');
  } catch (e) { showToast('Error adding item'); console.error(e); }
  btn.disabled = false; btn.textContent = 'Add Item →';
};

// ── ADMIN ─────────────────────────────────────────────────
window.openAdmin = function () {
  if (!currentUser || !ADMIN_UIDS.includes(currentUser.uid)) return;
  document.getElementById('admin-backdrop').style.display = 'flex';
  switchAdminTab('items');
};
window.closeAdmin = () => { document.getElementById('admin-backdrop').style.display = 'none'; };

window.switchAdminTab = function (tab) {
  document.querySelectorAll('.admin-tab').forEach((t, i) =>
    t.classList.toggle('active', (i === 0 && tab === 'items') || (i === 1 && tab === 'users')));
  document.getElementById('admin-items-panel').style.display = tab === 'items' ? 'block' : 'none';
  document.getElementById('admin-users-panel').style.display = tab === 'users' ? 'block' : 'none';
  if (tab === 'items') renderAdminItems();
};

function renderAdminItems() {
  document.getElementById('admin-items-list').innerHTML = items.map(item => `
    <div class="admin-item">
      <div>
        <div class="admin-item-name">${escHtml(item.name)}</div>
        <div class="admin-item-stats">${item.keep||0} keep · ${item.skip||0} skip · ${item.cat}</div>
      </div>
      <button class="admin-delete-btn" onclick="adminDeleteItem('${item.id}')">Delete</button>
    </div>`).join('');
}

window.adminDeleteItem = async function (id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try { await deleteDoc(doc(db, 'items', id)); showToast('Item deleted'); renderAdminItems(); }
  catch (e) { showToast('Error deleting item'); }
};

// ── SWIPE ─────────────────────────────────────────────────
function initSwipe() {
  const card = document.getElementById('vote-card');
  let startX = 0, startY = 0, isDragging = false, currentX = 0;
  const THRESHOLD = 80;
  const onStart = (x, y) => { startX = x; startY = y; isDragging = true; card.style.transition = 'none'; };
  const onMove  = (x, y) => {
    if (!isDragging) return;
    const dx = x - startX, dy = y - startY;
    if (Math.abs(dy) > Math.abs(dx) * 1.5) { isDragging = false; card.style.transition = ''; card.style.transform = ''; return; }
    currentX = dx;
    card.style.transform = `translateX(${dx}px) rotate(${dx * 0.08}deg)`;
    const pct = Math.min(Math.abs(dx) / THRESHOLD, 1);
    document.getElementById('swipe-hint-left').style.opacity  = dx < -20 ? pct : 0;
    document.getElementById('swipe-hint-right').style.opacity = dx > 20  ? pct : 0;
  };
  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false; card.style.transition = '';
    document.getElementById('swipe-hint-left').style.opacity  = 0;
    document.getElementById('swipe-hint-right').style.opacity = 0;
    if      (currentX < -THRESHOLD) { card.style.transform = ''; vote('skip'); }
    else if (currentX >  THRESHOLD) { card.style.transform = ''; vote('keep'); }
    else                             { card.style.transform = ''; }
    currentX = 0;
  };
  card.addEventListener('touchstart', e => onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  card.addEventListener('touchmove',  e => onMove(e.touches[0].clientX,  e.touches[0].clientY), { passive: true });
  card.addEventListener('touchend',   onEnd);
  card.addEventListener('mousedown',  e => onStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => { if (isDragging) onMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup',   onEnd);
}

// ── KEYBOARD ──────────────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'k') vote('keep');
    if (e.key === 'ArrowLeft'  || e.key === 's') vote('skip');
    if (e.key === 'ArrowUp')   navigateInternal(-1);
    if (e.key === 'ArrowDown') navigateInternal(1);
  });
}

// ── UTILS ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeAgo(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s / 60)    + 'm ago';
  if (s < 86400) return Math.floor(s / 3600)  + 'h ago';
  return               Math.floor(s / 86400)  + 'd ago';
}

// ── INIT ──────────────────────────────────────────────────
async function init() {
  subscribeItems();
  initSwipe();
  initKeyboard();
  seedDefaults().catch(console.error);
}

initTheme();
init();
// Signed-in users: init triggered by onAuthStateChanged
// Guests: init triggered by continueAsGuest()

window.handleGoogle = async function () {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    document.getElementById('auth-backdrop').style.display = 'none';
  } catch (e) {
    document.getElementById('auth-error').textContent = e.message.replace('Firebase: ', '').replace(/\(.*\)/, '').trim();
  }
};