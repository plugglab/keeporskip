import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, onSnapshot, increment, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA2-zZWiFW9-LmT8yC1fHyqqOAcSfhhAhk",
  authDomain: "kas-database.firebaseapp.com",
  projectId: "kas-database",
  storageBucket: "kas-database.firebasestorage.app",
  messagingSenderId: "1059230782602",
  appId: "1:1059230782602:web:f9a46b49e9ad9ef2a48973"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULTS = [
  {id:'pineapple-pizza',name:'Pineapple on Pizza',cat:'Food',desc:'The controversial Hawaiian pizza topping that divides the world.'},
  {id:'snooze-button',name:'Alarm Snooze Button',cat:'Habits',desc:'That extra 9 minutes of bliss... or morning ruin?'},
  {id:'infinite-scroll',name:'Infinite Scroll',cat:'Tech',desc:'Social media feeds with no end — addictive or exhausting?'},
  {id:'crocs',name:'Crocs Shoes',cat:'Fashion',desc:'The foam clogs that went from ugly to iconic.'},
  {id:'netflix-autoplay',name:'Netflix Autoplay',cat:'Tech',desc:'Next episode starts automatically. Convenient or pushy?'},
  {id:'open-plan-offices',name:'Open-Plan Offices',cat:'Habits',desc:'No walls, no privacy — does collaboration outweigh distraction?'},
  {id:'reboots-remakes',name:'Reboots & Remakes',cat:'Movies',desc:'Hollywood reviving old franchises instead of new stories.'},
  {id:'cilantro',name:'Cilantro',cat:'Food',desc:'Some taste fresh herb goodness, others taste soap. There is no in-between.'},
];

let items = [];
let currentIdx = 0;
let lbTab = 'keep';
let userVotes = {};
let unsubscribe = null;

function getVoteKey(id) { return 'ksv_' + id; }

function loadLocalVotes() {
  DEFAULTS.forEach(d => {
    const v = localStorage.getItem(getVoteKey(d.id));
    if (v) userVotes[d.id] = v;
  });
  try {
    const custom = localStorage.getItem('ks_custom_votes');
    if (custom) Object.assign(userVotes, JSON.parse(custom));
  } catch {}
}

function saveLocalVote(id, type) {
  userVotes[id] = type;
  localStorage.setItem(getVoteKey(id), type);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function seedDefaults() {
  for (const d of DEFAULTS) {
    const ref = doc(db, 'items', d.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { name: d.name, cat: d.cat, desc: d.desc, keep: 0, skip: 0, createdAt: serverTimestamp() });
    }
  }
}

function subscribeItems() {
  if (unsubscribe) unsubscribe();
  const q = query(collection(db, 'items'), orderBy('createdAt', 'asc'));
  unsubscribe = onSnapshot(q, (snap) => {
    const prev = items[currentIdx]?.id;
    items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (prev) {
      const ni = items.findIndex(i => i.id === prev);
      if (ni >= 0) currentIdx = ni;
    }
    if (currentIdx >= items.length) currentIdx = Math.max(0, items.length - 1);
    render();
    renderLB();
    updateStats();
    document.getElementById('loading-screen').classList.add('hidden');
  }, (err) => {
    console.error(err);
    showToast('Connection error — check Firestore rules');
    document.getElementById('loading-screen').classList.add('hidden');
  });
}

window.vote = async function vote(type) {
  if (!items.length) return;
  const item = items[currentIdx];
  const prev = userVotes[item.id];
  if (prev === type) return;
  document.getElementById('btn-keep').disabled = true;
  document.getElementById('btn-skip').disabled = true;
  try {
    const ref = doc(db, 'items', item.id);
    const updates = { [type]: increment(1) };
    if (prev) updates[prev] = increment(-1);
    await updateDoc(ref, updates);
    saveLocalVote(item.id, type);
    const card = document.getElementById('vote-card');
    card.style.transform = type === 'keep' ? 'scale(1.02) rotate(.5deg)' : 'scale(1.02) rotate(-.5deg)';
    setTimeout(() => { card.style.transform = ''; }, 300);
  } catch (e) {
    showToast('Could not save vote — try again');
    console.error(e);
  }
  document.getElementById('btn-keep').disabled = false;
  document.getElementById('btn-skip').disabled = false;
}

function render() {
  if (!items.length) return;
  const item = items[currentIdx];
  document.getElementById('card-cat').textContent = item.cat || '—';
  document.getElementById('card-name').textContent = item.name;
  document.getElementById('card-desc').textContent = item.desc || '';
  const total = (item.keep || 0) + (item.skip || 0);
  const kpct = total ? Math.round((item.keep || 0) / total * 100) : 50;
  const bar = document.getElementById('bar-inner');
  bar.style.width = kpct + '%';
  bar.style.background = kpct >= 50 ? 'var(--keep)' : 'var(--skip)';
  document.getElementById('keep-count').textContent = (item.keep || 0) + ' keep';
  document.getElementById('skip-count').textContent = (item.skip || 0) + ' skip';
  document.getElementById('progress-info').textContent = (currentIdx + 1) + ' / ' + items.length;
  document.getElementById('prev-btn').disabled = currentIdx === 0;
  document.getElementById('next-btn').disabled = currentIdx === items.length - 1;
  document.getElementById('btn-keep').disabled = false;
  document.getElementById('btn-skip').disabled = false;
  const uv = userVotes[item.id];
  const ov = document.getElementById('voted-overlay');
  if (uv) {
    ov.className = 'voted-overlay show ' + uv;
    ov.textContent = uv === 'keep' ? '✓ KEPT' : '✕ SKIPPED';
  } else {
    ov.className = 'voted-overlay';
    ov.textContent = '';
  }
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
  if (!sorted.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:.5rem 0">No votes yet — be the first!</div>';
    return;
  }
  list.innerHTML = sorted.map((item, i) => {
    const total = (item.keep||0) + (item.skip||0);
    const pct = lbTab === 'keep'
      ? Math.round((item.keep||0)/total*100)
      : Math.round((item.skip||0)/total*100);
    return `<div class="lb-item">
      <div class="lb-rank">#${i+1}</div>
      <div class="lb-name">${item.name}</div>
      <div class="lb-pct ${lbTab}">${pct}%</div>
    </div>`;
  }).join('');
}

window.navigate = function(dir) {
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
    setTimeout(() => card.classList.remove('slide-in'), 400);
  }, 280);
};

window.setTab = function(tab) {
  lbTab = tab;
  document.getElementById('tab-keep').className = 'lb-tab' + (tab === 'keep' ? ' active keep' : '');
  document.getElementById('tab-skip').className = 'lb-tab' + (tab === 'skip' ? ' active skip' : '');
  renderLB();
};

window.toggleAddForm = function() {
  document.getElementById('add-form').classList.toggle('open');
};

window.addItem = async function() {
  const name = document.getElementById('new-name').value.trim();
  if (!name) { showToast('Please enter an item name'); return; }
  const cat = document.getElementById('new-cat').value;
  const desc = document.getElementById('new-desc').value.trim();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + Date.now();
    await setDoc(doc(db, 'items', id), { name, cat, desc, keep: 0, skip: 0, createdAt: serverTimestamp() });
    document.getElementById('new-name').value = '';
    document.getElementById('new-desc').value = '';
    document.getElementById('add-form').classList.remove('open');
    showToast('Item added! 🎉');
  } catch (e) {
    showToast('Error adding item — check Firestore rules');
    console.error(e);
  }
  btn.disabled = false;
  btn.textContent = 'Add Item →';
};

// init
loadLocalVotes();
await seedDefaults();
subscribeItems();
