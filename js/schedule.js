// === SCHEDULE TAB ===

let scheduleSelectedDate = new Date();

async function renderSchedule() {
  const weekDates = getWeekDates(scheduleSelectedDate, settings.weekStartsMonday);
  const today = todayKey();
  const selectedKey = dateKey(scheduleSelectedDate);

  const dayOfWeek = scheduleSelectedDate.getDay();
  const recurring = (settings.recurringBlocks || []).filter(b => b.days.includes(dayOfWeek));

  const blocksSnap = await userCollection('scheduleBlocks').where('date', '==', selectedKey).get();
  const customBlocks = [];
  blocksSnap.forEach(d => customBlocks.push({ id: d.id, ...d.data() }));

  const allDayBlocks = customBlocks.filter(b => b.allDay);
  const timedBlocks = customBlocks.filter(b => !b.allDay);
  const names = dayNames(settings.weekStartsMonday);

  tabContent.innerHTML = `
    <div class="fade-in">
      <div class="week-strip">
        ${weekDates.map((d, i) => {
          const k = dateKey(d);
          return `<button class="week-day-btn ${k === selectedKey ? 'active' : ''} ${k === today ? 'today' : ''}" data-date="${k}">
            <span class="week-day-name">${names[i]}</span>
            <span class="week-day-num">${d.getDate()}</span>
          </button>`;
        }).join('')}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <button class="btn-secondary" id="sched-prev">← Prev</button>
        <span style="font-size:0.85rem;font-weight:600;">${scheduleSelectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        <button class="btn-secondary" id="sched-next">Next →</button>
      </div>

      ${allDayBlocks.length ? `
        <div class="all-day-section">
          <div class="all-day-label">All Day</div>
          ${allDayBlocks.map(b => `
            <div class="timeline-block" style="display:flex;justify-content:space-between;align-items:center;">
              <span class="timeline-block-title">${escapeHtml(b.title)}</span>
              <button class="btn-text" style="font-size:0.7rem;" data-delete-block="${b.id}">✕</button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="timeline">
        ${buildTimeline(5, 24, recurring, timedBlocks, selectedKey)}
      </div>

      <div style="margin-top:12px;display:flex;gap:8px;">
        <button class="btn-sm" id="sched-add-block">+ Add Block</button>
        <button class="btn-sm" id="sched-add-allday" style="background:var(--bg-hover);color:var(--text);">+ All Day</button>
      </div>
    </div>
  `;

  // Week strip
  tabContent.querySelectorAll('.week-day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      scheduleSelectedDate = new Date(btn.dataset.date + 'T12:00:00');
      renderSchedule();
    });
  });

  // Prev/Next
  document.getElementById('sched-prev').addEventListener('click', () => {
    scheduleSelectedDate.setDate(scheduleSelectedDate.getDate() - 7);
    renderSchedule();
  });
  document.getElementById('sched-next').addEventListener('click', () => {
    scheduleSelectedDate.setDate(scheduleSelectedDate.getDate() + 7);
    renderSchedule();
  });

  // Add block
  document.getElementById('sched-add-block').addEventListener('click', () => {
    addTimelineBlock(selectedKey, 8);
  });

  document.getElementById('sched-add-allday').addEventListener('click', async () => {
    const title = prompt('All-day event:');
    if (!title) return;
    await userCollection('scheduleBlocks').add({
      date: selectedKey,
      title,
      allDay: true
    });
    renderSchedule();
  });

  // Delete blocks
  tabContent.querySelectorAll('[data-delete-block]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteBlock;
      if (settings.confirmBeforeDelete && !confirm('Delete this block?')) return;
      const blockDoc = await userCollection('scheduleBlocks').doc(id).get();
      const blockData = blockDoc.data();
      await userCollection('scheduleBlocks').doc(id).delete();
      showUndo('Block deleted', async () => {
        await userCollection('scheduleBlocks').doc(id).set(blockData);
        renderSchedule();
      });
      renderSchedule();
    });
  });

  // Long-press on timeline slots
  tabContent.querySelectorAll('.timeline-slot').forEach(slot => {
    let holdTimer;
    const start = () => {
      holdTimer = setTimeout(() => addTimelineBlock(selectedKey, parseInt(slot.dataset.hour)).then(() => renderSchedule()), 500);
    };
    const cancel = () => clearTimeout(holdTimer);
    slot.addEventListener('mousedown', start);
    slot.addEventListener('mouseup', cancel);
    slot.addEventListener('mouseleave', cancel);
    slot.addEventListener('touchstart', start, { passive: true });
    slot.addEventListener('touchend', cancel);
  });
}
