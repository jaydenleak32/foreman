// === TODAY TAB ===

async function renderToday() {
  const key = todayKey();
  const doc = await userDoc('days/' + key).get();
  const data = doc.exists ? doc.data() : {};

  const hour = new Date().getHours();
  const isAM = hour < 12;
  const isPM = hour >= 19;

  // Check for carry-forward
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = dateKey(yesterday);
  const yDoc = await userDoc('days/' + yKey).get();
  const yData = yDoc.exists ? yDoc.data() : {};
  const carryForward = yData.priority && !yData.priorityDone ? yData.priority : '';

  if (!data.priority && carryForward) {
    data.priority = carryForward;
    data.carriedForward = true;
  }

  const habitsDoc = await userDoc('habitConfig').get();
  const habitConfig = habitsDoc.exists ? habitsDoc.data().habits : [
    'Scripture study', 'Prayer (morning & night)', 'Exercise', 'Spanish practice', 'School work', 'Read 30 min'
  ];

  const habits = data.habits || {};
  const streaks = await getStreaks(habitConfig);

  // Get today's schedule blocks
  const dayOfWeek = new Date().getDay();
  const recurring = (settings.recurringBlocks || []).filter(b => b.days.includes(dayOfWeek));
  const blocksSnap = await userCollection('scheduleBlocks').where('date', '==', key).get();
  const customBlocks = [];
  blocksSnap.forEach(d => customBlocks.push({ id: d.id, ...d.data() }));

  const allDayBlocks = customBlocks.filter(b => b.allDay);
  const timedBlocks = customBlocks.filter(b => !b.allDay);

  const peopleList = data.people || [];

  tabContent.innerHTML = `
    <div class="fade-in">
      <div class="today-greeting">${getGreeting()}, ${escapeHtml(settings.name || 'Jayden')}</div>
      <div class="today-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>

      ${isAM ? `<div class="planning-prompt">☀ Morning check-in: What's the one thing that would make today a win?</div>` : ''}
      ${isPM ? `<div class="planning-prompt">🌙 Evening review: Did you move the needle today? What's tomorrow's priority?</div>` : ''}

      <div class="card">
        <div class="card-title">Today's #1 Priority ${data.carriedForward ? '<span style="color:var(--warning);font-size:0.65rem;">↩ carried from yesterday</span>' : ''}</div>
        <input type="text" class="priority-input" id="today-priority" value="${escapeHtml(data.priority || '')}" placeholder="What must get done today?">
      </div>

      <div class="card">
        <div class="card-title">Daily Habits</div>
        ${habitConfig.map((h, i) => `
          <div class="checkbox-row">
            <div class="custom-check ${habits[h] ? 'checked' : ''}" data-habit="${escapeHtml(h)}"></div>
            <span class="checkbox-label ${habits[h] ? 'completed' : ''}">${escapeHtml(h)}</span>
            <span class="streak-count">${streaks[h] || 0}🔥</span>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-title">Today's People</div>
        <div class="people-autocomplete">
          <input type="text" id="today-people-input" placeholder="Add a person to connect with...">
          <div id="today-people-autocomplete" class="autocomplete-list hidden"></div>
        </div>
        <div class="today-people-list" id="today-people-list">
          ${peopleList.map(p => `
            <span class="today-person-chip">${escapeHtml(p)} <button data-remove-person="${escapeHtml(p)}">✕</button></span>
          `).join('')}
        </div>
      </div>

      ${allDayBlocks.length ? `
        <div class="all-day-section">
          <div class="all-day-label">All Day</div>
          ${allDayBlocks.map(b => `<div class="timeline-block"><span class="timeline-block-title">${escapeHtml(b.title)}</span></div>`).join('')}
        </div>
      ` : ''}

      <div class="card">
        <div class="card-title">Timeline</div>
        <div class="timeline">
          ${buildTimeline(5, 24, recurring, timedBlocks, key)}
        </div>
      </div>
    </div>
  `;

  // Priority save
  const priorityInput = document.getElementById('today-priority');
  priorityInput.addEventListener('change', () => {
    userDoc('days/' + key).set({ ...data, priority: priorityInput.value, carriedForward: false }, { merge: true });
  });

  // Habit toggles
  tabContent.querySelectorAll('.custom-check').forEach(el => {
    el.addEventListener('click', async () => {
      const habit = el.dataset.habit;
      habits[habit] = !habits[habit];
      el.classList.toggle('checked');
      el.nextElementSibling.classList.toggle('completed');
      await userDoc('days/' + key).set({ habits }, { merge: true });
    });
  });

  // People autocomplete
  setupPeopleAutocomplete();

  // Remove person
  tabContent.querySelectorAll('[data-remove-person]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.removePerson;
      const updated = peopleList.filter(p => p !== name);
      await userDoc('days/' + key).set({ people: updated }, { merge: true });
      renderToday();
    });
  });

  // Timeline block add (click on empty slot)
  tabContent.querySelectorAll('.timeline-slot').forEach(slot => {
    let holdTimer;
    slot.addEventListener('mousedown', () => {
      holdTimer = setTimeout(() => addTimelineBlock(key, parseInt(slot.dataset.hour)), 500);
    });
    slot.addEventListener('mouseup', () => clearTimeout(holdTimer));
    slot.addEventListener('touchstart', (e) => {
      holdTimer = setTimeout(() => addTimelineBlock(key, parseInt(slot.dataset.hour)), 500);
    }, { passive: true });
    slot.addEventListener('touchend', () => clearTimeout(holdTimer));
  });
}

function buildTimeline(startHour, endHour, recurring, custom, dateStr) {
  let html = '';
  for (let h = startHour; h < endHour; h++) {
    const recBlock = recurring.find(b => h >= b.start && h < b.end);
    const customBlock = custom.find(b => b.startHour === h);

    html += `<div class="timeline-hour">
      <div class="timeline-label">${formatTime(h)}</div>
      <div class="timeline-slot" data-hour="${h}">`;

    if (customBlock) {
      html += `<div class="timeline-block">
        <span class="timeline-block-title">${escapeHtml(customBlock.title)}</span>
        ${customBlock.note ? `<div class="timeline-block-note">${escapeHtml(customBlock.note)}</div>` : ''}
      </div>`;
    } else if (recBlock && h === recBlock.start) {
      html += `<div class="timeline-block recurring">
        <span class="timeline-block-title">${escapeHtml(recBlock.title)}</span>
      </div>`;
    } else if (recBlock) {
      // continuation of recurring block, show lighter
    }

    html += `</div></div>`;
  }
  return html;
}

async function addTimelineBlock(dateStr, hour) {
  const title = prompt('Block title:');
  if (!title) return;
  const note = prompt('Note (optional):') || '';
  await userCollection('scheduleBlocks').add({
    date: dateStr,
    startHour: hour,
    endHour: hour + 1,
    title,
    note,
    allDay: false
  });
  renderToday();
}

async function getStreaks(habitConfig) {
  const streaks = {};
  for (const habit of habitConfig) {
    let streak = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    for (let i = 0; i < 60; i++) {
      const doc = await userDoc('days/' + dateKey(d)).get();
      if (doc.exists && doc.data().habits && doc.data().habits[habit]) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    streaks[habit] = streak;
  }
  return streaks;
}

function setupPeopleAutocomplete() {
  const input = document.getElementById('today-people-input');
  const list = document.getElementById('today-people-autocomplete');
  if (!input || !list) return;

  input.addEventListener('input', debounce(async () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 1) { list.classList.add('hidden'); return; }

    const snap = await userCollection('people').get();
    const matches = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (d.name && d.name.toLowerCase().includes(q)) matches.push(d.name);
    });

    if (matches.length === 0) { list.classList.add('hidden'); return; }
    list.innerHTML = matches.slice(0, 5).map(m => `<div class="autocomplete-item">${escapeHtml(m)}</div>`).join('');
    list.classList.remove('hidden');
  }, 200));

  list.addEventListener('click', async (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const name = item.textContent;
    input.value = '';
    list.classList.add('hidden');
    const key = todayKey();
    const doc = await userDoc('days/' + key).get();
    const data = doc.exists ? doc.data() : {};
    const people = data.people || [];
    if (!people.includes(name)) {
      people.push(name);
      await userDoc('days/' + key).set({ people }, { merge: true });
      renderToday();
    }
  });

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const name = input.value.trim();
      input.value = '';
      list.classList.add('hidden');
      const key = todayKey();
      const doc = await userDoc('days/' + key).get();
      const data = doc.exists ? doc.data() : {};
      const people = data.people || [];
      if (!people.includes(name)) {
        people.push(name);
        await userDoc('days/' + key).set({ people }, { merge: true });
        renderToday();
      }
    }
  });
}
