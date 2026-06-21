// === REVIEW TAB ===

var INDICATOR_KEYS = [
  { key: 'workouts', label: 'Workouts', icon: '💪' },
  { key: 'schoolDays', label: 'School days', icon: '📚' },
  { key: 'spanish', label: 'Spanish', icon: '🇪🇸' },
  { key: 'management', label: 'Management lesson', icon: '📋' },
  { key: 'scripture', label: 'Scripture study', icon: '📖' },
  { key: 'temple', label: 'Temple', icon: '⛪' },
  { key: 'dating', label: 'Dating effort', icon: '❤️' },
  { key: 'saved', label: 'Saved ($)', icon: '💰' },
];

async function renderReview() {
  var isSunday = new Date().getDay() === 0;

  var [habitsDoc, reviewDoc] = await Promise.all([
    userDoc('habitConfig').get(),
    userDoc('reviews_' + getWeekKey(new Date())).get()
  ]);

  var habitConfig = habitsDoc.exists ? habitsDoc.data().habits : [
    'Scripture study', 'Prayer (morning & night)', 'Exercise', 'Spanish practice', 'School work', 'Read 30 min'
  ];

  var reviewData = reviewDoc.exists ? reviewDoc.data() : {};
  var indicators = reviewData.indicators || {};
  var gutCheck = reviewData.gutCheck || 0;

  // Get streak data for dashboard
  var streaks = {};
  try { streaks = await getStreaks(habitConfig); } catch(e) {}

  tabContent.innerHTML = `
    <div class="fade-in">
      ${isSunday ? `
        <button class="btn-primary review-cta" id="start-wizard">
          Start Weekly Review
        </button>
      ` : ''}

      <div class="section-title" style="margin-top:${isSunday ? '16px' : '0'};">This Week</div>

      <!-- Gut check summary -->
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-secondary);letter-spacing:0.5px;">Gut Check</div>
        <div style="font-size:2.4rem;font-weight:700;color:${gutCheck >= 7 ? 'var(--success)' : gutCheck >= 4 ? 'var(--accent)' : gutCheck > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${gutCheck || '—'}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);">${gutCheck >= 7 ? 'Strong week' : gutCheck >= 4 ? 'Solid' : gutCheck > 0 ? 'Tough week' : 'Not set yet'}</div>
      </div>

      <!-- Indicators grid -->
      <div class="review-indicators-grid">
        ${INDICATOR_KEYS.map(k => `
          <div class="review-ind-card">
            <div class="review-ind-icon">${k.icon}</div>
            <div class="review-ind-value">${indicators[k.key] || '—'}</div>
            <div class="review-ind-label">${k.label}</div>
          </div>
        `).join('')}
      </div>

      <!-- Habit streaks -->
      <div class="section-title">Habit Streaks</div>
      <div class="card">
        ${habitConfig.map(h => `
          <div class="review-streak-row">
            <span class="review-streak-name">${escapeHtml(h)}</span>
            <span class="review-streak-val">${streaks[h] || 0} <span style="font-size:0.7rem;">days</span></span>
          </div>
        `).join('')}
      </div>

      <!-- Journal preview -->
      ${reviewData.journal ? `
        <div class="section-title">Journal</div>
        <div class="card" style="font-size:0.85rem;color:var(--text-secondary);font-style:italic;">
          "${escapeHtml(reviewData.journal.length > 150 ? reviewData.journal.substring(0, 150) + '...' : reviewData.journal)}"
        </div>
      ` : ''}

      <button class="btn-secondary" id="full-review-btn" style="width:100%;margin-top:16px;">Full Review Page</button>
    </div>
  `;

  if (isSunday) {
    document.getElementById('start-wizard').addEventListener('click', () => startWizard());
  }

  document.getElementById('full-review-btn').addEventListener('click', () => renderFullReview());
}

// === Full Review (editable page) ===
async function renderFullReview() {
  var [habitsDoc, reviewDoc] = await Promise.all([
    userDoc('habitConfig').get(),
    userDoc('reviews_' + getWeekKey(new Date())).get()
  ]);

  var habitConfig = habitsDoc.exists ? habitsDoc.data().habits : [
    'Scripture study', 'Prayer (morning & night)', 'Exercise', 'Spanish practice', 'School work', 'Read 30 min'
  ];
  var reviewData = reviewDoc.exists ? reviewDoc.data() : {};
  var indicators = reviewData.indicators || {};
  var gutCheck = reviewData.gutCheck || 5;
  var journal = reviewData.journal || '';
  var weekKey = getWeekKey(new Date());

  // Build empty habit grids
  var habitGrids = {};
  var emptyGrid = [];
  for (var i = 48; i >= 0; i--) {
    var d = new Date(); d.setDate(d.getDate() - i);
    emptyGrid.push({ date: dateKey(d), done: false, level: 0 });
  }
  for (var habit of habitConfig) {
    habitGrids[habit] = [...emptyGrid];
  }

  tabContent.innerHTML = `
    <div class="fade-in">
      <button class="btn-text" id="review-back" style="margin-bottom:12px;">‹ Back to Dashboard</button>

      <div class="section-title" style="margin-top:0;">Habit Trackers</div>
      ${habitConfig.map(habit => `
        <div class="habit-grid-container card">
          <div class="habit-grid-title">
            <span>${escapeHtml(habit)}</span>
            <button class="btn-text" style="font-size:0.7rem;" data-delete-habit="${escapeHtml(habit)}">✕</button>
          </div>
          <div class="habit-grid">
            ${habitGrids[habit].map(cell => `
              <div class="habit-cell level-${cell.level}" title="${cell.date}"></div>
            `).join('')}
          </div>
        </div>
      `).join('')}

      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <input type="text" id="new-habit-name" placeholder="New habit name...">
        <button class="btn-sm" id="add-habit-btn">+</button>
      </div>

      <div class="section-title">Key Indicators</div>
      <div class="card">
        ${INDICATOR_KEYS.map(k => `
          <div class="indicator-field">
            <span class="indicator-label">${k.icon} ${k.label}</span>
            <input type="text" class="indicator-value" data-key="${k.key}" value="${escapeHtml(indicators[k.key] || '')}">
          </div>
        `).join('')}
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

      <div class="section-title">GTD Review Checklist</div>
      <div class="card">
        ${renderGTDChecklist(reviewData.gtdChecklist || {})}
      </div>

      <button class="btn-primary" id="save-review" style="margin-top:12px;">Save Review</button>
    </div>
  `;

  document.getElementById('review-back').addEventListener('click', () => renderReview());

  var gutSlider = document.getElementById('gut-slider');
  if (gutSlider) {
    gutSlider.addEventListener('input', () => {
      document.getElementById('gut-value').textContent = gutSlider.value;
    });
  }

  var addHabitBtn = document.getElementById('add-habit-btn');
  if (addHabitBtn) {
    addHabitBtn.addEventListener('click', async () => {
      var name = document.getElementById('new-habit-name').value.trim();
      if (!name) return;
      habitConfig.push(name);
      await userDoc('habitConfig').set({ habits: habitConfig });
      renderFullReview();
    });
  }

  tabContent.querySelectorAll('[data-delete-habit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      var h = btn.dataset.deleteHabit;
      if (settings.confirmBeforeDelete && !confirm('Remove "' + h + '"?')) return;
      var idx = habitConfig.indexOf(h);
      if (idx > -1) habitConfig.splice(idx, 1);
      await userDoc('habitConfig').set({ habits: habitConfig });
      renderFullReview();
    });
  });

  document.getElementById('save-review').addEventListener('click', async () => {
    var ind = {};
    document.querySelectorAll('.indicator-value').forEach(input => {
      ind[input.dataset.key] = input.value;
    });
    var checklist = {};
    document.querySelectorAll('.gtd-check').forEach(el => {
      checklist[el.dataset.key] = el.classList.contains('checked');
    });
    await userDoc('reviews_' + weekKey).set({
      indicators: ind,
      gutCheck: parseInt(document.getElementById('gut-slider').value),
      journal: document.getElementById('review-journal').value,
      gtdChecklist: checklist,
      savedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    var btn = document.getElementById('save-review');
    btn.textContent = 'Saved ✓';
    setTimeout(() => btn.textContent = 'Save Review', 2000);
  });

  tabContent.querySelectorAll('.gtd-check').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('checked'));
  });
}

function renderGTDChecklist(data) {
  var items = [
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
    var key = item.replace(/\s+/g, '_').toLowerCase();
    return `
      <div class="checkbox-row">
        <div class="custom-check gtd-check ${data[key] ? 'checked' : ''}" data-key="${key}"></div>
        <span class="checkbox-label">${item}</span>
      </div>
    `;
  }).join('');
}

function getWeekKey(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = settings.weekStartsMonday ? (day === 0 ? -6 : 1 - day) : -day;
  d.setDate(d.getDate() + diff);
  return 'w-' + dateKey(d);
}

// === Sunday Planning Wizard ===
function startWizard() {
  var steps = [
    { title: 'Pray', body: 'Take a moment to pray and seek guidance for the week ahead.', type: 'prompt' },
    { title: 'Review Last Week', body: 'Look back at your habits, actions, and priorities. What went well? What needs attention?', type: 'prompt' },
    { title: 'Set Indicators', body: 'Fill in your 8 key indicators for this week.', type: 'indicators' },
    { title: 'Gut Check', body: 'How do you feel about last week overall?', type: 'gutcheck' },
    { title: 'Journal', body: 'Write your reflections, lessons learned, and thoughts.', type: 'journal' },
    { title: 'Commit', body: "Set your #1 priority for this week. What would make this week a win?", type: 'commit' },
  ];

  var step = 0;
  var weekKey = getWeekKey(new Date());
  var wizardData = {};

  var overlay = document.createElement('div');
  overlay.className = 'wizard-overlay';

  function renderStep() {
    var s = steps[step];
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
        ${s.type === 'indicators' ? `<div style="width:100%;text-align:left;">${INDICATOR_KEYS.map(k => `
          <div class="indicator-field">
            <span class="indicator-label">${k.icon} ${k.label}</span>
            <input type="text" class="indicator-value" data-key="${k.key}" value="${escapeHtml((wizardData.indicators || {})[k.key] || '')}">
          </div>
        `).join('')}</div>` : ''}
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
        await userDoc('reviews_' + weekKey).set({
          ...wizardData,
          savedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        overlay.remove();
        renderReview();
      }
    });

    var gutSlider = overlay.querySelector('#wiz-gut-slider');
    if (gutSlider) {
      gutSlider.addEventListener('input', () => {
        overlay.querySelector('#wiz-gut-value').textContent = gutSlider.value;
      });
    }
  }

  function saveStepData() {
    var s = steps[step];
    if (s.type === 'indicators') {
      var ind = {};
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
