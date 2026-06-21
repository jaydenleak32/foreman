// === SCHEDULE TAB (PMG-style) ===

let scheduleSelectedDate = new Date();
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

async function renderSchedule() {
  const weekDates = getWeekDates(scheduleSelectedDate, settings.weekStartsMonday);
  const today = todayKey();
  const selectedKey = dateKey(scheduleSelectedDate);
  const isToday = selectedKey === today;

  const dayOfWeek = scheduleSelectedDate.getDay();
  const recurring = (settings.recurringBlocks || []).filter(b => b.days.includes(dayOfWeek));

  const blocksSnap = await userCollection('scheduleBlocks').where('date', '==', selectedKey).get();
  const customBlocks = [];
  blocksSnap.forEach(d => customBlocks.push({ id: d.id, ...d.data() }));

  const allDayBlocks = customBlocks.filter(b => b.allDay);
  const timedBlocks = customBlocks.filter(b => !b.allDay);
  const names = dayNames(settings.weekStartsMonday);

  // Current time position
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const timeIndicatorTop = isToday && currentHour >= SCHEDULE_START && currentHour < SCHEDULE_END
    ? (currentHour - SCHEDULE_START) * HOUR_HEIGHT
    : -1;

  const totalHeight = (SCHEDULE_END - SCHEDULE_START) * HOUR_HEIGHT;

  tabContent.innerHTML = `
    <div class="fade-in">
      <div class="sched-header">
        <button class="btn-text" id="sched-prev">‹</button>
        <span class="sched-month">${scheduleSelectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} ▾</span>
        <button class="btn-text" id="sched-next">›</button>
      </div>

      <div class="week-strip">
        ${weekDates.map((d, i) => {
          const k = dateKey(d);
          return `<button class="week-day-btn ${k === selectedKey ? 'active' : ''} ${k === today ? 'today' : ''}" data-date="${k}">
            <span class="week-day-name">${names[i]}</span>
            <span class="week-day-num">${d.getDate()}</span>
          </button>`;
        }).join('')}
      </div>

      ${allDayBlocks.length ? `
        <div class="all-day-section">
          <div class="all-day-label">ALL DAY</div>
          ${allDayBlocks.map(b => `
            <div class="allday-chip" data-delete-block="${b.id}">${escapeHtml(b.title)} ✕</div>
          `).join('')}
        </div>
      ` : ''}

      <div class="pmg-timeline" id="pmg-timeline" style="height:${totalHeight}px;">
        <!-- Hour lines -->
        ${Array.from({length: SCHEDULE_END - SCHEDULE_START}, (_, i) => {
          const h = SCHEDULE_START + i;
          return `<div class="pmg-hour-line" style="top:${i * HOUR_HEIGHT}px;">
            <span class="pmg-hour-label">${formatTime(h)}</span>
          </div>`;
        }).join('')}

        <!-- Recurring blocks (background canvases) -->
        ${recurring.map(b => {
          const top = (b.start - SCHEDULE_START) * HOUR_HEIGHT;
          const height = (b.end - b.start) * HOUR_HEIGHT;
          const color = BLOCK_COLORS[b.color] || BLOCK_COLORS.recurring;
          return `<div class="pmg-bg-block" style="top:${top}px;height:${height}px;background:${color.bg};border-left:3px solid ${color.border};">
            <span class="pmg-bg-label" style="color:${color.text};">${escapeHtml(b.title)}</span>
            <span class="pmg-bg-time" style="color:${color.text};">${formatTime(b.start)} – ${formatTime(b.end)}</span>
          </div>`;
        }).join('')}

        <!-- Custom blocks (floating cards) -->
        ${timedBlocks.map(b => {
          const top = (b.startHour - SCHEDULE_START) * HOUR_HEIGHT;
          const height = Math.max((b.endHour - b.startHour) * HOUR_HEIGHT, 28);
          const cat = b.category || 'Appointment';
          const color = BLOCK_COLORS[cat] || BLOCK_COLORS.Appointment;
          const people = b.people && b.people.length ? b.people.join(', ') : '';
          const startLabel = formatTimeMinutes(b.startHour);
          const endLabel = formatTimeMinutes(b.endHour);
          return `<div class="pmg-event-card" data-block-id="${b.id}" style="top:${top + 2}px;height:${height - 4}px;background:${color.bg};border-left:3px solid ${color.border};">
            <div class="pmg-event-title" style="color:${color.text};">${escapeHtml(b.title)}</div>
            <div class="pmg-event-time">${startLabel} – ${endLabel}</div>
            ${people ? `<div class="pmg-event-people">👤 ${escapeHtml(people)}</div>` : ''}
            ${b.note ? `<div class="pmg-event-note">${escapeHtml(b.note)}</div>` : ''}
          </div>`;
        }).join('')}

        <!-- Current time indicator -->
        ${timeIndicatorTop >= 0 ? `
          <div class="pmg-now-line" style="top:${timeIndicatorTop}px;">
            <div class="pmg-now-dot"></div>
          </div>
        ` : ''}

        <!-- Tap zone overlay -->
        <div class="pmg-tap-zone" id="pmg-tap-zone"></div>
      </div>

      <!-- FAB -->
      <button class="pmg-fab" id="sched-fab">+</button>
    </div>
  `;

  // Week strip nav
  tabContent.querySelectorAll('.week-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      scheduleSelectedDate = new Date(btn.dataset.date + 'T12:00:00');
      renderSchedule();
    });
  });

  document.getElementById('sched-prev').addEventListener('click', () => {
    scheduleSelectedDate.setDate(scheduleSelectedDate.getDate() - 7);
    renderSchedule();
  });
  document.getElementById('sched-next').addEventListener('click', () => {
    scheduleSelectedDate.setDate(scheduleSelectedDate.getDate() + 7);
    renderSchedule();
  });

  // Tap on timeline to add at that time
  document.getElementById('pmg-tap-zone').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + e.currentTarget.parentElement.scrollTop;
    const hour = SCHEDULE_START + (y / HOUR_HEIGHT);
    const snapped = Math.round(hour * 4) / 4; // snap to 15 min
    showPMGBlockModal(selectedKey, snapped);
  });

  // FAB
  document.getElementById('sched-fab').addEventListener('click', () => {
    const defaultHour = Math.max(SCHEDULE_START, Math.round(currentHour * 4) / 4);
    showPMGBlockModal(selectedKey, defaultHour);
  });

  // Tap existing blocks to edit
  tabContent.querySelectorAll('.pmg-event-card').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const block = timedBlocks.find(b => b.id === el.dataset.blockId);
      if (block) showPMGBlockModal(selectedKey, block.startHour, block);
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

  // Scroll to current time or 8 AM
  const timeline = document.getElementById('pmg-timeline');
  if (timeline) {
    const scrollTarget = timeIndicatorTop >= 0 ? timeIndicatorTop - 100 : (8 - SCHEDULE_START) * HOUR_HEIGHT;
    timeline.parentElement.scrollTop = scrollTarget;
  }
}

function formatTimeMinutes(decimalHour) {
  const h = Math.floor(decimalHour);
  const m = Math.round((decimalHour - h) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

// === PMG-style Block Modal with Scroll Wheels ===
function showPMGBlockModal(dateStr, startHour, block) {
  const isEdit = !!block;
  const modal = document.getElementById('settings-modal');
  const body = document.getElementById('settings-body');
  document.querySelector('#settings-modal .modal-header h2').textContent = isEdit ? 'Edit Block' : 'New Block';

  const startH = isEdit ? block.startHour : startHour;
  const endH = isEdit ? block.endHour : Math.min(startHour + 1, SCHEDULE_END);
  const cat = isEdit && block.category ? block.category : 'Appointment';

  // Convert decimal hours to h/m
  const startHr = Math.floor(startH);
  const startMin = Math.round((startH - startHr) * 60);
  const endHr = Math.floor(endH);
  const endMin = Math.round((endH - endHr) * 60);

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

    <div class="time-picker-section">
      <div class="time-picker-group">
        <label>Start</label>
        <div class="time-wheels">
          <div class="wheel-container">
            <div class="wheel" id="start-hour-wheel" data-field="startHour"></div>
          </div>
          <span class="wheel-colon">:</span>
          <div class="wheel-container">
            <div class="wheel" id="start-min-wheel" data-field="startMin"></div>
          </div>
          <div class="wheel-container wheel-ampm">
            <div class="wheel" id="start-ampm-wheel" data-field="startAmpm"></div>
          </div>
        </div>
      </div>
      <div class="time-picker-group">
        <label>End</label>
        <div class="time-wheels">
          <div class="wheel-container">
            <div class="wheel" id="end-hour-wheel" data-field="endHour"></div>
          </div>
          <span class="wheel-colon">:</span>
          <div class="wheel-container">
            <div class="wheel" id="end-min-wheel" data-field="endMin"></div>
          </div>
          <div class="wheel-container wheel-ampm">
            <div class="wheel" id="end-ampm-wheel" data-field="endAmpm"></div>
          </div>
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

  // Initialize wheels
  const hours12 = Array.from({length: 12}, (_, i) => i + 1);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const ampms = ['AM', 'PM'];

  function to12(h24) {
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { h: h12, ampm };
  }

  const s12 = to12(startHr);
  const e12 = to12(endHr);

  setupWheel('start-hour-wheel', hours12, s12.h, v => v);
  setupWheel('start-min-wheel', minutes, closestMin(startMin, minutes), v => (v < 10 ? '0' : '') + v);
  setupWheel('start-ampm-wheel', ampms, s12.ampm, v => v);
  setupWheel('end-hour-wheel', hours12, e12.h, v => v);
  setupWheel('end-min-wheel', minutes, closestMin(endMin, minutes), v => (v < 10 ? '0' : '') + v);
  setupWheel('end-ampm-wheel', ampms, e12.ampm, v => v);

  // Category chips
  let selectedCat = cat;
  body.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedCat = chip.dataset.cat;
      body.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === selectedCat));
    });
  });

  modal.classList.remove('hidden');

  // Save
  document.getElementById('blk-save').addEventListener('click', async () => {
    const title = document.getElementById('blk-title').value.trim();
    if (!title) { document.getElementById('blk-title').focus(); return; }

    const sH = getWheelValue('start-hour-wheel');
    const sM = getWheelValue('start-min-wheel');
    const sA = getWheelValue('start-ampm-wheel');
    const eH = getWheelValue('end-hour-wheel');
    const eM = getWheelValue('end-min-wheel');
    const eA = getWheelValue('end-ampm-wheel');

    const start24 = to24(sH, sA) + sM / 60;
    const end24 = to24(eH, eA) + eM / 60;

    const data = {
      date: dateStr,
      startHour: start24,
      endHour: end24 > start24 ? end24 : start24 + 0.5,
      title,
      note: document.getElementById('blk-notes').value.trim(),
      people: document.getElementById('blk-people').value.trim().split(',').map(p => p.trim()).filter(Boolean),
      category: selectedCat,
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

  // Delete
  if (isEdit) {
    document.getElementById('blk-delete').addEventListener('click', async () => {
      if (settings.confirmBeforeDelete && !confirm('Delete this block?')) return;
      await userCollection('scheduleBlocks').doc(block.id).delete();
      modal.classList.add('hidden');
      if (currentTab === 'today') renderToday();
      else renderSchedule();
    });
  }
}

function to24(h12, ampm) {
  if (ampm === 'AM') return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

function closestMin(m, options) {
  return options.reduce((prev, curr) => Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev);
}

// === Scroll Wheel Component ===
function setupWheel(id, values, initial, formatter) {
  const el = document.getElementById(id);
  if (!el) return;
  const itemH = 40;
  const visibleItems = 3;

  // Build items with padding
  const padded = ['', '', ...values, '', ''];
  el.innerHTML = padded.map((v, i) => {
    const isReal = i >= 2 && i < values.length + 2;
    return `<div class="wheel-item ${isReal ? '' : 'wheel-pad'}" data-value="${v}" data-index="${i}">${isReal ? formatter(v) : ''}</div>`;
  }).join('');
  el.style.height = (visibleItems * itemH) + 'px';

  // Set initial scroll
  const initialIdx = values.indexOf(initial);
  el.scrollTop = initialIdx * itemH;
  el._values = values;
  el._formatter = formatter;

  // Snap on scroll end
  let scrollTimer;
  el.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const idx = Math.round(el.scrollTop / itemH);
      el.scrollTo({ top: idx * itemH, behavior: 'smooth' });
      updateWheelHighlight(el, idx, itemH);
    }, 80);
  }, { passive: true });

  updateWheelHighlight(el, initialIdx, itemH);
}

function updateWheelHighlight(el, activeIdx, itemH) {
  el.querySelectorAll('.wheel-item').forEach((item, i) => {
    const realIdx = i - 2;
    item.classList.toggle('wheel-active', realIdx === activeIdx);
  });
}

function getWheelValue(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const itemH = 40;
  const idx = Math.round(el.scrollTop / itemH);
  return el._values[Math.max(0, Math.min(idx, el._values.length - 1))];
}
