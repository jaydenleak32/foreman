// === REVIEW TAB ===

let reviewView = 'full';

async function renderReview() {
  const habitsDoc = await userDoc('habitConfig').get();
  const habitConfig = habitsDoc.exists ? habitsDoc.data().habits : [
    'Scripture study', 'Prayer (morning & night)', 'Exercise', 'Spanish practice', 'School work', 'Read 30 min'
  ];

  const weekKey = getWeekKey(new Date());
  const reviewDoc = await userDoc('reviews/' + weekKey).get();
  const reviewData = reviewDoc.exists ? reviewDoc.data() : {};

  const indicators = reviewData.indicators || {};
  const gutCheck = reviewData.gutCheck || 5;
  const journal = reviewData.journal || '';

  // Build habit grid data (last 7 weeks)
  const habitGrids = {};
  for (const habit of habitConfig) {
    habitGrids[habit] = await buildHabitGrid(habit, 7);
  }

  tabContent.innerHTML = `
    <div class="fade-in">
      <div class="toggle-group" style="margin-bottom:16px;">
        <button class="${reviewView === 'full' ? 'active' : ''}" data-view="full">Full Review</button>
        <button class="${reviewView === 'wizard' ? 'active' : ''}" data-view="wizard">Sunday Wizard</button>
      </div>

      ${reviewView === 'wizard' ? '' : `
        <div class="section-title" style="margin-top:0;">Habit Trackers</div>
        ${habitConfig.map(habit => `
          <div class="habit-grid-container card">
            <div class="habit-grid-title">
              <span>${escapeHtml(habit)}</span>
              <button class="btn-text" style="font-size:0.7rem;" data-delete-habit="${escapeHtml(habit)}">✕</button>
            </div>
            <div class="habit-grid">
              ${habitGrids[habit].map(cell => `
                <div class="habit-cell level-${cell.level}" title="${cell.date}: ${cell.done ? 'Done' : 'Not done'}"></div>
              `).join('')}
            </div>
          </div>
        `).join('')}

        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <input type="text" id="new-habit-name" placeholder="New habit name...">
          <button class="btn-sm" id="add-habit-btn">+</button>
        </div>

        <div class="section-title">Key Indicators (This Week)</div>
        <div class="card">
          ${renderIndicators(indicators)}
        </div>

        <div class="section-title">Gut Check</div>
        <div class="card gut-check">
          <div class="gut-check-value" id="gut-value">${gutCheck}</div>
          <input type="range" min="1" max="10" value="${gutCheck}" id="gut-slider">
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-muted);">
            <span>Rough week</span><span>Crushed it</span>
          </div>
        </div>

        <div class="section-title">Journal</div>
        <div class="card">
          <textarea id="review-journal" placeholder="Reflect on the week...">${escapeHtml(journal)}</textarea>
        </div>

        <div class="section-title">GTD System Review Checklist</div>
        <div class="card">
          ${renderGTDChecklist(reviewData.gtdChecklist || {})}
        </div>

        <button class="btn-primary" id="save-review" style="margin-top:12px;">Save Review</button>
      `}
    </div>
  `;

  if (reviewView === 'wizard') {
    startWizard();
    return;
  }

  // View toggle
  tabContent.querySelectorAll('.toggle-group button').forEach(btn => {
    btn.addEventListener('click', () => {
      reviewView = btn.dataset.view;
      renderReview();
    });
  });

  // Gut slider
  const gutSlider = document.getElementById('gut-slider');
  if (gutSlider) {
    gutSlider.addEventListener('input', () => {
      document.getElementById('gut-value').textContent = gutSlider.value;
    });
  }

  // Add habit
  const addHabitBtn = document.getElementById('add-habit-btn');
  if (addHabitBtn) {
    addHabitBtn.addEventListener('click', async () => {
      const name = document.getElementById('new-habit-name').value.trim();
      if (!name) return;
      habitConfig.push(name);
      await userDoc('habitConfig').set({ habits: habitConfig });
      renderReview();
    });
  }

  // Delete habit
  tabContent.querySelectorAll('[data-delete-habit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const habit = btn.dataset.deleteHabit;
      if (settings.confirmBeforeDelete && !confirm('Remove habit "' + habit + '"?')) return;
      const idx = habitConfig.indexOf(habit);
      if (idx > -1) habitConfig.splice(idx, 1);
      await userDoc('habitConfig').set({ habits: habitConfig });
      renderReview();
    });
  });

  // Save review
  const saveBtn = document.getElementById('save-review');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const ind = {};
      document.querySelectorAll('.indicator-value').forEach(input => {
        ind[input.dataset.key] = input.value;
      });
      const checklist = {};
      document.querySelectorAll('.gtd-check').forEach(el => {
        checklist[el.dataset.key] = el.classList.contains('checked');
      });
      await userDoc('reviews/' + weekKey).set({
        indicators: ind,
        gutCheck: parseInt(document.getElementById('gut-slider').value),
        journal: document.getElementById('review-journal').value,
        gtdChecklist: checklist,
        savedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      saveBtn.textContent = 'Saved ✓';
      setTimeout(() => saveBtn.textContent = 'Save Review', 2000);
    });
  }

  // GTD checklist toggles
  tabContent.querySelectorAll('.gtd-check').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('checked'));
  });
}

function renderIndicators(data) {
  const keys = [
    { key: 'workouts', label: 'Workouts completed' },
    { key: 'schoolDays', label: 'Days worked on school' },
    { key: 'spanish', label: 'Spanish practice sessions' },
    { key: 'management', label: 'Something learned about management' },
    { key: 'scripture', label: 'Scripture study days' },
    { key: 'temple', label: 'Temple attendance' },
    { key: 'dating', label: 'Dating effort' },
    { key: 'saved', label: 'Money saved ($)' },
  ];
  return keys.map(k => `
    <div class="indicator-field">
      <span class="indicator-label">${k.label}</span>
      <input type="text" class="indicator-value" data-key="${k.key}" value="${escapeHtml(data[k.key] || '')}">
    </div>
  `).join('');
}

function renderGTDChecklist(data) {
  const items = [
    'Empty inbox to zero',
    'Review all next actions',
    'Review all projects for next actions',
    'Review waiting-for list',
    'Review someday/maybe list',
    'Review calendar (past & upcoming)',
    'Review goals & priorities',
    'Process loose papers & notes'
  ];
  return items.map(item => {
    const key = item.replace(/\s+/g, '_').toLowerCase();
    return `
      <div class="checkbox-row">
        <div class="custom-check gtd-check ${data[key] ? 'checked' : ''}" data-key="${key}"></div>
        <span class="checkbox-label">${item}</span>
      </div>
    `;
  }).join('');
}

async function buildHabitGrid(habit, weeks) {
  const cells = [];
  const today = new Date();
  const totalDays = weeks * 7;
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const doc = await userDoc('days/' + key).get();
    const done = doc.exists && doc.data().habits && doc.data().habits[habit];
    cells.push({
      date: key,
      done,
      level: done ? 4 : 0
    });
  }
  return cells;
}

function getWeekKey(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = settings.weekStartsMonday ? (day === 0 ? -6 : 1 - day) : -day;
  d.setDate(d.getDate() + diff);
  return 'w-' + dateKey(d);
}

// === Sunday Planning Wizard ===
function startWizard() {
  const steps = [
    { title: 'Pray', body: 'Take a moment to pray and seek guidance for the week ahead.', type: 'prompt' },
    { title: 'Review Last Week', body: 'Look back at your habits, actions, and priorities. What went well? What needs attention?', type: 'prompt' },
    { title: 'Set Indicators', body: 'Fill in your 8 key indicators for this week.', type: 'indicators' },
    { title: 'Gut Check', body: 'How do you feel about last week overall?', type: 'gutcheck' },
    { title: 'Journal', body: 'Write your reflections, lessons learned, and thoughts.', type: 'journal' },
    { title: 'Commit', body: "Set your #1 priority for this week. What would make this week a win?", type: 'commit' },
  ];

  let step = 0;
  const weekKey = getWeekKey(new Date());
  let wizardData = {};

  const overlay = document.createElement('div');
  overlay.className = 'wizard-overlay';

  function renderStep() {
    const s = steps[step];
    overlay.innerHTML = `
      <div class="wizard-header">
        <button class="btn-text" id="wizard-close">✕ Close</button>
        <div class="wizard-progress">
          ${steps.map((_, i) => `<span class="wizard-dot ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}"></span>`).join('')}
        </div>
        <span style="width:60px;text-align:right;font-size:0.8rem;color:var(--text-muted);">${step + 1}/${steps.length}</span>
      </div>
      <div class="wizard-body">
        <h3>${s.title}</h3>
        <p>${s.body}</p>
        ${s.type === 'indicators' ? `<div style="width:100%;text-align:left;">${renderIndicators(wizardData.indicators || {})}</div>` : ''}
        ${s.type === 'gutcheck' ? `
          <div class="gut-check" style="width:100%;">
            <div class="gut-check-value" id="wiz-gut-value">${wizardData.gutCheck || 5}</div>
            <input type="range" min="1" max="10" value="${wizardData.gutCheck || 5}" id="wiz-gut-slider">
          </div>
        ` : ''}
        ${s.type === 'journal' ? `<textarea id="wiz-journal" style="width:100%;min-height:120px;" placeholder="Write here...">${escapeHtml(wizardData.journal || '')}</textarea>` : ''}
        ${s.type === 'commit' ? `<input type="text" id="wiz-commit" placeholder="This week's #1 priority..." value="${escapeHtml(wizardData.weekPriority || '')}" style="width:100%;">` : ''}
      </div>
      <div class="wizard-footer">
        ${step > 0 ? '<button class="btn-secondary" id="wiz-back">Back</button>' : '<div></div>'}
        <button class="btn-primary" id="wiz-next">${step === steps.length - 1 ? 'Finish' : 'Next'}</button>
      </div>
    `;

    overlay.querySelector('#wizard-close').addEventListener('click', () => {
      overlay.remove();
      reviewView = 'full';
      renderReview();
    });

    if (step > 0) {
      overlay.querySelector('#wiz-back').addEventListener('click', () => { saveStepData(); step--; renderStep(); });
    }

    overlay.querySelector('#wiz-next').addEventListener('click', async () => {
      saveStepData();
      if (step < steps.length - 1) {
        step++;
        renderStep();
      } else {
        await userDoc('reviews/' + weekKey).set({
          ...wizardData,
          savedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        overlay.remove();
        reviewView = 'full';
        renderReview();
      }
    });

    const gutSlider = overlay.querySelector('#wiz-gut-slider');
    if (gutSlider) {
      gutSlider.addEventListener('input', () => {
        overlay.querySelector('#wiz-gut-value').textContent = gutSlider.value;
      });
    }
  }

  function saveStepData() {
    const s = steps[step];
    if (s.type === 'indicators') {
      const ind = {};
      overlay.querySelectorAll('.indicator-value').forEach(input => { ind[input.dataset.key] = input.value; });
      wizardData.indicators = ind;
    } else if (s.type === 'gutcheck') {
      wizardData.gutCheck = parseInt(overlay.querySelector('#wiz-gut-slider')?.value || 5);
    } else if (s.type === 'journal') {
      wizardData.journal = overlay.querySelector('#wiz-journal')?.value || '';
    } else if (s.type === 'commit') {
      wizardData.weekPriority = overlay.querySelector('#wiz-commit')?.value || '';
    }
  }

  renderStep();
  document.body.appendChild(overlay);
}
