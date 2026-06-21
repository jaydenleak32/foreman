// === TODAY TAB ===

async function renderToday() {
  try {
    await _renderToday();
  } catch (e) {
    console.error('Today tab error:', e);
    tabContent.innerHTML = `<div class="fade-in" style="text-align:center;padding:40px 16px;">
      <div style="font-size:1.3rem;margin-bottom:8px;">⚠ Couldn't load Today</div>
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

  // Parallel: load today's data, yesterday's data, habit config, and schedule blocks all at once
  const [todayDoc, yDoc, habitsDoc, blocksSnap] = await Promise.all([
    userDoc('days_' + key).get(),
    userDoc('days_' + yKey).get().catch(() => null),
    userDoc('habitConfig').get(),
    userCollection('scheduleBlocks').where('date', '==', key).get()
  ]);

  const data = todayDoc.exists ? todayDoc.data() : {};
  const yData = yDoc && yDoc.exists ? yDoc.data() : {};

  const hour = new Date().getHours();
  const isAM = hour < 12;
  const isPM = hour >= 19;

  const carryForward = yData.priority && !yData.priorityDone ? yData.priority : '';
  if (!data.priority && carryForward) {
    data.priority = carryForward;
    data.carriedForward = true;
  }

  const habitConfig = habitsDoc.exists ? habitsDoc.data().habits : [
    'Scripture study', 'Prayer (morning & night)', 'Exercise', 'Spanish practice', 'School work', 'Read 30 min'
  ];

  const habits = data.habits || {};
  let streaks = {};
  for (const h of habitConfig) streaks[h] = 0;

  const dayOfWeek = new Date().getDay();
  const recurring = (settings.recurringBlocks || []).filter(b => b.days.includes(dayOfWeek));
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
    userDoc('days_' + key).set({ ...data, priority: priorityInput.value, carriedForward: false }, { merge: true });
  });

  // Habit toggles
  tabContent.querySelectorAll('.custom-check').forEach(el => {
    el.addEventListener('click', async () => {
      const habit = el.dataset.habit;
      habits[habit] = !habits[habit];
      el.classList.toggle('checked');
      el.nextElementSibling.classList.toggle('completed');
      await userDoc('days_' + key).set({ habits }, { merge: true });
    });
  });

  // Load streaks in background and update UI
  getStreaks(habitConfig).then(s => {
    tabContent.querySelectorAll('.streak-count').forEach(el => {
      const habit = el.previousElementSibling.textContent;
      if (s[habit]) el.textContent = s[habit] + '🔥';
    });
  }).catch(() => {});

  // People autocomplete
  setupPeopleAutocomplete();

  // Remove person
  tabContent.querySelectorAll('[data-remove-person]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.removePerson;
      const updated = peopleList.filter(p => p !== name);
      await userDoc('days_' + key).set({ people: updated }, { merge: true });
      renderToday();
    });
  });

  // Click existing blocks to edit
  tabContent.querySelectorAll('[data-block-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const block = timedBlocks.find(b => b.id === el.dataset.blockId);
      if (block) showPMGBlockModal(key, block.startHour, block);
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
  const now = new Date();
  const isToday = dateStr === todayKey();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  let html = '';
  for (let h = startHour; h < endHour; h++) {
    const recBlock = recurring.find(b => h >= b.start && h < b.end);
    const customBlock = custom.find(b => h >= b.startHour && h < b.endHour);
    const isBlockStart = customBlock && Math.floor(customBlock.startHour) === h;

    const showIndicator = isToday && currentHour >= h && currentHour < h + 1;
    const indicatorOffset = showIndicator ? ((currentHour - h) * 44) : 0;

    html += `<div class="timeline-hour" style="position:relative;">
      <div class="timeline-label">${formatTime(h)}</div>
      <div class="timeline-slot" data-hour="${h}">`;

    if (showIndicator) {
      html += `<div class="time-indicator" style="top:${indicatorOffset}px;"></div>`;
    }

    if (isBlockStart) {
      const spans = Math.ceil(customBlock.endHour - customBlock.startHour);
      const people = customBlock.people && customBlock.people.length ? customBlock.people.join(', ') : '';
      html += `<div class="timeline-block" data-block-id="${customBlock.id}" style="min-height:${spans * 44 - 8}px;cursor:pointer;">
        <span class="timeline-block-title">${escapeHtml(customBlock.title)}</span>
        ${customBlock.note ? `<div class="timeline-block-note">${escapeHtml(customBlock.note)}</div>` : ''}
        ${people ? `<div class="timeline-block-note">👤 ${escapeHtml(people)}</div>` : ''}
      </div>`;
    } else if (customBlock) {
      // Continuation of a multi-hour block — leave empty
    } else if (recBlock && h === recBlock.start) {
      html += `<div class="timeline-block recurring">
        <span class="timeline-block-title">${escapeHtml(recBlock.title)}</span>
      </div>`;
    }

    html += `</div></div>`;
  }
  return html;
}

async function getStreaks(habitConfig) {
  // Batch-read last 30 days in parallel instead of 180 sequential reads
  const days = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }

  const docs = await Promise.all(
    days.map(k => userDoc('days_' + k).get().catch(() => null))
  );

  const dayData = {};
  docs.forEach((doc, i) => {
    if (doc && doc.exists) dayData[days[i]] = doc.data().habits || {};
  });

  const streaks = {};
  for (const habit of habitConfig) {
    let streak = 0;
    for (const key of days) {
      if (dayData[key] && dayData[key][habit]) streak++;
      else break;
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
    const doc = await userDoc('days_' + key).get();
    const data = doc.exists ? doc.data() : {};
    const people = data.people || [];
    if (!people.includes(name)) {
      people.push(name);
      await userDoc('days_' + key).set({ people }, { merge: true });
      renderToday();
    }
  });

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const name = input.value.trim();
      input.value = '';
      list.classList.add('hidden');
      const key = todayKey();
      const doc = await userDoc('days_' + key).get();
      const data = doc.exists ? doc.data() : {};
      const people = data.people || [];
      if (!people.includes(name)) {
        people.push(name);
        await userDoc('days_' + key).set({ people }, { merge: true });
        renderToday();
      }
    }
  });
}
