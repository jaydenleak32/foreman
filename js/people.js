// === PEOPLE & PLACES TAB ===

const PEOPLE_STATUSES = ['Family', 'Friend', 'Ward', 'Mission contact', 'Dairy contact', 'Mentor', 'Other'];
let peopleView = 'all';

async function renderPeople() {
  const snap = await userCollection('people').orderBy('name').get();
  const people = [];
  snap.forEach(d => people.push({ id: d.id, ...d.data() }));

  const filtered = peopleView === 'places'
    ? people.filter(p => p.address)
    : people;

  tabContent.innerHTML = `
    <div class="fade-in">
      <div class="toggle-group" style="margin-bottom:12px;">
        <button class="${peopleView === 'all' ? 'active' : ''}" data-view="all">All People</button>
        <button class="${peopleView === 'places' ? 'active' : ''}" data-view="places">Places Only</button>
      </div>

      <button class="btn-primary" id="add-person-btn" style="margin-bottom:16px;">+ Add Person / Place</button>

      ${filtered.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">No people yet. Add someone!</div>' :
        filtered.map(p => `
          <div class="person-card" data-person-id="${p.id}">
            <div class="person-name">${escapeHtml(p.name)}</div>
            <div class="person-status">${escapeHtml(p.status || 'Other')}</div>
            ${p.address ? `
              <div class="person-address">${escapeHtml(p.address)}</div>
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}" target="_blank" rel="noopener" class="map-link">📍 View on Map</a>
            ` : ''}
            ${p.notes ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;">${escapeHtml(p.notes)}</div>` : ''}
          </div>
        `).join('')}
    </div>
  `;

  // View toggle
  tabContent.querySelectorAll('.toggle-group button').forEach(btn => {
    btn.addEventListener('click', () => {
      peopleView = btn.dataset.view;
      renderPeople();
    });
  });

  // Add person
  document.getElementById('add-person-btn').addEventListener('click', () => showPersonModal());

  // Edit person
  tabContent.querySelectorAll('.person-card').forEach(card => {
    card.addEventListener('click', () => {
      const person = people.find(p => p.id === card.dataset.personId);
      if (person) showPersonModal(person);
    });
  });
}

function showPersonModal(person) {
  const isEdit = !!person;
  const modal = document.getElementById('settings-modal');
  const body = document.getElementById('settings-body');
  document.querySelector('#settings-modal .modal-header h2').textContent = isEdit ? 'Edit Person' : 'Add Person';

  body.innerHTML = `
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="person-name" value="${isEdit ? escapeHtml(person.name) : ''}">
    </div>
    <div class="form-group">
      <label>Status</label>
      <select id="person-status">
        ${PEOPLE_STATUSES.map(s => `<option value="${s}" ${isEdit && person.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Address (optional)</label>
      <input type="text" id="person-address" value="${isEdit ? escapeHtml(person.address || '') : ''}">
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="person-notes">${isEdit ? escapeHtml(person.notes || '') : ''}</textarea>
    </div>
    <button class="btn-primary" id="person-save" style="margin-bottom:8px;">Save</button>
    ${isEdit ? '<button class="btn-primary btn-danger" id="person-delete">Delete</button>' : ''}
  `;

  modal.classList.remove('hidden');

  document.getElementById('person-save').addEventListener('click', async () => {
    const data = {
      name: document.getElementById('person-name').value.trim(),
      status: document.getElementById('person-status').value,
      address: document.getElementById('person-address').value.trim(),
      notes: document.getElementById('person-notes').value.trim()
    };
    if (!data.name) return;
    if (isEdit) {
      await userCollection('people').doc(person.id).update(data);
    } else {
      await userCollection('people').add(data);
    }
    modal.classList.add('hidden');
    renderPeople();
  });

  if (isEdit) {
    document.getElementById('person-delete').addEventListener('click', async () => {
      if (settings.confirmBeforeDelete && !confirm('Delete ' + person.name + '?')) return;
      const data = { ...person };
      delete data.id;
      await userCollection('people').doc(person.id).delete();
      showUndo('Person deleted', async () => {
        await userCollection('people').add(data);
        renderPeople();
      });
      modal.classList.add('hidden');
      renderPeople();
    });
  }
}
