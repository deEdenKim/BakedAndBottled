const LABELS = ['€ 0.10', '€ 0.20', '€ 0.50', '€ 1.00', '€ 2.00', '€ 5', '€ 10', '€ 20', '€ 50'];
let history = JSON.parse(localStorage.getItem('cashHistory') || '[]');

// Init
renderHistory();
updateBadge();

function getInputs() {
  return document.querySelectorAll('input[data-val]');
}

function liveCalc() {
  let total = 0;
  getInputs().forEach((inp, i) => {
    const c = parseInt(inp.value) || 0;
    const v = parseFloat(inp.dataset.val);
    const s = Math.round(c * v * 100) / 100;
    total += s;
    const el = document.getElementById('s' + i);
    if (c > 0) {
      el.textContent = '€ ' + s.toFixed(2);
      el.classList.remove('empty');
    } else {
      el.textContent = '—';
      el.classList.add('empty');
    }
  });
  document.getElementById('total').textContent = '€ ' + (Math.round(total * 100) / 100).toFixed(2);
}

function saveEntry() {
  const inputs = getInputs();
  let total = 0;
  const items = [];

  inputs.forEach((inp, i) => {
    const c = parseInt(inp.value) || 0;
    if (c > 0) {
      const v = parseFloat(inp.dataset.val);
      const s = Math.round(c * v * 100) / 100;
      total += s;
      items.push({ label: LABELS[i], count: c, sub: s });
    }
  });

  if (items.length === 0) return;

  const now = new Date();
  const date = now.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });

  history.unshift({
    id: Date.now(),
    date,
    time,
    items,
    total: Math.round(total * 100) / 100
  });

  persist();
  renderHistory();
  updateBadge();

  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Saved!';
  setTimeout(() => { btn.textContent = 'Save to history'; }, 1200);
}

function deleteEntry(id) {
  history = history.filter(h => h.id !== id);
  persist();
  renderHistory();
  updateBadge();
}

function renderHistory() {
  const el = document.getElementById('hist-body');
  document.getElementById('hist-count').textContent =
    history.length + ' ' + (history.length === 1 ? 'entry' : 'entries');

  if (history.length === 0) {
    el.innerHTML = '<div class="hist-empty">No entries yet.<br>Save a calculation from the Calculator tab.</div>';
    return;
  }

  el.innerHTML = history.map(h => `
    <div class="hist-item">
      <div class="hist-meta">
        <div class="hist-datetime">
          <div class="date">${h.date}</div>
          <div class="time">${h.time}</div>
        </div>
        <div class="hist-right">
          <span class="hist-total">€ ${h.total.toFixed(2)}</span>
          <button class="btn-del" onclick="deleteEntry(${h.id})" title="Delete">✕</button>
        </div>
      </div>
      <div class="hist-breakdown">
        ${h.items.map(it => `<span class="pill">${it.label} × ${it.count} = € ${it.sub.toFixed(2)}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function updateBadge() {
  const btn = document.getElementById('hist-tab-btn');
  btn.textContent = history.length > 0 ? `History (${history.length})` : 'History';
}

function clearAll() {
  getInputs().forEach((inp, i) => {
    inp.value = '';
    const el = document.getElementById('s' + i);
    el.textContent = '—';
    el.classList.add('empty');
  });
  document.getElementById('total').textContent = '€ 0.00';
}

function clearHistory() {
  if (!history.length) return;
  if (!confirm('Clear all history entries?')) return;
  history = [];
  persist();
  renderHistory();
  updateBadge();
}

function showTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('page-calc').style.display = name === 'calc' ? 'block' : 'none';
  document.getElementById('page-hist').style.display = name === 'hist' ? 'block' : 'none';
}

function persist() {
  try {
    localStorage.setItem('cashHistory', JSON.stringify(history));
  } catch (e) {
    console.warn('localStorage unavailable:', e);
  }
}
