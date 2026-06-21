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
  const doc = await userDoc('days_' + key).get();
  const data = doc.exists ? doc.data() : {};

  const hour = new Date().getHours();
  const isAM = hour < 12;
  const isPM = hour >= 19;

  // Check for carry-forward
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = dateKey(yesterday);
  let carryForward = '';
  try {
    const yDoc = await userDoc('days_' + yKey).get();
    const yData = yDoc.exists ? yDoc.data() : {};
    carryForward = yData.priority && !yData.priorityDone ? yData.priority : '';
  } catch (e) {}

  if (!data.priority && carryForward) {
    data.priority = carryForward;
    data.carriedForward = true;
  }

  const habitsDoc = await userDoc('habitConfig').get();
  const habitConfig = habitsDoc.exists ? habitsDoc.data().habits : [
    'Scripture study', 'Prayer (morning & night)', 'Exercise', 'Spanish practice', 'School work', 'Read 30 min'
  ];

  const habits = data.habits || {};
  // Load streaks in background to avoid blocking render
  let streaks = {};
  for (const h of habitConfig) streaks[h] = 0;

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
      if (block) showBlockModal(key, block.startHour, block);
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
    const customBlock = custom.find(b => h >= b.startHour && h < b.endHour);
    const isBlockStart = customBlock && Math.floor(customBlock.startHour) === h;

    html += `<div class="timeline-hour">
      <div class="timeline-label">${formatTime(h)}</div>
      <div class="timeline-slot" data-hour="${h}">`;

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

function addTimelineBlock(dateStr, hour, existingBlock) {
  showBlockModal(dateStr, hour, existingBlock);
}

function showBlockModal(dateStr, hour, block) {
  const isEdit = !!block;
  const modal = document.getElementById('settings-modal');
  const body = document.getElementById('settings-body');
  document.querySelector('#settings-modal .modal-header h2').textContent = isEdit ? 'Edit Block' : 'Add Block';

  const startH = isEdit ? block.startHour : hour;
  const endH = isEdit ? block.endHour : Math.min(hour + 1, 24);
  const durOptions = [0.5, 1, 1.5, 2, 3, 4, 6, 8];
  const duration = endH - startH;

  body.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="block-title" value="${isEdit ? escapeHtml(block.title) : ''}" placeholder="What's this block for?">
    </div>
    <div class="form-group">
      <label>Start Time</label>
      <select id="block-start">
        ${Array.from({length: 38}, (_, i) => {
          const h = 5 + i * 0.5;
          const hr = Math.floor(h);
          const min = h % 1 ? '30' : '00';
          const label = formatTime(hr) + (min === '30' ? ':30' : '');
          return `<option value="${h}" ${h === startH ? 'selected' : ''}>${label}</option>`;
        }).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Duration</label>
      <div class="toggle-group" style="flex-wrap:wrap;">
        ${durOptions.map(d => `<button data-dur="${d}" class="${d === duration ? 'active' : ''}" style="min-width:50px;">${d < 1 ? '30m' : d + 'h'}</button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="block-notes" placeholder="Details...">${isEdit ? escapeHtml(block.note || '') : ''}</textarea>
    </div>
    <div class="form-group">
      <label>People (comma separated)</label>
      <input type="text" id="block-people" value="${isEdit && block.people ? escapeHtml(block.people.join(', ')) : ''}" placeholder="Who's involved?">
    </div>
    <button class="btn-primary" id="block-save" style="margin-bottom:8px;">Save</button>
    ${isEdit ? '<button class="btn-primary btn-danger" id="block-delete">Delete Block</button>' : ''}
  `;

  let selectedDur = duration;
  body.querySelectorAll('[data-dur]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDur = parseFloat(btn.dataset.dur);
      body.querySelectorAll('[data-dur]').forEach(b => b.classList.toggle('active', b.dataset.dur == selectedDur));
    });
  });

  modal.classList.remove('hidden');

  document.getElementById('block-save').addEventListener('click', async () => {
    const title = document.getElementById('block-title').value.trim();
    if (!title) return;
    const start = parseFloat(document.getElementById('block-start').value);
    const peopleStr = document.getElementById('block-people').value.trim();
    const data = {
      date: dateStr,
      startHour: start,
      endHour: start + selectedDur,
      title,
      note: document.getElementById('block-notes').value.trim(),
      people: peopleStr ? peopleStr.split(',').map(p => p.trim()).filter(Boolean) : [],
      allDay: false
    };
    if (isEdit) {
      await userCollection('scheduleBlocks').doc(block.id).update(data);
    } else {
      await userCollection('scheduleBlocks').add(data);
    }
    modal.classList.add('hidden');
    if (currentTab === 'today') renderToday();
    else renderSchedule();
  });

  if (isEdit) {
    document.getElementById('block-delete').addEventListener('click', async () => {
      if (settings.confirmBeforeDelete && !confirm('Delete this block?')) return;
      const blockData = { ...block };
      delete blockData.id;
      await userCollection('scheduleBlocks').doc(block.id).delete();
      showUndo('Block deleted', async () => {
        await userCollection('scheduleBlocks').add(blockData);
        if (currentTab === 'today') renderToday();
        else renderSchedule();
      });
      modal.classList.add('hidden');
      if (currentTab === 'today') renderToday();
      else renderSchedule();
    });
  }
}

async function getStreaks(habitConfig) {
  const streaks = {};
  for (const habit of habitConfig) {
    let streak = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    for (let i = 0; i < 30; i++) {
      try {
        const doc = await userDoc('days_' + dateKey(d)).get();
        if (doc.exists && doc.data().habits && doc.data().habits[habit]) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      } catch (e) {
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
