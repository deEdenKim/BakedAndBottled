const SUPABASE_URL = 'https://xxzljsnsgfjjfrtkrxlp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IqmOoKKK7I2EmHlmqLqv2w_RVGbvW6A';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY
};

const LABELS = ['€ 0.10', '€ 0.20', '€ 0.50', '€ 1.00', '€ 2.00', '€ 5', '€ 10', '€ 20', '€ 50'];

// Init
loadHistory();

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

async function saveEntry() {
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
  const id = Date.now();

  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Saving...';

  const res = await fetch(`${SUPABASE_URL}/rest/v1/history`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id,
      date,
      time,
      total: Math.round(total * 100) / 100,
      breakdown: JSON.stringify(items)
    })
  });

  if (res.ok) {
    btn.textContent = 'Saved!';
    await loadHistory();
  } else {
    btn.textContent = 'Error — try again';
  }

  setTimeout(() => { btn.textContent = 'Save to history'; }, 1400);
}

async function deleteEntry(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/history?id=eq.${id}`, {
    method: 'DELETE',
    headers
  });
  await loadHistory();
}

async function loadHistory() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/history?order=id.desc`, {
    headers
  });
  const data = await res.json();
  renderHistory(data);
  updateBadge(data.length);
}

function renderHistory(data) {
  const el = document.getElementById('hist-body');
  document.getElementById('hist-count').textContent =
    data.length + ' ' + (data.length === 1 ? 'entry' : 'entries');

  if (data.length === 0) {
    el.innerHTML = '<div class="hist-empty">No entries yet.<br>Save a calculation from the Calculator tab.</div>';
    return;
  }

  el.innerHTML = data.map(h => {
    const items = JSON.parse(h.breakdown || '[]');
    return `
      <div class="hist-item">
        <div class="hist-meta">
          <div class="hist-datetime">
            <div class="date">${h.date}</div>
            <div class="time">${h.time}</div>
          </div>
          <div class="hist-right">
            <span class="hist-total">€ ${parseFloat(h.total).toFixed(2)}</span>
            <button class="btn-del" onclick="deleteEntry(${h.id})" title="Delete">✕</button>
          </div>
        </div>
        <div class="hist-breakdown">
          ${items.map(it => `<span class="pill">${it.label} × ${it.count} = € ${it.sub.toFixed(2)}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function updateBadge(count) {
  const btn = document.getElementById('hist-tab-btn');
  btn.textContent = count > 0 ? `History (${count})` : 'History';
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

async function clearHistory() {
  const countEl = document.getElementById('hist-count');
  if (countEl.textContent === '0 entries') return;
  if (!confirm('Clear all history entries?')) return;

  await fetch(`${SUPABASE_URL}/rest/v1/history?id=gt.0`, {
    method: 'DELETE',
    headers
  });
  await loadHistory();
}

function showTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('page-calc').style.display = name === 'calc' ? 'block' : 'none';
  document.getElementById('page-hist').style.display = name === 'hist' ? 'block' : 'none';
  if (name === 'hist') loadHistory();
}
