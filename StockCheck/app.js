// ── Supabase config ──────────────────────────────────────────
// ⚠️  Move these to a .env file and use a build tool if making this public
const SUPABASE_URL  = 'https://xxzljsnsgfjjfrtkrxlp.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_hjQm7m38FUJA0lYCfLhkLA_pYM9-_8e';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Item definitions ──────────────────────────────────────────
// types:
//   bulk     → loose bags, count in bags
//   handful  → grabbed in handfuls from box, count in handfuls
//   box      → full box unit
//   unit     → stored in boxes in warehouse, counted per piece on floor

const CATEGORIES = [
  {
    cat: 'Bulk bags',
    type: 'bulk',
    whLabel: 'bags',
    floorLabel: 'bags',
    items: [
      'Pastry paper bag (B)',
      'Pastry paper bag (S)',
      'Hand carrier bag (B)',
      'Hand carrier bag (S)',
      '2 cups container',
      'Toilet paper',
    ],
  },
  {
    cat: 'Handful (from box)',
    type: 'handful',
    whLabel: 'handfuls',
    floorLabel: 'handfuls',
    items: ['Baguette bag', 'Stirrer', 'Spoon', 'Sugar'],
  },
  {
    cat: 'Box',
    type: 'box',
    whLabel: 'boxes',
    floorLabel: 'boxes',
    items: [
      'Oat milk',
      'Coconut milk',
      'Soya milk',
      'Almond milk',
      'Coffee beans (1 box = 6ea)',
      'Breakfast tea',
      'Peppermint tea',
      'Camomile',
      'Earl Grey',
      'Straw',
    ],
  },
  {
    cat: 'Unit (box in warehouse → count on floor)',
    type: 'unit',
    whLabel: 'boxes',
    floorLabel: 'units',
    items: [
      '8oz Cup',
      '12oz Cup',
      '8oz Lid',
      '12oz Lid',
      'Ice cup',
      'Ice lid',
      'Sauce container',
      'Hot chocolate',
      'Matcha',
      'Decaf',
      'Marshmallow',
      'Cutleries napkin',
      'Napkin',
      'Toilet hand paper',
    ],
  },
];

const LOW_THRESHOLD = 3;

// ── State ────────────────────────────────────────────────────
let floor     = {};   // { [itemName]: { qty: number } }
let warehouse = {};   // { [itemName]: { qty: number, order: boolean } }
let activeTab = 'floor';
let isSaving  = false;

// ── Helpers ───────────────────────────────────────────────────
function allItems() {
  return CATEGORIES.flatMap(c => c.items);
}

function metaOf(item) {
  return CATEGORIES.find(c => c.items.includes(item));
}

function todayKey() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function eid(s)     { return s.replace(/[^a-zA-Z0-9]/g, '_'); }
function fromId(id) { return allItems().find(i => eid(i) === id) || id; }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  document.getElementById('date-sub').textContent = todayLabel();

  // Default state
  allItems().forEach(i => {
    floor[i]     = { qty: 0 };
    warehouse[i] = { qty: 5, order: false };
  });

  // Wire up tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  await loadFromSupabase();
  renderFloor();
  renderWarehouse();
}

// ── Supabase: load today's data ───────────────────────────────
async function loadFromSupabase() {
  const today = todayKey();
  const { data, error } = await sb
    .from('stock_entries')
    .select('*')
    .eq('entry_date', today);

  if (error) { console.error('Load error:', error); return; }

  data.forEach(row => {
    if (row.tab === 'floor') {
      floor[row.item_name] = { qty: row.quantity };
    } else if (row.tab === 'warehouse') {
      warehouse[row.item_name] = { qty: row.quantity, order: row.order_flag };
    }
  });
}

// ── Supabase: upsert a tab's data ────────────────────────────
async function saveTabToSupabase(tab) {
  if (isSaving) return;
  isSaving = true;

  const today = todayKey();
  const source = tab === 'floor' ? floor : warehouse;

  const rows = allItems().map(item => ({
    entry_date: today,
    tab,
    item_name:  item,
    quantity:   source[item]?.qty   ?? 0,
    order_flag: source[item]?.order ?? false,
  }));

  // Delete today's rows for this tab, then insert fresh
  const { error: delErr } = await sb
    .from('stock_entries')
    .delete()
    .eq('entry_date', today)
    .eq('tab', tab);

  if (delErr) {
    console.error('Delete error:', delErr);
    showToast('Save failed — check console');
    isSaving = false;
    return;
  }

  const { error: insErr } = await sb
    .from('stock_entries')
    .insert(rows);

  isSaving = false;

  if (insErr) {
    console.error('Insert error:', insErr);
    showToast('Save failed — check console');
  } else {
    showToast(tab === 'floor' ? 'Floor restock saved!' : 'Warehouse stock saved!');
  }
}

// ── Floor tab ─────────────────────────────────────────────────
function renderFloor() {
  const all  = allItems();
  const done = all.filter(i => floor[i]?.qty > 0).length;

  let h = `
    <div class="total-bar">
      <span class="total-label">RESTOCKED TODAY</span>
      <span class="total-val" id="floor-total">
        <span class="highlight">${done}</span> / ${all.length} items
      </span>
    </div>`;

  CATEGORIES.forEach(({ cat, type, floorLabel, items }) => {
    const tagCls = type === 'handful' ? 'tag-floor-handful' :
                   type === 'unit'    ? 'tag-floor-unit'    :
                   type === 'bulk'    ? 'tag-bulk'          : 'tag-box';
    h += `<div class="section-head">${cat.split('(')[0].trim().toUpperCase()}</div>`;
    items.forEach(item => {
      const qty = floor[item]?.qty ?? 0;
      const qcls = qty > 0 ? 'ok' : 'neutral';
      h += `
        <div class="item-row">
          <div class="item-info">
            <div class="item-name">${item}</div>
            <span class="item-tag ${tagCls}">${floorLabel}</span>
          </div>
          <div class="controls">
            <button class="qty-btn" onclick="chFloor('${eid(item)}',-1)" aria-label="decrease">−</button>
            <span class="qty-num ${qcls}" id="fq-${eid(item)}">${qty}</span>
            <button class="qty-btn" onclick="chFloor('${eid(item)}',1)" aria-label="increase">+</button>
          </div>
        </div>`;
    });
  });

  h += `
    <div class="action-row">
      <button class="btn-primary" onclick="saveTabToSupabase('floor')">Save to history</button>
      <button class="btn-secondary" onclick="clearFloor()">Clear</button>
    </div>`;

  document.getElementById('tab-floor').innerHTML = h;
}

function chFloor(id, delta) {
  const item = fromId(id);
  if (!floor[item]) floor[item] = { qty: 0 };
  floor[item].qty = Math.max(0, floor[item].qty + delta);

  const el = document.getElementById('fq-' + id);
  if (el) {
    el.textContent  = floor[item].qty;
    el.className    = 'qty-num ' + (floor[item].qty > 0 ? 'ok' : 'neutral');
  }
  updateFloorTotal();
}

function updateFloorTotal() {
  const all  = allItems();
  const done = all.filter(i => floor[i]?.qty > 0).length;
  const el = document.getElementById('floor-total');
  if (el) el.innerHTML = `<span class="highlight">${done}</span> / ${all.length} items`;
}

function clearFloor() {
  allItems().forEach(i => { floor[i] = { qty: 0 }; });
  renderFloor();
}

// ── Warehouse tab ─────────────────────────────────────────────
function renderWarehouse() {
  const all       = allItems();
  const needOrder = all.filter(i => warehouse[i]?.order || warehouse[i]?.qty <= LOW_THRESHOLD).length;

  let h = `
    <div class="total-bar">
      <span class="total-label">NEEDS ORDERING</span>
      <span class="total-val" id="wh-total">
        <span class="highlight">${needOrder}</span> / ${all.length} items
      </span>
    </div>`;

  CATEGORIES.forEach(({ cat, type, whLabel, items }) => {
    const tagCls     = type === 'handful' ? 'tag-handful' :
                       type === 'unit'    ? 'tag-unit'    :
                       type === 'bulk'    ? 'tag-bulk'    : 'tag-box';
    const whTagLabel = type === 'unit' ? 'boxes in warehouse' : whLabel;

    h += `<div class="section-head">${cat.split('(')[0].trim().toUpperCase()}</div>`;
    items.forEach(item => {
      const w    = warehouse[item] ?? { qty: 5, order: false };
      const isLow = w.qty <= LOW_THRESHOLD;
      const qcls  = isLow ? 'low' : 'ok';
      const obCls = w.order ? 'on' : 'off';
      const obTxt = w.order ? 'Order ✓' : 'Order?';

      h += `
        <div class="item-row">
          <div class="item-info">
            <div class="item-name">${item}</div>
            <span class="item-tag ${tagCls}">${whTagLabel}</span>
          </div>
          <div class="controls">
            <button class="qty-btn" onclick="chWH('${eid(item)}',-1)" aria-label="decrease">−</button>
            <span class="qty-num ${qcls}" id="wq-${eid(item)}">${w.qty}</span>
            <button class="qty-btn" onclick="chWH('${eid(item)}',1)" aria-label="increase">+</button>
            <button class="order-badge ${obCls}" id="ob-${eid(item)}" onclick="toggleOrder('${eid(item)}')">${obTxt}</button>
          </div>
        </div>`;
    });
  });

  h += `
    <div class="action-row">
      <button class="btn-primary" onclick="saveTabToSupabase('warehouse')">Save to history</button>
      <button class="btn-secondary" onclick="clearWH()">Clear</button>
    </div>`;

  document.getElementById('tab-warehouse').innerHTML = h;
}

function chWH(id, delta) {
  const item = fromId(id);
  if (!warehouse[item]) warehouse[item] = { qty: 0, order: false };
  warehouse[item].qty = Math.max(0, warehouse[item].qty + delta);

  const isLow = warehouse[item].qty <= LOW_THRESHOLD;
  const el = document.getElementById('wq-' + id);
  if (el) {
    el.textContent = warehouse[item].qty;
    el.className   = 'qty-num ' + (isLow ? 'low' : 'ok');
  }
  updateWHTotal();
}

function toggleOrder(id) {
  const item = fromId(id);
  if (!warehouse[item]) warehouse[item] = { qty: 0, order: false };
  warehouse[item].order = !warehouse[item].order;

  const ob = document.getElementById('ob-' + id);
  if (ob) {
    ob.className   = 'order-badge ' + (warehouse[item].order ? 'on' : 'off');
    ob.textContent = warehouse[item].order ? 'Order ✓' : 'Order?';
  }
  updateWHTotal();
}

function updateWHTotal() {
  const all       = allItems();
  const needOrder = all.filter(i => warehouse[i]?.order || warehouse[i]?.qty <= LOW_THRESHOLD).length;
  const el = document.getElementById('wh-total');
  if (el) el.innerHTML = `<span class="highlight">${needOrder}</span> / ${all.length} items`;
}

function clearWH() {
  allItems().forEach(i => { warehouse[i] = { qty: 5, order: false }; });
  renderWarehouse();
}

// ── History tab ───────────────────────────────────────────────
async function renderHistory() {
  const cont = document.getElementById('tab-history');
  cont.innerHTML = '<div class="loading">Loading history…</div>';

  const { data, error } = await sb
    .from('stock_entries')
    .select('entry_date, tab, item_name, quantity, order_flag')
    .order('entry_date', { ascending: false });

  if (error) {
    cont.innerHTML = '<div class="empty">Could not load history.</div>';
    return;
  }

  if (!data.length) {
    cont.innerHTML = '<div class="empty">No history yet.<br>Save today\'s stock to get started.</div>';
    return;
  }

  // Group by date
  const byDate = {};
  data.forEach(row => {
    if (!byDate[row.entry_date]) byDate[row.entry_date] = { floor: [], warehouse: [] };
    byDate[row.entry_date][row.tab].push(row);
  });

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 30);

  let h = '';
  dates.forEach(ds => {
    const [y, m, d] = ds.split('-');
    const label = new Date(+y, +m - 1, +d).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });

    const floorRows = byDate[ds].floor;
    const whRows    = byDate[ds].warehouse;

    const restocked = floorRows.filter(r => r.quantity > 0).length;
    const ordered   = whRows.filter(r => r.order_flag).map(r => r.item_name);
    const low       = whRows.filter(r => !r.order_flag && r.quantity <= LOW_THRESHOLD).map(r => r.item_name);

    const orderedStr = ordered.length
      ? `${ordered.slice(0, 4).join(', ')}${ordered.length > 4 ? ` +${ordered.length - 4} more` : ''}`
      : '';
    const lowStr = low.length
      ? `${low.slice(0, 4).join(', ')}${low.length > 4 ? ` +${low.length - 4} more` : ''}`
      : '';

    h += `
      <div class="history-entry">
        <div class="history-date">${label}</div>
        <div class="history-detail">
          ${restocked ? `✔ ${restocked} items restocked on floor<br>` : ''}
          ${orderedStr ? `<span class="order-tag">⚑ To order: ${orderedStr}</span><br>` : ''}
          ${lowStr     ? `<span class="order-tag">⚠ Low stock: ${lowStr}</span>` : ''}
          ${!restocked && !orderedStr && !lowStr ? 'No issues recorded.' : ''}
        </div>
      </div>`;
  });

  cont.innerHTML = h;
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  const tabs = ['floor', 'warehouse', 'history'];

  tabs.forEach(t => {
    const el = document.getElementById('tab-' + t);
    el.classList.toggle('hidden', t !== tab);
  });

  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', tabs[i] === tab);
  });

  if (tab === 'history') renderHistory();
}

// ── Start ─────────────────────────────────────────────────────
init();
