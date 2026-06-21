// === INBOX & ACTIONS TAB ===

const GTD_CONTEXTS = ['@Dairy', '@Laptop', '@Phone', '@Errands', '@Home', '@Fitness', '@Anywhere'];
let inboxFilter = 'inbox';
let contextFilter = 'all';
let _inboxCache = null;

const DEFAULT_PROJECTS = [
  { title: 'Finish business degree', group: 'Ranch Manager', nextAction: '' },
  { title: 'Master cattle reproduction & dairy skills', group: 'Ranch Manager', nextAction: '' },
  { title: 'Build management experience & reputation', group: 'Ranch Manager', nextAction: '' },
  { title: 'Physical fitness', group: 'Ranch Manager', nextAction: '' },
  { title: 'Financial readiness for ranch investment', group: 'Ranch Manager', nextAction: '' },
];

async function renderInbox(useCache) {
  let inboxItems, activeActions, waiting, someday, projects;

  if (useCache && _inboxCache) {
    ({ inboxItems, activeActions, waiting, someday, projects } = _inboxCache);
  } else {
    const [inboxSnap, actionsSnap, waitingSnap, somedaySnap, projectsSnap] = await Promise.all([
      userCollection('inbox').orderBy('createdAt', 'desc').get(),
      userCollection('actions').orderBy('createdAt', 'desc').get(),
      userCollection('waiting').orderBy('createdAt', 'desc').get(),
      userCollection('someday').orderBy('createdAt', 'desc').get(),
      userCollection('projects').orderBy('order').get()
    ]);

    inboxItems = [];
    inboxSnap.forEach(d => inboxItems.push({ id: d.id, ...d.data() }));
    const actions = [];
    actionsSnap.forEach(d => actions.push({ id: d.id, ...d.data() }));
    activeActions = actions.filter(a => !a.completed);
    waiting = [];
    waitingSnap.forEach(d => waiting.push({ id: d.id, ...d.data() }));
    someday = [];
    somedaySnap.forEach(d => someday.push({ id: d.id, ...d.data() }));
    projects = [];
    projectsSnap.forEach(d => projects.push({ id: d.id, ...d.data() }));

    if (projects.length === 0) {
      for (let i = 0; i < DEFAULT_PROJECTS.length; i++) {
        await userCollection('projects').add({ ...DEFAULT_PROJECTS[i], order: i });
      }
      const ps = await userCollection('projects').orderBy('order').get();
      projects = [];
      ps.forEach(d => projects.push({ id: d.id, ...d.data() }));
    }

    _inboxCache = { inboxItems, activeActions, waiting, someday, projects };
  }

  // Update badge
  const badge = document.getElementById('inbox-badge');
  if (inboxItems.length > 0) {
    badge.textContent = inboxItems.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  const filteredActions = contextFilter === 'all'
    ? activeActions
    : activeActions.filter(a => a.context === contextFilter);

  tabContent.innerHTML = `
    <div class="fade-in">
      <div class="quick-add">
        <input type="text" id="inbox-input" placeholder="Capture anything...">
        <button class="btn-sm" id="inbox-add-btn">+</button>
      </div>

      <div class="toggle-group" style="margin-bottom:12px;">
        <button class="${inboxFilter === 'inbox' ? 'active' : ''}" data-filter="inbox">Inbox (${inboxItems.length})</button>
        <button class="${inboxFilter === 'actions' ? 'active' : ''}" data-filter="actions">Actions</button>
        <button class="${inboxFilter === 'projects' ? 'active' : ''}" data-filter="projects">Projects</button>
        <button class="${inboxFilter === 'lists' ? 'active' : ''}" data-filter="lists">Lists</button>
      </div>

      ${inboxFilter === 'inbox' ? renderInboxSection(inboxItems) : ''}
      ${inboxFilter === 'actions' ? renderActionsSection(filteredActions) : ''}
      ${inboxFilter === 'projects' ? renderProjectsSection(projects) : ''}
      ${inboxFilter === 'lists' ? renderListsSection(waiting, someday) : ''}
    </div>
  `;

  // Quick add
  const inboxInput = document.getElementById('inbox-input');
  document.getElementById('inbox-add-btn').addEventListener('click', () => addToInbox(inboxInput));
  inboxInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addToInbox(inboxInput); });

  // Filter toggle — use cache, no Firestore re-read
  tabContent.querySelectorAll('.toggle-group button').forEach(btn => {
    btn.addEventListener('click', () => {
      inboxFilter = btn.dataset.filter;
      renderInbox(true);
    });
  });

  // Context filter chips — use cache
  tabContent.querySelectorAll('.chip[data-context]').forEach(chip => {
    chip.addEventListener('click', () => {
      contextFilter = chip.dataset.context;
      renderInbox(true);
    });
  });

  // Process buttons
  tabContent.querySelectorAll('[data-process]').forEach(btn => {
    btn.addEventListener('click', () => processInboxItem(btn.dataset.process, btn.dataset.id, btn.dataset.text));
  });

  // Complete/delete actions
  tabContent.querySelectorAll('[data-complete-action]').forEach(el => {
    el.addEventListener('click', async () => {
      await userCollection('actions').doc(el.dataset.completeAction).update({ completed: true });
      renderInbox();
    });
  });

  tabContent.querySelectorAll('[data-delete-action]').forEach(el => {
    el.addEventListener('click', async () => {
      if (settings.confirmBeforeDelete && !confirm('Delete this action?')) return;
      const doc = await userCollection('actions').doc(el.dataset.deleteAction).get();
      const data = doc.data();
      await userCollection('actions').doc(el.dataset.deleteAction).delete();
      showUndo('Action deleted', async () => {
        await userCollection('actions').add(data);
        renderInbox();
      });
      renderInbox();
    });
  });

  // Swipe on action items
  tabContent.querySelectorAll('.swipe-container[data-action-id]').forEach(el => {
    setupSwipe(el,
      () => { userCollection('actions').doc(el.dataset.actionId).update({ completed: true }); renderInbox(); },
      async () => {
        if (settings.confirmBeforeDelete && !confirm('Delete?')) return;
        await userCollection('actions').doc(el.dataset.actionId).delete();
        renderInbox();
      }
    );
  });

  // Project next action — save on change, Enter creates an actual action
  tabContent.querySelectorAll('.project-next-input').forEach(input => {
    input.addEventListener('change', () => {
      userCollection('projects').doc(input.dataset.projectId).update({ nextAction: input.value });
    });
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        const text = input.value.trim();
        const context = prompt(`Context for "${text}"?\n\n${GTD_CONTEXTS.join(', ')}`) || '@Anywhere';
        await userCollection('actions').add({
          text,
          context: GTD_CONTEXTS.includes(context) ? context : '@Anywhere',
          completed: false,
          projectId: input.dataset.projectId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = '';
        await userCollection('projects').doc(input.dataset.projectId).update({ nextAction: '' });
        renderInbox();
      }
    });
  });

  // Waiting/someday delete
  tabContent.querySelectorAll('[data-delete-waiting]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await userCollection('waiting').doc(btn.dataset.deleteWaiting).delete();
      renderInbox();
    });
  });
  tabContent.querySelectorAll('[data-delete-someday]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await userCollection('someday').doc(btn.dataset.deleteSomeday).delete();
      renderInbox();
    });
  });
}

async function addToInbox(input) {
  const text = input.value.trim();
  if (!text) return;
  await userCollection('inbox').add({ text, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  input.value = '';
  _inboxCache = null;
  renderInbox();
}

function renderInboxSection(items) {
  if (items.length === 0) return '<div style="text-align:center;color:var(--text-muted);padding:40px 0;">Inbox zero! 🎯</div>';
  return items.map(item => `
    <div class="inbox-item">
      <div class="inbox-item-text">${escapeHtml(item.text)}</div>
      <div class="inbox-actions">
        <button data-process="action" data-id="${item.id}" data-text="${escapeHtml(item.text)}">→ Action</button>
        <button data-process="project" data-id="${item.id}" data-text="${escapeHtml(item.text)}">→ Project</button>
        <button data-process="waiting" data-id="${item.id}" data-text="${escapeHtml(item.text)}">→ Waiting</button>
        <button data-process="someday" data-id="${item.id}" data-text="${escapeHtml(item.text)}">→ Someday</button>
        <button data-process="trash" data-id="${item.id}" data-text="${escapeHtml(item.text)}">🗑</button>
      </div>
    </div>
  `).join('');
}

function renderActionsSection(actions) {
  return `
    <div class="context-chips">
      <span class="chip ${contextFilter === 'all' ? 'active' : ''}" data-context="all">All</span>
      ${GTD_CONTEXTS.map(c => `<span class="chip ${contextFilter === c ? 'active' : ''}" data-context="${c}">${c}</span>`).join('')}
    </div>
    ${actions.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px;">No actions in this context</div>' :
      actions.map(a => `
        <div class="swipe-container" data-action-id="${a.id}">
          <div class="swipe-bg swipe-bg-right">✓ Done</div>
          <div class="swipe-bg swipe-bg-left">Delete</div>
          <div class="swipe-item action-item">
            <div class="custom-check" data-complete-action="${a.id}"></div>
            <span style="flex:1">${escapeHtml(a.text)}</span>
            <span class="action-context-tag">${a.context || '@Anywhere'}</span>
          </div>
        </div>
      `).join('')}
  `;
}

function renderProjectsSection(projects) {
  return `
    <div class="section-title" style="margin-top:0;">Ranch Manager Pipeline</div>
    ${projects.map(p => `
      <div class="project-card">
        <div class="project-title">${escapeHtml(p.title)}</div>
        <div class="project-next-action">
          <input type="text" class="project-next-input" data-project-id="${p.id}" value="${escapeHtml(p.nextAction || '')}" placeholder="Type next action, press Enter to create it...">
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">↵ Enter = create as action</div>
      </div>
    `).join('')}
    <button class="btn-secondary" id="add-project-btn" style="margin-top:8px;">+ Add Project</button>
  `;
}

function renderListsSection(waiting, someday) {
  return `
    <div class="section-title" style="margin-top:0;">Waiting For</div>
    ${waiting.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Nothing pending</div>' :
      waiting.map(w => `
        <div class="waiting-item">
          <span>${escapeHtml(w.text)}</span>
          <button class="btn-text" style="font-size:0.7rem;" data-delete-waiting="${w.id}">✕</button>
        </div>
      `).join('')}

    <div class="section-title">Someday / Maybe</div>
    ${someday.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Nothing stashed</div>' :
      someday.map(s => `
        <div class="someday-item">
          <span>${escapeHtml(s.text)}</span>
          <button class="btn-text" style="font-size:0.7rem;" data-delete-someday="${s.id}">✕</button>
        </div>
      `).join('')}
  `;
}

async function processInboxItem(type, id, text) {
  if (type === 'action') {
    const context = prompt(`Context for "${text}"?\n\nOptions: ${GTD_CONTEXTS.join(', ')}`) || '@Anywhere';
    await userCollection('actions').add({
      text,
      context: GTD_CONTEXTS.includes(context) ? context : '@Anywhere',
      completed: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else if (type === 'project') {
    const snap = await userCollection('projects').get();
    await userCollection('projects').add({
      title: text,
      group: 'Custom',
      nextAction: '',
      order: snap.size
    });
  } else if (type === 'waiting') {
    const who = prompt('Waiting on who?') || '';
    await userCollection('waiting').add({
      text: `${text}${who ? ' (from ' + who + ')' : ''}`,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else if (type === 'someday') {
    await userCollection('someday').add({
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  if (type !== 'trash') {
    // Keep the inbox item data for undo
  }
  await userCollection('inbox').doc(id).delete();
  _inboxCache = null;
  renderInbox();
}
