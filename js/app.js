// === Firebase Init ===
const firebaseConfig = {
  apiKey: "AIzaSyCMdCd12jP-PoQC2ncegBEmBa7Yv_7lZZE",
  authDomain: "foreman--app.firebaseapp.com",
  projectId: "foreman--app",
  storageBucket: "foreman--app.firebasestorage.app",
  messagingSenderId: "479915828718",
  appId: "1:479915828718:web:cb358a82459e0526665aff"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentTab = 'today';
let settings = {};

const DEFAULT_SETTINGS = {
  name: 'Jayden',
  jobTitle: 'Dairy Technician',
  startDate: '2024-01-01',
  theme: 'dark',
  defaultTab: 'today',
  weekStartsMonday: true,
  confirmBeforeDelete: true,
  checkInsPerDay: 2,
  pin: '',
  language: 'en',
  recurringBlocks: [
    { title: 'Dairy Work', start: 6, end: 18, days: [1,2,3,4,5], color: 'recurring' },
    { title: 'School', start: 19, end: 21, days: [1,2,3,4,5], color: 'recurring' }
  ]
};

// === Auth ===
const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle');
const authError = document.getElementById('auth-error');
const appEl = document.getElementById('app');
const pinLock = document.getElementById('pin-lock');

let isSignUp = false;

authToggle.addEventListener('click', () => {
  isSignUp = !isSignUp;
  authSubmit.textContent = isSignUp ? 'Create Account' : 'Sign In';
  authToggle.textContent = isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up';
  authError.textContent = '';
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  authSubmit.disabled = true;
  try {
    if (isSignUp) {
      await auth.createUserWithEmailAndPassword(authEmail.value, authPassword.value);
    } else {
      await auth.signInWithEmailAndPassword(authEmail.value, authPassword.value);
    }
  } catch (err) {
    authError.textContent = err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim();
  }
  authSubmit.disabled = false;
});

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    authScreen.classList.add('hidden');
    try {
      await loadSettings();
    } catch (e) {
      console.warn('Failed to load settings, using defaults:', e.message);
      settings = { ...DEFAULT_SETTINGS };
      applyTheme(settings.theme);
    }
    checkPinLock();
  } else {
    currentUser = null;
    authScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
    pinLock.classList.add('hidden');
  }
});

// === PIN Lock ===
let pinEntry = '';

function checkPinLock() {
  if (settings.pin && settings.pin.length === 4) {
    pinLock.classList.remove('hidden');
    appEl.classList.add('hidden');
    pinEntry = '';
    updatePinDots();
  } else {
    pinLock.classList.add('hidden');
    appEl.classList.remove('hidden');
    initApp();
  }
}

document.querySelector('.pin-pad').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const digit = btn.dataset.digit;

  if (digit === '') {
    pinEntry = pinEntry.slice(0, -1);
  } else if (digit === 'enter') {
    if (pinEntry === settings.pin) {
      pinLock.classList.add('hidden');
      appEl.classList.remove('hidden');
      initApp();
    } else {
      pinEntry = '';
      document.querySelector('.pin-lock-inner p').textContent = 'Wrong PIN. Try again.';
    }
  } else if (pinEntry.length < 4) {
    pinEntry += digit;
  }
  updatePinDots();
});

function updatePinDots() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinEntry.length);
  });
}

// === Settings ===
async function loadSettings() {
  if (!currentUser) return;
  const doc = await userDoc('settings').get();
  settings = { ...DEFAULT_SETTINGS, ...(doc.exists ? doc.data() : {}) };
  applyTheme(settings.theme);
}

async function saveSettings() {
  if (!currentUser) return;
  await userDoc('settings').set(settings);
}

function applyTheme(theme) {
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

// === Firestore Helpers ===
function userDoc(path) {
  return db.collection('users').doc(currentUser.uid).collection('data').doc(path.replace(/\//g, '_'));
}

function userCollection(path) {
  return db.collection('users').doc(currentUser.uid).collection(path);
}

function dateKey(date) {
  const d = date || new Date();
  return d.toISOString().split('T')[0];
}

function todayKey() {
  return dateKey(new Date());
}

// === Tab Navigation ===
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContent = document.getElementById('tab-content');

function getTabRenderer(tab) {
  const map = {
    today: typeof renderToday !== 'undefined' ? renderToday : null,
    schedule: typeof renderSchedule !== 'undefined' ? renderSchedule : null,
    inbox: typeof renderInbox !== 'undefined' ? renderInbox : null,
    people: typeof renderPeople !== 'undefined' ? renderPeople : null,
    review: typeof renderReview !== 'undefined' ? renderReview : null,
    budget: typeof renderBudget !== 'undefined' ? renderBudget : null,
  };
  return map[tab];
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

async function switchTab(tab) {
  currentTab = tab;
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  // Hide schedule FAB on non-schedule tabs
  const fab = document.getElementById('sched-fab');
  if (fab && tab !== 'schedule') fab.classList.add('hidden');

  // Smooth transition: fade out, render, fade in
  tabContent.style.opacity = '0';
  tabContent.style.transform = 'translateY(6px)';

  const renderer = getTabRenderer(tab);
  if (renderer) {
    try {
      await renderer();
    } catch (e) {
      console.error(tab + ' tab error:', e);
      tabContent.innerHTML = `<div style="text-align:center;padding:40px 16px;">
        <div style="font-size:1.3rem;margin-bottom:8px;">⚠ Couldn't load ${tab}</div>
        <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:16px;">${escapeHtml(e.message)}</div>
        <button class="btn-primary" onclick="switchTab('${tab}')">Retry</button>
      </div>`;
    }
  }

  requestAnimationFrame(() => {
    tabContent.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    tabContent.style.opacity = '1';
    tabContent.style.transform = 'translateY(0)';
  });
}

// === Global Search ===
const searchInput = document.getElementById('global-search');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', debounce(async () => {
  const q = searchInput.value.trim().toLowerCase();
  if (q.length < 2) {
    searchResults.classList.add('hidden');
    return;
  }
  const results = await globalSearch(q);
  if (results.length === 0) {
    searchResults.classList.add('hidden');
    return;
  }
  searchResults.innerHTML = results.map(r => `
    <div class="search-result-item" data-type="${r.type}" data-id="${r.id}">
      <div class="search-result-type">${r.type}</div>
      <div class="search-result-name">${r.name}</div>
    </div>
  `).join('');
  searchResults.classList.remove('hidden');
}, 300));

searchResults.addEventListener('click', (e) => {
  const item = e.target.closest('.search-result-item');
  if (!item) return;
  searchResults.classList.add('hidden');
  searchInput.value = '';
  const type = item.dataset.type;
  if (type === 'action' || type === 'project') switchTab('inbox');
  else if (type === 'person') switchTab('people');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrapper')) searchResults.classList.add('hidden');
});

async function globalSearch(query) {
  const results = [];
  const [actionsSnap, projectsSnap, peopleSnap] = await Promise.all([
    userCollection('actions').get(),
    userCollection('projects').get(),
    userCollection('people').get()
  ]);
  actionsSnap.forEach(doc => {
    const d = doc.data();
    if (d.text && d.text.toLowerCase().includes(query))
      results.push({ type: 'action', name: d.text, id: doc.id });
  });
  projectsSnap.forEach(doc => {
    const d = doc.data();
    if (d.title && d.title.toLowerCase().includes(query))
      results.push({ type: 'project', name: d.title, id: doc.id });
  });
  peopleSnap.forEach(doc => {
    const d = doc.data();
    if (d.name && d.name.toLowerCase().includes(query))
      results.push({ type: 'person', name: d.name, id: doc.id });
  });
  return results.slice(0, 10);
}

// === Undo Toast ===
let undoTimeout = null;
let undoAction = null;

function showUndo(text, action) {
  const toast = document.getElementById('undo-toast');
  document.getElementById('undo-text').textContent = text;
  toast.classList.remove('hidden');
  undoAction = action;
  clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => toast.classList.add('hidden'), 5000);
}

document.getElementById('undo-btn').addEventListener('click', () => {
  if (undoAction) undoAction();
  document.getElementById('undo-toast').classList.add('hidden');
  clearTimeout(undoTimeout);
});

// === Swipe Handler ===
function setupSwipe(el, onRight, onLeft) {
  let startX = 0, currentX = 0, swiping = false;
  const swipeItem = el.querySelector('.swipe-item') || el;

  swipeItem.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    swiping = true;
  }, { passive: true });

  swipeItem.addEventListener('touchmove', (e) => {
    if (!swiping) return;
    currentX = e.touches[0].clientX;
    const dx = currentX - startX;
    if (Math.abs(dx) > 10) {
      swipeItem.style.transform = `translateX(${dx * 0.5}px)`;
    }
  }, { passive: true });

  swipeItem.addEventListener('touchend', () => {
    swiping = false;
    const dx = currentX - startX;
    swipeItem.style.transform = '';
    if (dx > 80 && onRight) onRight();
    else if (dx < -80 && onLeft) onLeft();
    currentX = 0;
  });
}

// === Utilities ===
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function formatTime(hour) {
  if (hour === 0) return '12 AM';
  if (hour < 12) return hour + ' AM';
  if (hour === 12) return '12 PM';
  return (hour - 12) + ' PM';
}

function getWeekDates(date, startMonday) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = startMonday ? (day === 0 ? -6 : 1 - day) : -day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(start);
    dd.setDate(start.getDate() + i);
    dates.push(dd);
  }
  return dates;
}

function dayNames(startMonday) {
  return startMonday
    ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

var _escDiv = document.createElement('div');
function escapeHtml(text) {
  _escDiv.textContent = text;
  return _escDiv.innerHTML;
}

// === Init ===
async function initApp() {
  const tab = settings.defaultTab || ‘today’;
  await switchTab(tab);
}

// === Settings Button ===
document.getElementById('settings-btn').addEventListener('click', () => {
  renderSettings();
  document.getElementById('settings-modal').classList.remove('hidden');
});

document.getElementById('settings-close').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.add('hidden');
});
