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

  // Export
  document.getElementById('export-data-btn').addEventListener('click', async () => {
    const collections = ['inbox', 'actions', 'projects', 'waiting', 'someday', 'people', 'budgetEntries', 'scheduleBlocks', 'routines'];
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
