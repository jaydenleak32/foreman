// === BUDGET TAB ===

let budgetPeriod = 'week';
let _budgetCache = null;

async function renderBudget(useCache) {
  if (!useCache) _budgetCache = null;
  let allEntries, goal;

  if (_budgetCache) {
    ({ allEntries, goal } = _budgetCache);
  } else {
    const [entriesSnap, goalDoc] = await Promise.all([
      userCollection('budgetEntries').orderBy('date', 'desc').get(),
      userDoc('budgetGoal').get()
    ]);
    allEntries = [];
    entriesSnap.forEach(d => allEntries.push({ id: d.id, ...d.data() }));
    goal = goalDoc.exists ? goalDoc.data() : { target: 50000, label: 'Ranch Fund' };
    _budgetCache = { allEntries, goal };
  }

  const now = new Date();
  const filtered = filterByPeriod(allEntries, budgetPeriod, now);

  let income = 0, tithing = 0, expenses = 0, savedExplicit = 0, spent = 0;
  for (const e of filtered) {
    const amt = e.amount || 0;
    if (e.type === 'income') income += amt;
    if (e.type === 'expense') {
      expenses += amt;
      if (e.category === 'Tithing') tithing += amt;
      else if (e.category === 'Savings') savedExplicit += amt;
      else spent += amt;
    }
  }

  // Auto-calculate: available = income - tithing - spending - explicit savings
  const available = income - tithing - spent - savedExplicit;

  const tithePct = income > 0 ? ((tithing / income) * 100).toFixed(1) : 0;

  const totalSaved = allEntries.filter(e => e.category === 'Savings').reduce((s, e) => s + (e.amount || 0), 0);
  const goalPct = goal.target > 0 ? Math.min(100, (totalSaved / goal.target) * 100) : 0;

  // 8-week chart data
  const chartData = buildChartData(allEntries, 8);

  tabContent.innerHTML = `
    <div class="fade-in">
      <div class="toggle-group" style="margin-bottom:12px;">
        <button class="${budgetPeriod === 'week' ? 'active' : ''}" data-period="week">Week</button>
        <button class="${budgetPeriod === 'month' ? 'active' : ''}" data-period="month">Month</button>
        <button class="${budgetPeriod === 'year' ? 'active' : ''}" data-period="year">Year</button>
      </div>

      <!-- Available money — the big number -->
      <div class="card" style="text-align:center;padding:20px;">
        <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text-secondary);">Available to Spend</div>
        <div style="font-size:2.2rem;font-weight:700;color:${available >= 0 ? 'var(--success)' : 'var(--danger)'};">$${Math.abs(available).toFixed(2)}</div>
        ${available < 0 ? '<div style="font-size:0.75rem;color:var(--danger);">⚠ Over budget</div>' : ''}
      </div>

      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-card-label">Income</div>
          <div class="summary-card-value income">$${income.toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Tithing</div>
          <div class="summary-card-value">$${tithing.toFixed(2)}</div>
          ${parseFloat(tithePct) < 10 && income > 0 ? `<div class="tithe-flag">⚠ ${tithePct}%</div>` : income > 0 ? `<div style="font-size:0.65rem;color:var(--success);">✓ ${tithePct}%</div>` : ''}
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Spent</div>
          <div class="summary-card-value expense">$${spent.toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-card-label">Saved</div>
          <div class="summary-card-value saved">$${savedExplicit.toFixed(2)}</div>
        </div>
      </div>

      <div class="card" style="font-size:0.8rem;color:var(--text-secondary);padding:10px 14px;">
        💡 <strong>$${income.toFixed(2)}</strong> earned
        − <strong>$${tithing.toFixed(2)}</strong> tithing
        − <strong>$${spent.toFixed(2)}</strong> spent
        − <strong>$${savedExplicit.toFixed(2)}</strong> saved
        = <strong style="color:${available >= 0 ? 'var(--success)' : 'var(--danger)'}">$${available.toFixed(2)}</strong> left
      </div>

      <div class="card savings-goal">
        <div class="card-title">${escapeHtml(goal.label)}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${goalPct}%"></div>
        </div>
        <div class="progress-label">
          <span>$${totalSaved.toLocaleString()}</span>
          <span>$${goal.target.toLocaleString()}</span>
        </div>
      </div>

      <div class="chart-container">
        <div class="card-title">Income vs Expenses (8 Weeks)</div>
        <div class="bar-chart">
          ${chartData.map(w => {
            const maxVal = Math.max(...chartData.map(c => Math.max(c.income, c.expenses)), 1);
            const iH = (w.income / maxVal) * 100;
            const eH = (w.expenses / maxVal) * 100;
            return `
              <div class="bar-group">
                <div class="bar-pair">
                  <div class="bar income-bar" style="height:${iH}%"></div>
                  <div class="bar expense-bar" style="height:${eH}%"></div>
                </div>
                <div class="bar-label">${w.label}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="chart-legend">
          <span><span class="legend-dot" style="background:var(--success)"></span>Income</span>
          <span><span class="legend-dot" style="background:var(--danger)"></span>Expenses</span>
        </div>
      </div>

      <div class="section-title">Quick Add</div>
      <button class="btn-secondary" id="paycheck-btn" style="margin-bottom:8px;width:100%;">💰 Add ${escapeHtml(settings.jobTitle || 'Work')} Paycheck</button>
      <button class="btn-secondary" id="tithe-btn" style="margin-bottom:12px;width:100%;">🙏 Add Tithing</button>

      <div class="card budget-entry-form">
        <div class="card-title">Manual Entry</div>
        <div class="form-group">
          <label>Type</label>
          <div class="toggle-group">
            <button class="active" data-entry-type="expense" id="entry-type-expense">Expense</button>
            <button data-entry-type="income" id="entry-type-income">Income</button>
          </div>
        </div>
        <div class="form-group">
          <label>Amount ($)</label>
          <input type="number" id="entry-amount" step="0.01" placeholder="0.00" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="entry-category">
            <option>Food</option>
            <option>Gas/Transport</option>
            <option>School</option>
            <option>Savings</option>
            <option>Tithing</option>
            <option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <input type="text" id="entry-desc" placeholder="What for?">
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="entry-date" value="${todayKey()}">
        </div>
        <button class="btn-primary" id="entry-submit">Add Entry</button>
      </div>

      <div class="section-title">Recent Entries</div>
      ${filtered.slice(0, 20).map(e => `
        <div class="entry-list-item">
          <div>
            <div>${escapeHtml(e.description || e.category || '')}</div>
            <div class="entry-category">${escapeHtml(e.category || '')} · <span class="entry-date">${e.date}</span></div>
          </div>
          <div>
            <span class="entry-amount ${e.type}">${e.type === 'income' ? '+' : '-'}$${(e.amount || 0).toFixed(2)}</span>
            <button class="btn-text" style="font-size:0.7rem;margin-left:4px;" data-delete-entry="${e.id}">✕</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Period toggle — use cache, no Firestore re-read
  tabContent.querySelectorAll('.toggle-group button[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      budgetPeriod = btn.dataset.period;
      renderBudget(true);
    });
  });

  // Entry type toggle
  let entryType = 'expense';
  tabContent.querySelectorAll('[data-entry-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      entryType = btn.dataset.entryType;
      tabContent.querySelectorAll('[data-entry-type]').forEach(b => b.classList.toggle('active', b.dataset.entryType === entryType));
    });
  });

  // Submit entry
  document.getElementById('entry-submit').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('entry-amount').value);
    if (!amount || amount <= 0) return;
    await userCollection('budgetEntries').add({
      type: entryType,
      amount,
      category: document.getElementById('entry-category').value,
      description: document.getElementById('entry-desc').value.trim(),
      date: document.getElementById('entry-date').value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    renderBudget();
  });

  // Paycheck quick-add
  document.getElementById('paycheck-btn').addEventListener('click', async () => {
    const jobName = settings.jobTitle || 'Work';
    const amount = prompt('Paycheck amount ($):');
    if (!amount || isNaN(parseFloat(amount))) return;
    await userCollection('budgetEntries').add({
      type: 'income',
      amount: parseFloat(amount),
      category: jobName + ' Paycheck',
      description: jobName + ' paycheck',
      date: todayKey(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    renderBudget();
  });

  // Tithing quick-add
  document.getElementById('tithe-btn').addEventListener('click', async () => {
    const lastIncome = filtered.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
    const suggestedTithe = (lastIncome * 0.1).toFixed(2);
    const amount = prompt(`Tithing amount ($):\n\n10% of period income = $${suggestedTithe}`);
    if (!amount || isNaN(parseFloat(amount))) return;
    await userCollection('budgetEntries').add({
      type: 'expense',
      amount: parseFloat(amount),
      category: 'Tithing',
      description: 'Tithing',
      date: todayKey(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    renderBudget();
  });

  // Delete entries
  tabContent.querySelectorAll('[data-delete-entry]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (settings.confirmBeforeDelete && !confirm('Delete this entry?')) return;
      const doc = await userCollection('budgetEntries').doc(btn.dataset.deleteEntry).get();
      const data = doc.data();
      await userCollection('budgetEntries').doc(btn.dataset.deleteEntry).delete();
      showUndo('Entry deleted', async () => {
        await userCollection('budgetEntries').add(data);
        renderBudget();
      });
      renderBudget();
    });
  });
}

function filterByPeriod(entries, period, now) {
  const start = new Date(now);
  if (period === 'week') {
    const day = start.getDay();
    const diff = settings.weekStartsMonday ? (day === 0 ? -6 : 1 - day) : -day;
    start.setDate(start.getDate() + diff);
  } else if (period === 'month') {
    start.setDate(1);
  } else {
    start.setMonth(0, 1);
  }
  start.setHours(0, 0, 0, 0);
  const startKey = dateKey(start);
  return entries.filter(e => e.date >= startKey);
}

function buildChartData(entries, weeks) {
  const now = new Date();
  const buckets = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const ws = new Date(now);
    ws.setDate(ws.getDate() - (w * 7));
    const day = ws.getDay();
    const diff = settings.weekStartsMonday ? (day === 0 ? -6 : 1 - day) : -day;
    ws.setDate(ws.getDate() + diff);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    buckets.push({
      startKey: dateKey(ws),
      endKey: dateKey(we),
      label: (ws.getMonth() + 1) + '/' + ws.getDate(),
      income: 0,
      expenses: 0
    });
  }
  for (const e of entries) {
    if (!e.date) continue;
    for (const b of buckets) {
      if (e.date >= b.startKey && e.date <= b.endKey) {
        if (e.type === 'income') b.income += e.amount || 0;
        else if (e.type === 'expense') b.expenses += e.amount || 0;
        break;
      }
    }
  }
  return buckets;
}
