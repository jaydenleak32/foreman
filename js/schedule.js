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

    </div>
  `;

  // Show FAB (lives outside scrollable area)
  let fab = document.getElementById('sched-fab');
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'sched-fab';
    fab.className = 'pmg-fab';
    fab.textContent = '+';
    document.getElementById('app').appendChild(fab);
  }
  fab.classList.remove('hidden');

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

// === PMG-style Block Modal with Clock Face Picker ===
function showPMGBlockModal(dateStr, startHour, block) {
  const isEdit = !!block;
  const modal = document.getElementById('settings-modal');
  const body = document.getElementById('settings-body');
  document.querySelector('#settings-modal .modal-header h2').textContent = isEdit ? 'Edit Block' : 'New Block';

  const startH = isEdit ? block.startHour : startHour;
  const endH = isEdit ? block.endHour : Math.min(startHour + 1, SCHEDULE_END);
  const cat = isEdit && block.category ? block.category : 'Appointment';

  const startHr = Math.floor(startH);
  const startMin = Math.round((startH - startHr) * 60);
  const endHr = Math.floor(endH);
  const endMin = Math.round((endH - endHr) * 60);

  // State for clock pickers
  const timeState = {
    start: { h: to12h(startHr).h, m: snapMin(startMin), ampm: to12h(startHr).ampm },
    end: { h: to12h(endHr).h, m: snapMin(endMin), ampm: to12h(endHr).ampm },
  };
  let activePicker = 'start'; // 'start' or 'end'
  let clockMode = 'hour'; // 'hour' or 'minute'

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

  function renderClockDisplay() {
    const t = timeState[activePicker];
    const hStr = String(t.h);
    const mStr = (t.m < 10 ? '0' : '') + t.m;
    document.getElementById('clock-display').innerHTML = `
      <span class="clock-display-part ${clockMode === 'hour' ? 'active' : ''}" id="cd-hour">${hStr}</span>
      <span class="clock-display-colon">:</span>
      <span class="clock-display-part ${clockMode === 'minute' ? 'active' : ''}" id="cd-min">${mStr}</span>
      <div class="clock-ampm">
        <button class="${t.ampm === 'AM' ? 'active' : ''}" data-ampm="AM">AM</button>
        <button class="${t.ampm === 'PM' ? 'active' : ''}" data-ampm="PM">PM</button>
      </div>
    `;
    // Tap hour/min to switch mode
    document.getElementById('cd-hour').addEventListener('click', () => { clockMode = 'hour'; renderClock(); });
    document.getElementById('cd-min').addEventListener('click', () => { clockMode = 'minute'; renderClock(); });
    // AM/PM
    document.querySelectorAll('#clock-display [data-ampm]').forEach(btn => {
      btn.addEventListener('click', () => {
        timeState[activePicker].ampm = btn.dataset.ampm;
        renderClock();
      });
    });
  }

  function renderClock() {
    renderClockDisplay();
    const face = document.getElementById('clock-face');
    const hand = document.getElementById('clock-hand');
    const t = timeState[activePicker];
    const radius = 82;
    const cx = 110, cy = 110;

    // Remove old numbers
    face.querySelectorAll('.clock-number').forEach(n => n.remove());

    if (clockMode === 'hour') {
      for (let i = 1; i <= 12; i++) {
        const angle = (i * 30 - 90) * Math.PI / 180;
        const x = cx + radius * Math.cos(angle) - 16;
        const y = cy + radius * Math.sin(angle) - 16;
        const num = document.createElement('div');
        num.className = 'clock-number' + (i === t.h ? ' selected' : '');
        num.textContent = i;
        num.style.left = x + 'px';
        num.style.top = y + 'px';
        num.dataset.value = i;
        face.appendChild(num);
      }
      const handAngle = t.h * 30 - 90;
      hand.style.height = (radius - 16) + 'px';
      hand.style.transform = `translateX(-1px) rotate(${handAngle + 90}deg)`;
    } else {
      for (let i = 0; i < 12; i++) {
        const m = i * 5;
        const angle = (i * 30 - 90) * Math.PI / 180;
        const x = cx + radius * Math.cos(angle) - 16;
        const y = cy + radius * Math.sin(angle) - 16;
        const num = document.createElement('div');
        num.className = 'clock-number' + (m === t.m ? ' selected' : '');
        num.textContent = (m < 10 ? '0' : '') + m;
        num.style.left = x + 'px';
        num.style.top = y + 'px';
        num.dataset.value = m;
        face.appendChild(num);
      }
      const handAngle = (t.m / 5) * 30 - 90;
      hand.style.height = (radius - 16) + 'px';
      hand.style.transform = `translateX(-1px) rotate(${handAngle + 90}deg)`;
    }

    // Tap numbers
    face.querySelectorAll('.clock-number').forEach(num => {
      num.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = parseInt(num.dataset.value);
        if (clockMode === 'hour') {
          timeState[activePicker].h = val;
          clockMode = 'minute';
        } else {
          timeState[activePicker].m = val;
        }
        renderClock();
      });
    });

    // Drag on clock face
    setupClockDrag(face, hand, t, cx, cy, radius);
  }

  function setupClockDrag(face, hand, t, cx, cy, radius) {
    let dragging = false;

    function getAngleFromEvent(e) {
      const rect = face.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - rect.left - cx;
      const dy = clientY - rect.top - cy;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      if (angle < 0) angle += 360;
      return angle;
    }

    function setValue(angle) {
      if (clockMode === 'hour') {
        let h = Math.round(angle / 30);
        if (h === 0) h = 12;
        if (h > 12) h = 12;
        timeState[activePicker].h = h;
      } else {
        let m = Math.round(angle / 6);
        if (m >= 60) m = 0;
        m = Math.round(m / 5) * 5;
        if (m >= 60) m = 0;
        timeState[activePicker].m = m;
      }
      renderClock();
    }

    face.onpointerdown = (e) => { dragging = true; face.setPointerCapture(e.pointerId); setValue(getAngleFromEvent(e)); };
    face.onpointermove = (e) => { if (dragging) setValue(getAngleFromEvent(e)); };
    face.onpointerup = (e) => {
      if (dragging) {
        dragging = false;
        if (clockMode === 'hour') {
          clockMode = 'minute';
          renderClock();
        }
      }
    };
  }

  // Start/End tabs
  body.querySelectorAll('.clock-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activePicker = tab.dataset.picker;
      clockMode = 'hour';
      body.querySelectorAll('.clock-tab').forEach(t => t.classList.toggle('active', t.dataset.picker === activePicker));
      renderClock();
    });
  });

  // Category chips
  let selectedCat = cat;
  body.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedCat = chip.dataset.cat;
      body.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === selectedCat));
    });
  });

  modal.classList.remove('hidden');
  renderClock();

  // Save
  document.getElementById('blk-save').addEventListener('click', async () => {
    const title = document.getElementById('blk-title').value.trim();
    if (!title) { document.getElementById('blk-title').focus(); return; }

    const s = timeState.start;
    const e = timeState.end;
    const start24 = to24h(s.h, s.ampm) + s.m / 60;
    const end24 = to24h(e.h, e.ampm) + e.m / 60;

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

function snapMin(m) {
  return Math.round(m / 5) * 5 % 60;
}
