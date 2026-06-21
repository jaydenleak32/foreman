// === TODAY TAB ===

async function renderToday() {
  if (!currentUser) {
    tabContent.innerHTML = '<div style="text-align:center;padding:60px 0;color:var(--text-muted);">Signing in...</div>';
    return;
  }
  try {
    await _renderToday();
  } catch (e) {
    console.error('Today tab error:', e);
    tabContent.innerHTML = `<div class="fade-in" style="text-align:center;padding:40px 16px;">
      <div style="font-size:1.3rem;margin-bottom:8px;">Could not load Today</div>
      <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:16px;">${escapeHtml(e.message)}</div>
      <button class="btn-primary" onclick="renderToday()">Retry</button>
    </div>`;
  }
}

async function _renderToday() {
  const key = todayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = dateKey(yesterday);

  const [todayDoc, yDoc, habitsDoc, blocksSnap, routinesSnap] = await Promise.all([
    userDoc('days_' + key).get(),
    userDoc('days_' + yKey).get().catch(() => null),
    userDoc('habitConfig').get(),
    userCollection('scheduleBlocks').where('date', '==', key).get(),
    userCollection('routines').get()
  ]);

  const data = todayDoc.exists ? todayDoc.data() : {};
  const yData = yDoc && yDoc.exists ? yDoc.data() : {};

  const carryForward = yData.priority && !yData.priorityDone ? yData.priority : '';
  if (!data.priority && carryForward) {
    data.priority = carryForward;
    data.carriedForward = true;
  }

  const habitConfig = habitsDoc.exists ? habitsDoc.data().habits : [
    'Scripture study', 'Prayer (morning & night)', 'Exercise', 'Spanish practice', 'School work', 'Read 30 min'
  ];

  const habits = data.habits || {};
  var streaks = {};
  for (var h of habitConfig) streaks[h] = 0;

  // Build "Up Next" — routines + custom blocks for today, sorted by time, only future ones
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const dayOfWeek = now.getDay();

  const routines = [];
  routinesSnap.forEach(d => routines.push({ id: d.id, ...d.data() }));
  const todayRoutines = routines.filter(r => {
    if (r.type === 'daily') return true;
    return r.days && r.days.includes(dayOfWeek);
  });

  const customBlocks = [];
  blocksSnap.forEach(d => customBlocks.push({ id: d.id, ...d.data() }));
  const timedBlocks = customBlocks.filter(b => !b.allDay);

  // Merge routines + blocks into one sorted list
  var upNext = [];
  for (var r of todayRoutines) {
    upNext.push({ title: r.title, start: r.startHour, end: r.endHour, category: r.category || 'Other', isRoutine: true });
  }
  for (var b of timedBlocks) {
    upNext.push({ title: b.title, start: b.startHour, end: b.endHour, category: b.category || 'Appointment', people: b.people });
  }
  upNext.sort((a, b) => a.start - b.start);

  // Split into current/upcoming vs past
  var currentBlock = upNext.find(b => currentHour >= b.start && currentHour < b.end);
  var upcoming = upNext.filter(b => b.start >= currentHour).slice(0, 3);
  if (currentBlock && !upcoming.includes(currentBlock)) upcoming.unshift(currentBlock);
  if (upcoming.length > 3) upcoming = upcoming.slice(0, 3);

  const peopleList = data.people || [];
  const completedCount = habitConfig.filter(h => habits[h]).length;
  const totalHabits = habitConfig.length;

  tabContent.innerHTML = `
    <div class="fade-in">
      <div class="today-top">
        <div class="today-greeting">${getGreeting()}, ${escapeHtml(settings.name || 'Jayden')}</div>
        <div class="today-date">${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>

      <div class="card">
        <div class="card-title">
          #1 Priority
          ${data.carriedForward ? '<span style="color:var(--warning);font-size:0.65rem;margin-left:6px;">carried from yesterday</span>' : ''}
        </div>
        <input type="text" class="priority-input" id="today-priority" value="${escapeHtml(data.priority || '')}" placeholder="What must get done today?">
      </div>

      <div class="card">
        <div class="card-title">Habits <span style="color:var(--text-muted);font-weight:400;">${completedCount}/${totalHabits}</span></div>
        ${habitConfig.map(h => `
          <div class="checkbox-row">
            <div class="custom-check ${habits[h] ? 'checked' : ''}" data-habit="${escapeHtml(h)}"></div>
            <span class="checkbox-label ${habits[h] ? 'completed' : ''}">${escapeHtml(h)}</span>
            <span class="streak-count">${streaks[h] || 0}🔥</span>
          </div>
        `).join('')}
      </div>

      ${upNext.length > 0 ? `
        <div class="card">
          <div class="card-title">Up Next</div>
          ${upNext.map(b => {
            var color = BLOCK_COLORS[b.category] || BLOCK_COLORS.Appointment;
            var isCurrent = currentBlock && b.title === currentBlock.title && b.start === currentBlock.start;
            var people = b.people && b.people.length ? b.people.join(', ') : '';
            return `
              <div class="upnext-item ${isCurrent ? 'upnext-current' : ''}" style="border-left-color:${color.border};">
                <div class="upnext-time">${formatTimeMinutes(b.start)} - ${formatTimeMinutes(b.end)}</div>
                <div class="upnext-title">${escapeHtml(b.title)}${b.isRoutine ? ' <span class="upnext-routine">↻</span>' : ''}</div>
                ${people ? `<div class="upnext-people">👤 ${escapeHtml(people)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      <div class="card">
        <div class="card-title">Today's People</div>
        <div class="people-autocomplete">
          <input type="text" id="today-people-input" placeholder="Add a person...">
          <div id="today-people-autocomplete" class="autocomplete-list hidden"></div>
        </div>
        <div class="today-people-list" id="today-people-list">
          ${peopleList.map(p => `
            <span class="today-person-chip">${escapeHtml(p)} <button data-remove-person="${escapeHtml(p)}">✕</button></span>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Priority save
  document.getElementById('today-priority').addEventListener('change', function() {
    userDoc('days_' + key).set({ ...data, priority: this.value, carriedForward: false }, { merge: true });
  });

  // Habit toggles
  tabContent.querySelectorAll('.custom-check').forEach(el => {
    el.addEventListener('click', async () => {
      var habit = el.dataset.habit;
      habits[habit] = !habits[habit];
      el.classList.toggle('checked');
      el.nextElementSibling.classList.toggle('completed');
      await userDoc('days_' + key).set({ habits }, { merge: true });
    });
  });

  // Streaks in background
  getStreaks(habitConfig).then(s => {
    tabContent.querySelectorAll('.streak-count').forEach(el => {
      var habit = el.previousElementSibling.textContent;
      if (s[habit]) el.textContent = s[habit] + '🔥';
    });
  }).catch(() => {});

  // People
  setupPeopleAutocomplete();
  tabContent.querySelectorAll('[data-remove-person]').forEach(btn => {
    btn.addEventListener('click', async () => {
      var name = btn.dataset.removePerson;
      var updated = peopleList.filter(p => p !== name);
      await userDoc('days_' + key).set({ people: updated }, { merge: true });
      renderToday();
    });
  });
}

async function getStreaks(habitConfig) {
  var days = [];
  for (var i = 1; i <= 30; i++) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }
  var docs = await Promise.all(
    days.map(k => userDoc('days_' + k).get().catch(() => null))
  );
  var dayData = {};
  docs.forEach((doc, i) => {
    if (doc && doc.exists) dayData[days[i]] = doc.data().habits || {};
  });
  var streaks = {};
  for (var habit of habitConfig) {
    var streak = 0;
    for (var key of days) {
      if (dayData[key] && dayData[key][habit]) streak++;
      else break;
    }
    streaks[habit] = streak;
  }
  return streaks;
}

function setupPeopleAutocomplete() {
  var input = document.getElementById('today-people-input');
  var list = document.getElementById('today-people-autocomplete');
  if (!input || !list) return;

  var _peopleNames = null;
  input.addEventListener('input', debounce(async () => {
    var q = input.value.trim().toLowerCase();
    if (q.length < 1) { list.classList.add('hidden'); return; }
    if (!_peopleNames) {
      var snap = await userCollection('people').get();
      _peopleNames = [];
      snap.forEach(doc => { var d = doc.data(); if (d.name) _peopleNames.push(d.name); });
    }
    var matches = _peopleNames.filter(n => n.toLowerCase().includes(q));
    if (matches.length === 0) { list.classList.add('hidden'); return; }
    list.innerHTML = matches.slice(0, 5).map(m => `<div class="autocomplete-item">${escapeHtml(m)}</div>`).join('');
    list.classList.remove('hidden');
  }, 200));

  list.addEventListener('click', async (e) => {
    var item = e.target.closest('.autocomplete-item');
    if (!item) return;
    await addTodayPerson(item.textContent);
    input.value = '';
    list.classList.add('hidden');
  });

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      await addTodayPerson(input.value.trim());
      input.value = '';
      list.classList.add('hidden');
    }
  });
}

async function addTodayPerson(name) {
  var key = todayKey();
  var doc = await userDoc('days_' + key).get();
  var data = doc.exists ? doc.data() : {};
  var people = data.people || [];
  if (!people.includes(name)) {
    people.push(name);
    await userDoc('days_' + key).set({ people }, { merge: true });
    renderToday();
  }
}

function formatTimeMinutes(decimalHour) {
  var h = Math.floor(decimalHour);
  var m = Math.round((decimalHour - h) * 60);
  var ampm = h >= 12 ? 'PM' : 'AM';
  var h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}
