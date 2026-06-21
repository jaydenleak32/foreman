// === SETTINGS ===

function renderSettings() {
  const body = document.getElementById('settings-body');
  document.querySelector('#settings-modal .modal-header h2').textContent = 'Settings';

  body.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">Profile</div>
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="set-name" value="${escapeHtml(settings.name || '')}">
      </div>
      <div class="form-group">
        <label>Job Title</label>
        <input type="text" id="set-job" value="${escapeHtml(settings.jobTitle || '')}">
      </div>
      <div class="form-group">
        <label>Start Date</label>
        <input type="date" id="set-start" value="${settings.startDate || ''}">
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Appearance</div>
      <div class="setting-row">
        <span class="setting-label">Theme</span>
        <select id="set-theme" style="width:auto;">
          <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
          <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
          <option value="auto" ${settings.theme === 'auto' ? 'selected' : ''}>Auto</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Behavior</div>
      <div class="setting-row">
        <span class="setting-label">Default Tab</span>
        <select id="set-default-tab" style="width:auto;">
          <option value="today" ${settings.defaultTab === 'today' ? 'selected' : ''}>Today</option>
          <option value="schedule" ${settings.defaultTab === 'schedule' ? 'selected' : ''}>Schedule</option>
          <option value="inbox" ${settings.defaultTab === 'inbox' ? 'selected' : ''}>Inbox</option>
          <option value="people" ${settings.defaultTab === 'people' ? 'selected' : ''}>People</option>
          <option value="review" ${settings.defaultTab === 'review' ? 'selected' : ''}>Review</option>
          <option value="budget" ${settings.defaultTab === 'budget' ? 'selected' : ''}>Budget</option>
        </select>
      </div>
      <div class="setting-row">
        <span class="setting-label">Week Starts Monday</span>
        <div class="toggle-switch ${settings.weekStartsMonday ? 'on' : ''}" id="set-week-monday"></div>
      </div>
      <div class="setting-row">
        <span class="setting-label">Confirm Before Delete</span>
        <div class="toggle-switch ${settings.confirmBeforeDelete ? 'on' : ''}" id="set-confirm-delete"></div>
      </div>
      <div class="setting-row">
        <span class="setting-label">Check-ins Per Day</span>
        <input type="number" id="set-checkins" style="width:60px;" min="1" max="10" value="${settings.checkInsPerDay || 2}">
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Security</div>
      <div class="form-group">
        <label>PIN Lock (4 digits, leave empty to disable)</label>
        <input type="password" id="set-pin" maxlength="4" pattern="[0-9]{4}" value="${settings.pin || ''}" placeholder="••••" inputmode="numeric">
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Language</div>
      <div class="setting-row">
        <span class="setting-label">Language</span>
        <select id="set-lang" style="width:auto;">
          <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
          <option value="es" ${settings.language === 'es' ? 'selected' : ''}>Español (coming soon)</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Recurring Schedule Blocks</div>
      <div id="recurring-blocks-list">
        ${(settings.recurringBlocks || []).map((b, i) => `
          <div class="recurring-block-item">
            <span style="flex:1;">${escapeHtml(b.title)}</span>
            <span>${formatTime(b.start)}-${formatTime(b.end)}</span>
            <span class="days">${b.days.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(',')}</span>
            <button class="btn-text" style="font-size:0.7rem;" data-delete-recurring="${i}">✕</button>
          </div>
        `).join('')}
      </div>
      <button class="btn-secondary" id="add-recurring-btn" style="margin-top:8px;">+ Add Recurring Block</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Data</div>
      <button class="btn-secondary" id="export-data-btn" style="width:100%;margin-bottom:8px;">📥 Export All Data (JSON)</button>
      <button class="btn-secondary btn-danger" id="signout-btn" style="width:100%;">Sign Out</button>
    </div>

    <button class="btn-primary" id="save-settings-btn" style="margin-top:16px;">Save Settings</button>
  `;

  // Toggle switches
  document.getElementById('set-week-monday').addEventListener('click', function() { this.classList.toggle('on'); });
  document.getElementById('set-confirm-delete').addEventListener('click', function() { this.classList.toggle('on'); });

  // Save
  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    settings.name = document.getElementById('set-name').value.trim();
    settings.jobTitle = document.getElementById('set-job').value.trim();
    settings.startDate = document.getElementById('set-start').value;
    settings.theme = document.getElementById('set-theme').value;
    settings.defaultTab = document.getElementById('set-default-tab').value;
    settings.weekStartsMonday = document.getElementById('set-week-monday').classList.contains('on');
    settings.confirmBeforeDelete = document.getElementById('set-confirm-delete').classList.contains('on');
    settings.checkInsPerDay = parseInt(document.getElementById('set-checkins').value) || 2;
    settings.pin = document.getElementById('set-pin').value;
    settings.language = document.getElementById('set-lang').value;

    applyTheme(settings.theme);
    await saveSettings();
    document.getElementById('settings-modal').classList.add('hidden');
    switchTab(currentTab);
  });

  // Add recurring block
  document.getElementById('add-recurring-btn').addEventListener('click', () => {
    const title = prompt('Block title (e.g. "Gym"):');
    if (!title) return;
    const start = parseInt(prompt('Start hour (0-23):'));
    const end = parseInt(prompt('End hour (0-23):'));
    if (isNaN(start) || isNaN(end)) return;
    const daysStr = prompt('Days (comma separated: 0=Sun,1=Mon,...6=Sat):') || '1,2,3,4,5';
    const days = daysStr.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));

    settings.recurringBlocks = settings.recurringBlocks || [];
    settings.recurringBlocks.push({ title, start, end, days, color: 'recurring' });
    renderSettings();
  });

  // Delete recurring
  body.querySelectorAll('[data-delete-recurring]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.deleteRecurring);
      settings.recurringBlocks.splice(idx, 1);
      renderSettings();
    });
  });

  // Export
  document.getElementById('export-data-btn').addEventListener('click', async () => {
    const collections = ['inbox', 'actions', 'projects', 'waiting', 'someday', 'people', 'budgetEntries', 'scheduleBlocks'];
    const data = { settings };

    for (const col of collections) {
      data[col] = [];
      const snap = await userCollection(col).get();
      snap.forEach(d => data[col].push({ id: d.id, ...d.data() }));
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foreman-export-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Sign out
  document.getElementById('signout-btn').addEventListener('click', () => {
    if (confirm('Sign out?')) {
      auth.signOut();
      document.getElementById('settings-modal').classList.add('hidden');
    }
  });
}
