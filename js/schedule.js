// === SCHEDULE TAB (PMG-style with collapsible month + swipe) ===

let scheduleSelectedDate = new Date();
let calendarExpanded = false;
let showRoutines = false;

const BLOCK_COLORS = {
  Work: { bg: 'rgba(76, 132, 196, 0.25)', border: '#4c84c4', text: '#7ab0e8' },
  School: { bg: 'rgba(156, 108, 196, 0.25)', border: '#9c6cc4', text: '#c4a0e8' },
  Personal: { bg: 'rgba(78, 166, 103, 0.25)', border: '#4ea667', text: '#7ed49a' },
  Fitness: { bg: 'rgba(219, 152, 52, 0.25)', border: '#db9834', text: '#e8b86a' },
  Church: { bg: 'rgba(196, 108, 108, 0.25)', border: '#c46c6c', text: '#e89a9a' },
  Appointment: { bg: 'rgba(194, 105, 60, 0.25)', border: '#C2693C', text: '#e89a6a' },
  Other: { bg: 'rgba(140, 140, 140, 0.2)', border: '#888', text: '#aaa' },
  recurring: { bg: 'rgba(76, 132, 196, 0.15)', border: '#4c84c4', text: '#7ab0e8' },
};
const BLOCK_CATEGORIES = ['Work', 'School', 'Personal', 'Fitness', 'Church', 'Appointment', 'Other'];
const SCHEDULE_START = 5;
const SCHEDULE_END = 24;
const HOUR_HEIGHT = 60;

// === Main Render ===
async function renderSchedule() {
  if (showRoutines) { renderRoutinesView(); return; }

  const today = todayKey();
  const selectedKey = dateKey(scheduleSelectedDate);
  const isToday = selectedKey === today;
  const dayOfWeek = scheduleSelectedDate.getDay();

  // Load recurring routines + custom blocks
  const [routinesSnap, blocksSnap] = await Promise.all([
    userCollection('routines').get(),
    userCollection('scheduleBlocks').where('date', '==', selectedKey).get()
  ]);

  const routines = [];
  routinesSnap.forEach(d => routines.push({ id: d.id, ...d.data() }));
  const todayRoutines = routines.filter(r => {
    if (r.type === 'daily') return true;
    if (r.type === 'weekly') return r.days && r.days.includes(dayOfWeek);
    if (r.type === 'custom') return r.days && r.days.includes(dayOfWeek);
    return false;
  });

  // Check for skipped instances
  const skipsDoc = await userDoc('skips_' + selectedKey).get().catch(() => null);
  const skips = skipsDoc && skipsDoc.exists ? skipsDoc.data().ids || [] : [];
  const activeRoutines = todayRoutines.filter(r => !skips.includes(r.id));

  const customBlocks = [];
  blocksSnap.forEach(d => customBlocks.push({ id: d.id, ...d.data() }));
  const allDayBlocks = customBlocks.filter(b => b.allDay);
  const timedBlocks = customBlocks.filter(b => !b.allDay);

  // Current time
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const timeIndicatorTop = isToday && currentHour >= SCHEDULE_START && currentHour < SCHEDULE_END
    ? (currentHour - SCHEDULE_START) * HOUR_HEIGHT : -1;
  const totalHeight = (SCHEDULE_END - SCHEDULE_START) * HOUR_HEIGHT;

  // Use flex layout: fixed header + scrollable body
  tabContent.style.display = 'flex';
  tabContent.style.flexDirection = 'column';
  tabContent.style.overflow = 'hidden';

  tabContent.innerHTML = `
    <div class="sched-sticky-header">
      ${buildCalendarHeader()}
      ${calendarExpanded ? buildMonthGrid() : buildWeekStrip()}
      <div class="sched-toolbar">
        <button class="btn-text" id="sched-today-btn" ${isToday ? 'disabled style="opacity:0.4;"' : ''}>Today</button>
        <button class="btn-text" id="sched-routines-btn">⚙ Routines</button>
      </div>
    </div>
    <div class="sched-scroll-body" id="sched-scroll-body">
      ${allDayBlocks.length ? `
        <div class="all-day-section" style="padding:0 16px;">
          <div class="all-day-label">ALL DAY</div>
          ${allDayBlocks.map(b => `<div class="allday-chip" data-delete-block="${b.id}">${escapeHtml(b.title)} ✕</div>`).join('')}
        </div>
      ` : ''}

      <div class="sched-swipe-container" id="sched-swipe" style="padding:0 16px;">
        <div class="pmg-timeline" id="pmg-timeline" style="height:${totalHeight}px;">
          ${buildHourLines()}
          ${buildRoutineBlocks(activeRoutines, skips, selectedKey)}
          ${buildEventCards(timedBlocks)}
          ${timeIndicatorTop >= 0 ? `<div class="pmg-now-line" style="top:${timeIndicatorTop}px;"><div class="pmg-now-dot"></div></div>` : ''}
          <div class="pmg-tap-zone" id="pmg-tap-zone"></div>
        </div>
      </div>
    </div>
  `;

  // FAB
  let fab = document.getElementById('sched-fab');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'sched-fab';
    fab.className = 'pmg-fab';
    fab.textContent = '+';
    document.getElementById('app').appendChild(fab);
  }
  fab.classList.remove('hidden');

  setupScheduleEvents(selectedKey, timedBlocks, activeRoutines, skips, currentHour);
  setupDaySwipe();

  // Scroll to current time or 8 AM
  requestAnimationFrame(() => {
    const scrollBody = document.getElementById('sched-scroll-body');
    if (scrollBody) {
      const offset = timeIndicatorTop >= 0 ? timeIndicatorTop - 80 : (8 - SCHEDULE_START) * HOUR_HEIGHT;
      scrollBody.scrollTop = offset;
    }
  });
}

// === Calendar Header ===
function buildCalendarHeader() {
  const monthName = scheduleSelectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return `
    <div class="sched-header">
      <button class="btn-text sched-nav-btn" id="sched-prev-month">‹</button>
      <button class="sched-month-btn" id="sched-toggle-cal">${monthName} ${calendarExpanded ? '▴' : '▾'}</button>
      <button class="btn-text sched-nav-btn" id="sched-next-month">›</button>
    </div>
  `;
}

// === Week Strip ===
function buildWeekStrip() {
  const weekDates = getWeekDates(scheduleSelectedDate, settings.weekStartsMonday);
  const today = todayKey();
  const selectedKey = dateKey(scheduleSelectedDate);
  const names = dayNames(settings.weekStartsMonday);

  return `<div class="week-strip">${weekDates.map((d, i) => {
    const k = dateKey(d);
    return `<button class="week-day-btn ${k === selectedKey ? 'active' : ''} ${k === today ? 'today' : ''}" data-date="${k}">
      <span class="week-day-name">${names[i]}</span>
      <span class="week-day-num">${d.getDate()}</span>
    </button>`;
  }).join('')}</div>`;
}

// === Month Grid ===
function buildMonthGrid() {
  const year = scheduleSelectedDate.getFullYear();
  const month = scheduleSelectedDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = todayKey();
  const selectedKey = dateKey(scheduleSelectedDate);

  const dayLabels = dayNames(settings.weekStartsMonday);
  let startPad = firstDay.getDay();
  if (settings.weekStartsMonday) startPad = startPad === 0 ? 6 : startPad - 1;

  let cells = '';
  for (let i = 0; i < startPad; i++) cells += '<div class="month-cell empty"></div>';
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    const k = dateKey(dt);
    const cls = ['month-cell'];
    if (k === today) cls.push('today');
    if (k === selectedKey) cls.push('active');
    cells += `<div class="${cls.join(' ')}" data-date="${k}">${d}</div>`;
  }

  return `
    <div class="month-grid-container">
      <div class="month-grid-header">${dayLabels.map(n => `<div class="month-hdr">${n}</div>`).join('')}</div>
      <div class="month-grid">${cells}</div>
    </div>
  `;
}

// === Timeline builders ===
function buildHourLines() {
  return Array.from({length: SCHEDULE_END - SCHEDULE_START}, (_, i) => {
    const h = SCHEDULE_START + i;
    return `<div class="pmg-hour-line" style="top:${i * HOUR_HEIGHT}px;">
      <span class="pmg-hour-label">${formatTime(h)}</span>
    </div>`;
  }).join('');
}

function buildRoutineBlocks(routines, skips, dateStr) {
  return routines.map(r => {
    const top = (r.startHour - SCHEDULE_START) * HOUR_HEIGHT;
    const height = (r.endHour - r.startHour) * HOUR_HEIGHT;
    const color = BLOCK_COLORS[r.category] || BLOCK_COLORS.recurring;
    const startLabel = formatTimeMinutes(r.startHour);
    const endLabel = formatTimeMinutes(r.endHour);
    return `<div class="pmg-bg-block" data-routine-id="${r.id}" style="top:${top}px;height:${height}px;background:${color.bg};border-left:3px solid ${color.border};cursor:pointer;">
      <span class="pmg-bg-label" style="color:${color.text};">${escapeHtml(r.title)}</span>
      <span class="pmg-bg-time" style="color:${color.text};">${startLabel} - ${endLabel}</span>
      <span class="pmg-routine-badge">↻</span>
    </div>`;
  }).join('');
}

function buildEventCards(timedBlocks) {
  return timedBlocks.map(b => {
    const top = (b.startHour - SCHEDULE_START) * HOUR_HEIGHT;
    const height = Math.max((b.endHour - b.startHour) * HOUR_HEIGHT, 28);
    const cat = b.category || 'Appointment';
    const color = BLOCK_COLORS[cat] || BLOCK_COLORS.Appointment;
    const people = b.people && b.people.length ? b.people.join(', ') : '';
    return `<div class="pmg-event-card" data-block-id="${b.id}" style="top:${top + 2}px;height:${height - 4}px;background:${color.bg};border-left:3px solid ${color.border};">
      <div class="pmg-event-title" style="color:${color.text};">${escapeHtml(b.title)}</div>
      <div class="pmg-event-time">${formatTimeMinutes(b.startHour)} - ${formatTimeMinutes(b.endHour)}</div>
      ${people ? `<div class="pmg-event-people">👤 ${escapeHtml(people)}</div>` : ''}
      ${b.note ? `<div class="pmg-event-note">${escapeHtml(b.note)}</div>` : ''}
    </div>`;
  }).join('');
}

// === Event Setup ===
function setupScheduleEvents(selectedKey, timedBlocks, routines, skips, currentHour) {
  // Calendar toggle
  document.getElementById('sched-toggle-cal').addEventListener('click', () => {
    calendarExpanded = !calendarExpanded;
    renderSchedule();
  });

  // Month nav
  document.getElementById('sched-prev-month').addEventListener('click', () => {
    if (calendarExpanded) {
      scheduleSelectedDate.setMonth(scheduleSelectedDate.getMonth() - 1);
    } else {
      scheduleSelectedDate.setDate(scheduleSelectedDate.getDate() - 7);
    }
    renderSchedule();
  });
  document.getElementById('sched-next-month').addEventListener('click', () => {
    if (calendarExpanded) {
      scheduleSelectedDate.setMonth(scheduleSelectedDate.getMonth() + 1);
    } else {
      scheduleSelectedDate.setDate(scheduleSelectedDate.getDate() + 7);
    }
    renderSchedule();
  });

  // Today button
  document.getElementById('sched-today-btn').addEventListener('click', () => {
    scheduleSelectedDate = new Date();
    renderSchedule();
  });

  // Routines button
  document.getElementById('sched-routines-btn').addEventListener('click', () => {
    showRoutines = true;
    renderSchedule();
  });

  // Day selection (week strip or month grid)
  tabContent.querySelectorAll('[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      scheduleSelectedDate = new Date(el.dataset.date + 'T12:00:00');
      renderSchedule();
    });
  });

  // Tap timeline to add
  document.getElementById('pmg-tap-zone').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = SCHEDULE_START + (y / HOUR_HEIGHT);
    const snapped = Math.round(hour * 4) / 4;
    showPMGBlockModal(selectedKey, snapped);
  });

  // FAB
  document.getElementById('sched-fab').addEventListener('click', () => {
    const defaultHour = Math.max(SCHEDULE_START, Math.round(currentHour * 4) / 4);
    showPMGBlockModal(selectedKey, defaultHour);
  });

  // Tap event cards to edit
  tabContent.querySelectorAll('.pmg-event-card').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const block = timedBlocks.find(b => b.id === el.dataset.blockId);
      if (block) showPMGBlockModal(selectedKey, block.startHour, block);
    });
  });

  // Tap routine blocks - offer skip/edit
  tabContent.querySelectorAll('[data-routine-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const routine = routines.find(r => r.id === el.dataset.routineId);
      if (routine) showRoutineInstanceMenu(routine, selectedKey, skips);
    });
  });

  // Delete all-day
  tabContent.querySelectorAll('[data-delete-block]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (settings.confirmBeforeDelete && !confirm('Delete?')) return;
      await userCollection('scheduleBlocks').doc(btn.dataset.deleteBlock).delete();
      renderSchedule();
    });
  });
}

// === Day Swipe ===
function setupDaySwipe() {
  const container = document.getElementById('sched-scroll-body');
  if (!container) return;
  let startX = 0, dx = 0, swiping = false;
  const timeline = document.getElementById('pmg-timeline');

  container.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    dx = 0;
    swiping = true;
    if (timeline) timeline.style.transition = 'none';
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!swiping) return;
    dx = e.touches[0].clientX - startX;
    if (Math.abs(dx) > 15 && timeline) {
      timeline.style.transform = `translateX(${dx * 0.3}px)`;
      timeline.style.opacity = String(1 - Math.abs(dx) / 600);
    }
  }, { passive: true });

  container.addEventListener('touchend', () => {
    if (!swiping) return;
    swiping = false;

    if (Math.abs(dx) > 60) {
      const direction = dx > 0 ? -1 : 1;
      if (timeline) {
        timeline.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        timeline.style.transform = `translateX(${dx > 0 ? '100%' : '-100%'})`;
        timeline.style.opacity = '0';
      }
      setTimeout(() => {
        scheduleSelectedDate.setDate(scheduleSelectedDate.getDate() + direction);
        renderSchedule();
      }, 200);
    } else if (timeline) {
      timeline.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      timeline.style.transform = '';
      timeline.style.opacity = '1';
    }
  });
}

// === Routine Instance Menu (skip/edit this occurrence) ===
function showRoutineInstanceMenu(routine, dateStr, skips) {
  const modal = document.getElementById('settings-modal');
  const body = document.getElementById('settings-body');
  document.querySelector('#settings-modal .modal-header h2').textContent = routine.title;

  const color = BLOCK_COLORS[routine.category] || BLOCK_COLORS.recurring;
  const repeatLabel = routine.type === 'daily' ? 'Every day' :
    routine.type === 'weekly' ? 'Every ' + (routine.days || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ') :
    'Custom: ' + (routine.days || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');

  body.innerHTML = `
    <div class="card" style="background:${color.bg};border-left:3px solid ${color.border};margin-bottom:16px;">
      <div style="font-weight:700;color:${color.text};">${escapeHtml(routine.title)}</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;">${formatTimeMinutes(routine.startHour)} - ${formatTimeMinutes(routine.endHour)}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">↻ ${repeatLabel}</div>
    </div>

    <button class="btn-primary" id="ri-skip" style="margin-bottom:8px;">Skip just ${scheduleSelectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</button>
    <button class="btn-secondary" id="ri-add-over" style="margin-bottom:8px;width:100%;">Add a one-time block on top</button>
    <button class="btn-secondary" id="ri-edit-routine" style="margin-bottom:8px;width:100%;">Edit this routine (all days)</button>
    <button class="btn-primary btn-danger" id="ri-delete-routine">Delete this routine</button>
  `;

  modal.classList.remove('hidden');

  document.getElementById('ri-skip').addEventListener('click', async () => {
    const newSkips = [...skips, routine.id];
    await userDoc('skips_' + dateStr).set({ ids: newSkips });
    modal.classList.add('hidden');
    renderSchedule();
  });

  document.getElementById('ri-add-over').addEventListener('click', () => {
    modal.classList.add('hidden');
    showPMGBlockModal(dateStr, routine.startHour);
  });

  document.getElementById('ri-edit-routine').addEventListener('click', () => {
    modal.classList.add('hidden');
    showRoutineEditor(routine);
  });

  document.getElementById('ri-delete-routine').addEventListener('click', async () => {
    if (settings.confirmBeforeDelete && !confirm('Delete "' + routine.title + '" routine permanently?')) return;
    await userCollection('routines').doc(routine.id).delete();
    modal.classList.add('hidden');
    renderSchedule();
  });
}

// === Routines Manager View ===
async function renderRoutinesView() {
  const snap = await userCollection('routines').get();
  const routines = [];
  snap.forEach(d => routines.push({ id: d.id, ...d.data() }));

  tabContent.innerHTML = `
    <div class="fade-in">
      <div class="sched-header">
        <button class="btn-text" id="routines-back">‹ Back</button>
        <span class="sched-month-btn">Routines</span>
        <div></div>
      </div>

      <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:16px;">Repeating blocks that auto-fill your schedule. Tap to edit, swipe to delete.</p>

      ${routines.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">No routines yet</div>' :
        routines.map(r => {
          const color = BLOCK_COLORS[r.category] || BLOCK_COLORS.recurring;
          const repeatLabel = r.type === 'daily' ? 'Every day' :
            (r.days || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');
          return `
            <div class="routine-card" data-routine-id="${r.id}" style="border-left:3px solid ${color.border};">
              <div>
                <div class="routine-card-title">${escapeHtml(r.title)}</div>
                <div class="routine-card-time">${formatTimeMinutes(r.startHour)} - ${formatTimeMinutes(r.endHour)}</div>
                <div class="routine-card-repeat">↻ ${repeatLabel}</div>
              </div>
              <span class="routine-card-cat" style="background:${color.bg};color:${color.text};">${r.category || 'Other'}</span>
            </div>
          `;
        }).join('')}

      <button class="btn-primary" id="add-routine-btn" style="margin-top:16px;">+ Add Routine</button>
    </div>
  `;

  // Hide FAB in routines view
  const fab = document.getElementById('sched-fab');
  if (fab) fab.classList.add('hidden');

  document.getElementById('routines-back').addEventListener('click', () => {
    showRoutines = false;
    renderSchedule();
  });

  document.getElementById('add-routine-btn').addEventListener('click', () => {
    showRoutineEditor();
  });

  tabContent.querySelectorAll('.routine-card').forEach(el => {
    el.addEventListener('click', () => {
      const r = routines.find(r => r.id === el.dataset.routineId);
      if (r) showRoutineEditor(r);
    });
  });
}

// === Routine Editor ===
function showRoutineEditor(routine) {
  const isEdit = !!routine;
  const modal = document.getElementById('settings-modal');
  const body = document.getElementById('settings-body');
  document.querySelector('#settings-modal .modal-header h2').textContent = isEdit ? 'Edit Routine' : 'New Routine';

  const r = routine || { title: '', startHour: 8, endHour: 9, category: 'Personal', type: 'weekly', days: [] };
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  body.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="rtn-title" value="${escapeHtml(r.title)}" placeholder="e.g. Gym, Scripture Study...">
    </div>

    <div class="form-group">
      <label>Category</label>
      <div class="cat-chips">
        ${BLOCK_CATEGORIES.map(c => {
          const color = BLOCK_COLORS[c];
          return `<button class="cat-chip ${c === r.category ? 'active' : ''}" data-cat="${c}" style="--chip-color:${color.border};--chip-bg:${color.bg};">${c}</button>`;
        }).join('')}
      </div>
    </div>

    <div class="clock-picker-section">
      <div class="clock-picker-tabs">
        <button class="clock-tab active" data-picker="start">Start</button>
        <button class="clock-tab" data-picker="end">End</button>
      </div>
      <div class="clock-display" id="clock-display"></div>
      <div class="clock-face-wrap">
        <div class="clock-face" id="clock-face">
          <div class="clock-center-dot"></div>
          <div class="clock-hand" id="clock-hand"></div>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label>Repeat</label>
      <div class="toggle-group" style="margin-bottom:8px;">
        <button class="${r.type === 'daily' ? 'active' : ''}" data-rtype="daily">Daily</button>
        <button class="${r.type === 'weekly' || r.type === 'custom' ? 'active' : ''}" data-rtype="custom">Custom</button>
      </div>
      <div class="day-picker ${r.type === 'daily' ? 'hidden' : ''}" id="rtn-day-picker">
        ${dayLabels.map((label, i) => `
          <button class="day-pick-btn ${(r.days || []).includes(i) ? 'active' : ''}" data-day="${i}">${label}</button>
        `).join('')}
      </div>
    </div>

    <button class="btn-primary" id="rtn-save" style="margin-bottom:8px;">Save Routine</button>
    ${isEdit ? '<button class="btn-primary btn-danger" id="rtn-delete">Delete Routine</button>' : ''}
  `;

  // Clock picker state
  const startHr = Math.floor(r.startHour);
  const startMin = Math.round((r.startHour - startHr) * 60);
  const endHr = Math.floor(r.endHour);
  const endMin = Math.round((r.endHour - endHr) * 60);

  const timeState = {
    start: { h: to12h(startHr).h, m: snapMin(startMin), ampm: to12h(startHr).ampm },
    end: { h: to12h(endHr).h, m: snapMin(endMin), ampm: to12h(endHr).ampm },
  };
  let activePicker = 'start';
  let clockMode = 'hour';
  initClockPicker(body, timeState, activePicker, clockMode);

  // Repeat type
  let repeatType = r.type === 'daily' ? 'daily' : 'custom';
  let selectedDays = [...(r.days || [])];
  let selectedCat = r.category || 'Personal';

  body.querySelectorAll('[data-rtype]').forEach(btn => {
    btn.addEventListener('click', () => {
      repeatType = btn.dataset.rtype;
      body.querySelectorAll('[data-rtype]').forEach(b => b.classList.toggle('active', b.dataset.rtype === repeatType));
      document.getElementById('rtn-day-picker').classList.toggle('hidden', repeatType === 'daily');
    });
  });

  body.querySelectorAll('.day-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = parseInt(btn.dataset.day);
      if (selectedDays.includes(d)) selectedDays = selectedDays.filter(x => x !== d);
      else selectedDays.push(d);
      btn.classList.toggle('active');
    });
  });

  body.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedCat = chip.dataset.cat;
      body.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === selectedCat));
    });
  });

  modal.classList.remove('hidden');

  document.getElementById('rtn-save').addEventListener('click', async () => {
    const title = document.getElementById('rtn-title').value.trim();
    if (!title) { document.getElementById('rtn-title').focus(); return; }

    const s = timeState.start, e = timeState.end;
    const start24 = to24h(s.h, s.ampm) + s.m / 60;
    const end24 = to24h(e.h, e.ampm) + e.m / 60;

    const data = {
      title,
      startHour: start24,
      endHour: end24 > start24 ? end24 : start24 + 0.5,
      category: selectedCat,
      type: repeatType,
      days: repeatType === 'daily' ? [0,1,2,3,4,5,6] : selectedDays.sort()
    };

    if (isEdit) await userCollection('routines').doc(routine.id).update(data);
    else await userCollection('routines').add(data);
    modal.classList.add('hidden');
    renderSchedule();
  });

  if (isEdit) {
    document.getElementById('rtn-delete').addEventListener('click', async () => {
      if (settings.confirmBeforeDelete && !confirm('Delete?')) return;
      await userCollection('routines').doc(routine.id).delete();
      modal.classList.add('hidden');
      renderSchedule();
    });
  }
}

// === Reusable Clock Picker (shared between block modal and routine editor) ===
function initClockPicker(container, timeState, activePicker, clockMode) {
  function renderClockDisplay() {
    const t = timeState[activePicker];
    document.getElementById('clock-display').innerHTML = `
      <span class="clock-display-part ${clockMode === 'hour' ? 'active' : ''}" id="cd-hour">${t.h}</span>
      <span class="clock-display-colon">:</span>
      <span class="clock-display-part ${clockMode === 'minute' ? 'active' : ''}" id="cd-min">${(t.m < 10 ? '0' : '') + t.m}</span>
      <div class="clock-ampm">
        <button class="${t.ampm === 'AM' ? 'active' : ''}" data-ampm="AM">AM</button>
        <button class="${t.ampm === 'PM' ? 'active' : ''}" data-ampm="PM">PM</button>
      </div>
    `;
    document.getElementById('cd-hour').addEventListener('click', () => { clockMode = 'hour'; renderClock(); });
    document.getElementById('cd-min').addEventListener('click', () => { clockMode = 'minute'; renderClock(); });
    document.querySelectorAll('#clock-display [data-ampm]').forEach(btn => {
      btn.addEventListener('click', () => { timeState[activePicker].ampm = btn.dataset.ampm; renderClock(); });
    });
  }

  function renderClock() {
    renderClockDisplay();
    const face = document.getElementById('clock-face');
    const hand = document.getElementById('clock-hand');
    const t = timeState[activePicker];
    const radius = 82, cx = 110, cy = 110;

    face.querySelectorAll('.clock-number').forEach(n => n.remove());

    const count = clockMode === 'hour' ? 12 : 12;
    for (let i = 0; i < count; i++) {
      const val = clockMode === 'hour' ? i + 1 : i * 5;
      const angle = ((clockMode === 'hour' ? (i + 1) : i) * 30 - 90) * Math.PI / 180;
      const num = document.createElement('div');
      num.className = 'clock-number' + (val === (clockMode === 'hour' ? t.h : t.m) ? ' selected' : '');
      num.textContent = clockMode === 'minute' && val < 10 ? '0' + val : String(val);
      num.style.left = (cx + radius * Math.cos(angle) - 16) + 'px';
      num.style.top = (cy + radius * Math.sin(angle) - 16) + 'px';
      num.dataset.value = val;
      num.addEventListener('click', (e) => {
        e.stopPropagation();
        if (clockMode === 'hour') { timeState[activePicker].h = val; clockMode = 'minute'; }
        else { timeState[activePicker].m = val; }
        renderClock();
      });
      face.appendChild(num);
    }

    const handVal = clockMode === 'hour' ? t.h * 30 : (t.m / 5) * 30;
    hand.style.height = (radius - 16) + 'px';
    hand.style.transform = `translateX(-1px) rotate(${handVal}deg)`;

    setupClockDrag(face, hand, timeState, activePicker, clockMode, renderClock, () => { clockMode = 'minute'; });
  }

  // Start/End tabs
  container.querySelectorAll('.clock-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activePicker = tab.dataset.picker;
      clockMode = 'hour';
      container.querySelectorAll('.clock-tab').forEach(t => t.classList.toggle('active', t.dataset.picker === activePicker));
      renderClock();
    });
  });

  renderClock();
}

function setupClockDrag(face, hand, timeState, activePicker, clockMode, renderClock, onHourDone) {
  let dragging = false;
  function getAngle(e) {
    const rect = face.getBoundingClientRect();
    const px = (e.clientX || (e.touches && e.touches[0].clientX) || 0) - rect.left - 110;
    const py = (e.clientY || (e.touches && e.touches[0].clientY) || 0) - rect.top - 110;
    let a = Math.atan2(py, px) * 180 / Math.PI + 90;
    if (a < 0) a += 360;
    return a;
  }
  function update(angle) {
    let val;
    if (clockMode === 'hour') { val = Math.round(angle / 30); if (val <= 0 || val > 12) val = 12; timeState[activePicker].h = val; }
    else { val = Math.round(angle / 6); val = Math.round(val / 5) * 5; if (val >= 60) val = 0; timeState[activePicker].m = val; }
    const ha = clockMode === 'hour' ? val * 30 : (val / 5) * 30;
    hand.style.transform = `translateX(-1px) rotate(${ha}deg)`;
    face.querySelectorAll('.clock-number').forEach(n => n.classList.toggle('selected', parseInt(n.dataset.value) === val));
    const hEl = document.getElementById('cd-hour'), mEl = document.getElementById('cd-min');
    if (hEl) hEl.textContent = String(timeState[activePicker].h);
    if (mEl) mEl.textContent = (timeState[activePicker].m < 10 ? '0' : '') + timeState[activePicker].m;
  }
  face.addEventListener('touchstart', (e) => { e.preventDefault(); dragging = true; update(getAngle(e)); }, { passive: false });
  face.addEventListener('touchmove', (e) => { if (dragging) { e.preventDefault(); update(getAngle(e)); } }, { passive: false });
  face.addEventListener('touchend', () => { if (dragging) { dragging = false; if (clockMode === 'hour') { onHourDone(); renderClock(); } } });
  face.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; dragging = true; face.setPointerCapture(e.pointerId); update(getAngle(e)); });
  face.addEventListener('pointermove', (e) => { if (dragging && e.pointerType !== 'touch') update(getAngle(e)); });
  face.addEventListener('pointerup', (e) => { if (dragging && e.pointerType !== 'touch') { dragging = false; if (clockMode === 'hour') { onHourDone(); renderClock(); } } });
}

// === Block Modal (one-time events) ===
function showPMGBlockModal(dateStr, startHour, block) {
  const isEdit = !!block;
  const modal = document.getElementById('settings-modal');
  const body = document.getElementById('settings-body');
  document.querySelector('#settings-modal .modal-header h2').textContent = isEdit ? 'Edit Block' : 'New Block';

  const startH = isEdit ? block.startHour : startHour;
  const endH = isEdit ? block.endHour : Math.min(startHour + 1, SCHEDULE_END);
  const cat = isEdit && block.category ? block.category : 'Appointment';

  const startHr = Math.floor(startH), startMin = Math.round((startH - startHr) * 60);
  const endHr = Math.floor(endH), endMin = Math.round((endH - endHr) * 60);

  const timeState = {
    start: { h: to12h(startHr).h, m: snapMin(startMin), ampm: to12h(startHr).ampm },
    end: { h: to12h(endHr).h, m: snapMin(endMin), ampm: to12h(endHr).ampm },
  };

  body.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="blk-title" value="${isEdit ? escapeHtml(block.title) : ''}" placeholder="What's happening?">
    </div>
    <div class="form-group">
      <label>Category</label>
      <div class="cat-chips">
        ${BLOCK_CATEGORIES.map(c => {
          const color = BLOCK_COLORS[c];
          return `<button class="cat-chip ${c === cat ? 'active' : ''}" data-cat="${c}" style="--chip-color:${color.border};--chip-bg:${color.bg};">${c}</button>`;
        }).join('')}
      </div>
    </div>
    <div class="clock-picker-section">
      <div class="clock-picker-tabs">
        <button class="clock-tab active" data-picker="start">Start</button>
        <button class="clock-tab" data-picker="end">End</button>
      </div>
      <div class="clock-display" id="clock-display"></div>
      <div class="clock-face-wrap">
        <div class="clock-face" id="clock-face">
          <div class="clock-center-dot"></div>
          <div class="clock-hand" id="clock-hand"></div>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="blk-notes" placeholder="Details...">${isEdit && block.note ? escapeHtml(block.note) : ''}</textarea>
    </div>
    <div class="form-group">
      <label>People</label>
      <input type="text" id="blk-people" value="${isEdit && block.people ? escapeHtml(block.people.join(', ')) : ''}" placeholder="Who's involved? (comma separated)">
    </div>
    <button class="btn-primary" id="blk-save" style="margin-bottom:8px;">Save</button>
    ${isEdit ? '<button class="btn-primary btn-danger" id="blk-delete">Delete</button>' : ''}
  `;

  let selectedCat = cat;
  body.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedCat = chip.dataset.cat;
      body.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === selectedCat));
    });
  });

  modal.classList.remove('hidden');
  initClockPicker(body, timeState, 'start', 'hour');

  document.getElementById('blk-save').addEventListener('click', async () => {
    const title = document.getElementById('blk-title').value.trim();
    if (!title) { document.getElementById('blk-title').focus(); return; }
    const s = timeState.start, e = timeState.end;
    const start24 = to24h(s.h, s.ampm) + s.m / 60;
    const end24 = to24h(e.h, e.ampm) + e.m / 60;
    const data = {
      date: dateStr, startHour: start24, endHour: end24 > start24 ? end24 : start24 + 0.5,
      title, note: document.getElementById('blk-notes').value.trim(),
      people: document.getElementById('blk-people').value.trim().split(',').map(p => p.trim()).filter(Boolean),
      category: selectedCat, allDay: false
    };
    if (isEdit) await userCollection('scheduleBlocks').doc(block.id).update(data);
    else await userCollection('scheduleBlocks').add(data);
    modal.classList.add('hidden');
    if (currentTab === 'today') renderToday(); else renderSchedule();
  });

  if (isEdit) {
    document.getElementById('blk-delete').addEventListener('click', async () => {
      if (settings.confirmBeforeDelete && !confirm('Delete?')) return;
      await userCollection('scheduleBlocks').doc(block.id).delete();
      modal.classList.add('hidden');
      if (currentTab === 'today') renderToday(); else renderSchedule();
    });
  }
}

// === Helpers ===
function formatTimeMinutes(decimalHour) {
  const h = Math.floor(decimalHour);
  const m = Math.round((decimalHour - h) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

function to12h(h24) {
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let h = h24 % 12;
  if (h === 0) h = 12;
  return { h, ampm };
}

function to24h(h12, ampm) {
  if (ampm === 'AM') return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

function snapMin(m) { return Math.round(m / 5) * 5 % 60; }
