import {
  catalogUrl,
  generateId,
  loadEvents,
  monthKey,
  monthUrl,
  formatMonthLabel,
  postEvent,
  postEvents,
  shiftMonth,
} from './logger.js';
import { catalogSeedEvents, monthSeedEvents } from './seed.js';
import {
  CAT_LABEL,
  formatPrice,
  highlight,
  loadCatalog,
  parseMoney,
  prettyName,
  wineCategory,
  wineHaystack,
} from '../scripts/catalog.js';

const state = {
  month: monthKey(),
  catalog: [],
  monthLog: [],
  producerId: null,
  wineId: null,
  showEmpty: false,
  source: 'server',
  list: [],
  pickerKey: '',
};

const timers = new Map();

const syncEl = document.getElementById('sync');
const boardEl = document.getElementById('board');
const producerNav = document.getElementById('producerNav');
const wineNav = document.getElementById('wineNav');
const monthLabel = document.getElementById('monthLabel');
const statsEl = document.getElementById('stats');
const producerList = document.getElementById('producerList');
const customerList = document.getElementById('customerList');
const showEmptyBtn = document.getElementById('showEmptyBtn');
const wineDialog = document.getElementById('wineDialog');
const customerDialog = document.getElementById('customerDialog');
const producerDialog = document.getElementById('producerDialog');

function setSync(status) {
  syncEl.className = `sync ${status}`;
  const titles = {
    syncing: 'Syncing to sheet-logger…',
    synced: 'Synced',
    local: 'Saved locally — sheet-logger unreachable',
    error: 'Sync error',
  };
  syncEl.title = titles[status] || status;
}

const BOTTLES_PER_CASE = 12;

function splitCases(value) {
  const bottles = Math.round((Number(value) || 0) * BOTTLES_PER_CASE);
  const negative = bottles < 0;
  const abs = Math.abs(bottles);
  return {
    bottles,
    cases: Math.floor(abs / BOTTLES_PER_CASE) * (negative ? -1 : 1),
    leftover: (abs % BOTTLES_PER_CASE) * (negative ? -1 : 1),
  };
}

function casesFromParts(cases, bottles) {
  return (Number(cases) || 0) + (Number(bottles) || 0) / BOTTLES_PER_CASE;
}

function qtyPhrase(value) {
  const { cases, leftover } = splitCases(value);
  const c = Math.abs(cases);
  const b = Math.abs(leftover);
  const bits = [];
  if (c) bits.push(`${c} ${c === 1 ? 'case' : 'cases'}`);
  if (b) bits.push(`${b} ${b === 1 ? 'bottle' : 'bottles'}`);
  if (!bits.length) return '0 bottles';
  if (bits.length === 2) return `${bits[0]} and ${bits[1]}`;
  return bits[0];
}

function renderUnit(kind, value, { editable = false, muted = false } = {}) {
  const isCase = kind === 'case';
  const word = isCase
    ? (Math.abs(value) === 1 ? 'case' : 'cases')
    : (Math.abs(value) === 1 ? 'bottle' : 'bottles');
  const icon = isCase ? 'icon-case' : 'icon-bottle';
  const text = String(Math.max(0, value) || 0);
  const num = editable
    ? `<span class="figure-value">
        <span class="figure-sizer" aria-hidden="true">${text}</span>
        <input class="figure-input" data-part="${isCase ? 'cases' : 'bottles'}" type="text" inputmode="numeric" pattern="[0-9]*" size="1" maxlength="3" value="${text}">
      </span>`
    : `<b class="figure-num">${text}</b>`;
  return `
    <div class="unit ${muted && !value ? 'is-zero' : ''}">
      <span class="${icon}" aria-hidden="true"></span>
      <div class="unit-copy">
        ${num}
        <span class="unit-word">${word}</span>
      </div>
    </div>
  `;
}

function renderFigure(value, { editable = false, pack = '', over = false } = {}) {
  const parts = splitCases(value);
  const cases = Math.abs(parts.cases);
  const leftover = Math.abs(parts.leftover);
  const showCases = cases > 0 || (editable && leftover === 0);
  const showBottles = leftover > 0 || (editable && cases === 0);
  return `
    <div class="figure-pack ${over ? 'is-over' : ''}" ${pack ? `data-pack="${pack}"` : ''}>
      ${showCases ? renderUnit('case', cases, { editable }) : ''}
      ${showBottles ? renderUnit('bottle', leftover, { editable, muted: true }) : ''}
    </div>
  `;
}

function compactQty(value) {
  const { cases, leftover } = splitCases(value);
  const c = Math.abs(cases);
  const b = Math.abs(leftover);
  if (!c && !b) {
    return `
      <span class="qty-line">
        <span class="icon-case" aria-hidden="true"></span>0
      </span>
    `;
  }
  return `
    <span class="qty-line">
      ${c ? `<span class="icon-case" aria-hidden="true"></span>${c}` : ''}
      ${b ? `<span class="icon-bottle" aria-hidden="true"></span>${b}` : ''}
    </span>
  `;
}

function packFrom(el) {
  const cases = el.querySelector('[data-part="cases"]')?.value;
  const bottles = el.querySelector('[data-part="bottles"]')?.value;
  return casesFromParts(cases, bottles);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replayCatalog(changelog) {
  const producers = new Map();
  const customers = new Map();
  const wines = new Map();
  const producerOrder = [];
  const customerOrder = [];
  const wineOrder = [];

  [...changelog].sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || ''))).forEach((event) => {
    if (event.op === 'producer_added' && event.id) {
      producers.set(event.id, {
        id: event.id,
        name: event.name || '',
        color: event.color || '#7a2436',
        region: event.region || '',
      });
      if (!producerOrder.includes(event.id)) producerOrder.push(event.id);
    } else if (event.op === 'producer_updated' && producers.has(event.id)) {
      Object.assign(producers.get(event.id), {
        name: event.name ?? producers.get(event.id).name,
        color: event.color ?? producers.get(event.id).color,
        region: event.region ?? producers.get(event.id).region,
      });
    } else if (event.op === 'producer_removed') {
      producers.delete(event.id);
    } else if (event.op === 'customer_added' && event.id) {
      customers.set(event.id, {
        id: event.id,
        name: event.name || '',
        kind: event.kind || 'account',
      });
      if (!customerOrder.includes(event.id)) customerOrder.push(event.id);
    } else if (event.op === 'customer_updated' && customers.has(event.id)) {
      Object.assign(customers.get(event.id), {
        name: event.name ?? customers.get(event.id).name,
      });
    } else if (event.op === 'customer_removed') {
      customers.delete(event.id);
    } else if (event.op === 'wine_added' && event.id) {
      wines.set(event.id, {
        id: event.id,
        producerId: event.producerId,
        name: event.name || '',
        vintage: event.vintage || '',
        appellation: event.appellation || '',
        color: event.color || 'red',
        format: event.format || '',
        itemCode: event.itemCode || '',
      });
      if (!wineOrder.includes(event.id)) wineOrder.push(event.id);
    } else if (event.op === 'wine_updated' && wines.has(event.id)) {
      const wine = wines.get(event.id);
      Object.assign(wine, {
        name: event.name ?? wine.name,
        vintage: event.vintage ?? wine.vintage,
        appellation: event.appellation ?? wine.appellation,
        color: event.color ?? wine.color,
        format: event.format ?? wine.format,
        producerId: event.producerId ?? wine.producerId,
        itemCode: event.itemCode ?? wine.itemCode,
      });
    } else if (event.op === 'wine_removed') {
      wines.delete(event.id);
    }
  });

  return {
    producers: producerOrder.map((id) => producers.get(id)).filter(Boolean),
    customers: customerOrder.map((id) => customers.get(id)).filter(Boolean),
    wines: wineOrder.map((id) => wines.get(id)).filter(Boolean),
  };
}

function replayMonth(changelog) {
  const allotments = new Map();
  const allocations = new Map();

  [...changelog].sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || ''))).forEach((event) => {
    if (event.op === 'allotment_set' && event.wineId) {
      allotments.set(event.wineId, {
        wineId: event.wineId,
        cases: Number(event.cases) || 0,
        wholesale: Number(event.wholesale) || 0,
        retail: Number(event.retail) || 0,
      });
    } else if (event.op === 'allocation_set' && event.wineId && event.customerId) {
      const key = `${event.wineId}:${event.customerId}`;
      const cases = Number(event.cases) || 0;
      if (!cases) allocations.delete(key);
      else {
        allocations.set(key, {
          wineId: event.wineId,
          customerId: event.customerId,
          cases,
          status: event.status || '',
        });
      }
    }
  });

  return { allotments, allocations };
}

function model() {
  const catalog = replayCatalog(state.catalog);
  const month = replayMonth(state.monthLog);
  return { ...catalog, ...month };
}

function totalsFor(wines, allotments, allocations) {
  let received = 0;
  let allocated = 0;
  wines.forEach((wine) => {
    received += allotments.get(wine.id)?.cases || 0;
    allocations.forEach((row) => {
      if (row.wineId === wine.id) allocated += row.cases;
    });
  });
  return { received, allocated, remaining: received - allocated };
}

function allocatedForWine(wineId, allocations) {
  let sum = 0;
  allocations.forEach((row) => {
    if (row.wineId === wineId) sum += row.cases;
  });
  return sum;
}

function debounce(key, fn, wait = 400) {
  const prev = timers.get(key);
  if (prev) clearTimeout(prev);
  timers.set(key, setTimeout(fn, wait));
}

async function save(kind, event) {
  const url = kind === 'catalog' ? catalogUrl() : monthUrl(state.month);
  setSync('syncing');
  const stamped = { ...event, ts: new Date().toISOString() };
  if (kind === 'catalog') state.catalog.push(stamped);
  else state.monthLog.push(stamped);
  render();
  try {
    await postEvent(url, event);
    setSync(state.source === 'local' ? 'local' : 'synced');
  } catch {
    setSync('error');
  }
}

function renderStats(data) {
  const { received, allocated, remaining } = totalsFor(data.wines, data.allotments, data.allocations);
  statsEl.innerHTML = `
    <div class="stat"><b>${compactQty(received)}</b><span>Received</span></div>
    <div class="stat"><b>${compactQty(allocated)}</b><span>Allocated</span></div>
    <div class="stat ${remaining < -0.001 ? 'over' : ''}"><b>${compactQty(remaining)}</b><span>Remaining</span></div>
  `;
}

function winesForProducer(data, producerId) {
  return data.wines.filter((wine) => wine.producerId === producerId);
}

function wineLabel(wine) {
  return [wine.vintage, wine.name].filter(Boolean).join(' ');
}

function syncSelection(data) {
  if (!data.producers.length) {
    state.producerId = null;
    state.wineId = null;
    return { producer: null, wines: [], wine: null };
  }
  const producer = data.producers.find((item) => item.id === state.producerId) || data.producers[0];
  state.producerId = producer.id;
  const wines = winesForProducer(data, producer.id);
  const wine = wines.find((item) => item.id === state.wineId) || wines[0] || null;
  state.wineId = wine?.id || null;
  return { producer, wines, wine };
}

function renderProducerNav(data) {
  producerNav.innerHTML = data.producers.map((producer) => `
    <button class="producer-chip" data-id="${producer.id}" aria-pressed="${producer.id === state.producerId}" style="--chip:${producer.color}">
      <span class="swatch"></span>${escapeHtml(producer.name)}
    </button>
  `).join('');
}

function renderWineNav(wines, producer) {
  if (!producer || !wines.length) {
    wineNav.innerHTML = '';
    return;
  }
  wineNav.innerHTML = wines.map((wine) => `
    <button class="wine-chip" data-id="${wine.id}" aria-pressed="${wine.id === state.wineId}" style="--chip:${producer.color}">
      ${escapeHtml(wineLabel(wine))}
    </button>
  `).join('');
}

function renderLists(data) {
  producerList.innerHTML = data.producers.map((producer) => `
    <div class="list-item">
      <span><b>${escapeHtml(producer.name)}</b> <span class="muted">${escapeHtml(producer.region || '')}</span></span>
    </div>
  `).join('');
  customerList.innerHTML = data.customers.map((customer) => `
    <div class="list-item">
      <span>${escapeHtml(customer.name)}</span>
    </div>
  `).join('');
}

function renderBoard(data, producer, wine) {
  if (!producer) {
    boardEl.innerHTML = '<div class="empty">No producers yet. Add the book, then allot wines for the month.</div>';
    return;
  }
  if (!wine) {
    boardEl.innerHTML = `<div class="empty">No wines on ${escapeHtml(producer.name)} yet. Add a wine to start this month’s allotment.</div>`;
    return;
  }

  const visibleCustomers = data.customers.filter((customer) => {
    if (state.showEmpty) return true;
    return data.allocations.has(`${wine.id}:${customer.id}`);
  });

  const allot = data.allotments.get(wine.id) || { cases: 0, wholesale: 0, retail: 0 };
  const allocated = allocatedForWine(wine.id, data.allocations);
  const remaining = (allot.cases || 0) - allocated;
  const receivedBottles = Math.round((allot.cases || 0) * BOTTLES_PER_CASE);
  const allocatedBottles = Math.round(allocated * BOTTLES_PER_CASE);
  const pct = receivedBottles > 0
    ? Math.min(100, Math.round((allocatedBottles / receivedBottles) * 100))
    : (allocatedBottles > 0 ? 100 : 0);
  const remainCopy = remaining < -0.001
    ? `${qtyPhrase(remaining)} over the allotment`
    : remaining <= 0.001
      ? 'Fully allocated'
      : `${qtyPhrase(remaining)} left to place`;

  const accounts = visibleCustomers.map((customer) => {
    const row = data.allocations.get(`${wine.id}:${customer.id}`);
    const status = row?.status || '';
    return `
      <li class="account ${customer.kind === 'transfer' ? 'transfer' : ''}">
        <span class="account-name">${escapeHtml(customer.name)}</span>
        ${renderFigure(row?.cases || 0, { editable: true, pack: `alloc:${wine.id}:${customer.id}` })}
        <button class="status ${status}" data-status="${wine.id}:${customer.id}" type="button">${status || 'set status'}</button>
      </li>
    `;
  }).join('');

  boardEl.innerHTML = `
    <article class="overview" style="--wine-col:${producer.color}">
      <div class="overview-grid">
        <section class="figure">
          <p class="figure-label">Received</p>
          ${renderFigure(allot.cases, { editable: true, pack: `allot:${wine.id}` })}
        </section>
        <section class="figure">
          <p class="figure-label">Allocated</p>
          ${renderFigure(allocated, { over: remaining < -0.001 })}
        </section>
      </div>
      <div class="overview-meter" role="img" aria-label="${pct}% allocated">
        <span class="overview-meter-fill" style="width:${pct}%"></span>
      </div>
      <p class="overview-remain ${remaining < -0.001 ? 'is-over' : ''}">${remainCopy}</p>
      <div class="overview-price">
        <label>RT <input class="price" data-retail="${wine.id}" type="number" min="0" step="1" value="${allot.retail || ''}" placeholder="—"></label>
      </div>
    </article>
    <ul class="accounts">
      ${accounts || '<li class="accounts-empty">No accounts allocated yet. Show empty accounts or add a customer.</li>'}
    </ul>
  `;
}

function render() {
  const data = model();
  const { producer, wines, wine } = syncSelection(data);
  monthLabel.textContent = formatMonthLabel(state.month);
  renderStats(data);
  renderProducerNav(data);
  renderWineNav(wines, producer);
  renderBoard(data, producer, wine);
  renderLists(data);
}

async function persistAllotment(wineId, patch) {
  const data = model();
  const current = data.allotments.get(wineId) || { cases: 0, wholesale: 0, retail: 0 };
  await save('month', {
    op: 'allotment_set',
    wineId,
    cases: patch.cases ?? current.cases,
    wholesale: patch.wholesale ?? current.wholesale,
    retail: patch.retail ?? current.retail,
  });
}

async function persistAllocation(wineId, customerId, patch) {
  const data = model();
  const current = data.allocations.get(`${wineId}:${customerId}`) || { cases: 0, status: '' };
  await save('month', {
    op: 'allocation_set',
    wineId,
    customerId,
    cases: patch.cases ?? current.cases,
    status: patch.status ?? current.status,
  });
}

function nextStatus(current) {
  if (current === 'waiting') return 'confirmed';
  if (current === 'confirmed') return '';
  return 'waiting';
}

function onBoardInput(event) {
  const { target } = event;
  if (target.classList.contains('figure-input')) {
    const cleaned = target.value.replace(/\D/g, '');
    if (cleaned !== target.value) target.value = cleaned;
    const sizer = target.previousElementSibling;
    if (sizer?.classList.contains('figure-sizer')) {
      sizer.textContent = target.value || '0';
    }
  }
  const pack = target.closest('[data-pack]');
  if (pack) {
    const [kind, wineId, customerId] = pack.dataset.pack.split(':');
    const cases = packFrom(pack);
    if (kind === 'allot') {
      debounce(`allot-${wineId}`, () => persistAllotment(wineId, { cases }));
    } else if (kind === 'alloc' && customerId) {
      debounce(`alloc-${wineId}-${customerId}`, () => persistAllocation(wineId, customerId, { cases }));
    }
    return;
  }
  if (target.dataset.retail) {
    const wineId = target.dataset.retail;
    debounce(`rt-${wineId}`, () => persistAllotment(wineId, { retail: Number(target.value) || 0 }));
  }
}

function onBoardClick(event) {
  const statusBtn = event.target.closest('[data-status]');
  if (!statusBtn) return;
  const [wineId, customerId] = statusBtn.dataset.status.split(':');
  const data = model();
  const current = data.allocations.get(`${wineId}:${customerId}`);
  persistAllocation(wineId, customerId, { status: nextStatus(current?.status || '') });
}

async function loadMonth() {
  setSync('syncing');
  const result = await loadEvents(monthUrl(state.month));
  state.monthLog = result.events;
  state.source = result.source;
  setSync(result.source === 'server' ? 'synced' : 'local');
}

function idsOf(items) {
  return new Set(items.map((item) => item.id));
}

function missingCatalogEvents(data) {
  const producerIds = idsOf(data.producers);
  const customerIds = idsOf(data.customers);
  const wineIds = idsOf(data.wines);
  return catalogSeedEvents().filter((event) => {
    if (event.op === 'producer_added') return !producerIds.has(event.id);
    if (event.op === 'customer_added') return !customerIds.has(event.id);
    if (event.op === 'wine_added') return !wineIds.has(event.id);
    return false;
  });
}

function missingMonthEvents(data) {
  const existingAllot = new Set(data.allotments.keys());
  const existingAlloc = new Set(data.allocations.keys());
  return monthSeedEvents().filter((event) => {
    if (event.op === 'allotment_set') return !existingAllot.has(event.wineId);
    if (event.op === 'allocation_set') {
      return !existingAlloc.has(`${event.wineId}:${event.customerId}`);
    }
    return false;
  });
}

async function loadAll() {
  setSync('syncing');
  boardEl.innerHTML = '<div class="loading">Loading allocations…</div>';
  try {
    const [catalog, list] = await Promise.all([
      loadEvents(catalogUrl()),
      loadCatalog(),
    ]);
    state.catalog = catalog.events;
    state.list = list;
    state.source = catalog.source;

    let data = model();
    const catalogMissing = missingCatalogEvents(data);
    if (catalogMissing.length) {
      await postEvents(catalogUrl(), catalogMissing);
      const seeded = await loadEvents(catalogUrl());
      if (seeded.events.length >= state.catalog.length) state.catalog = seeded.events;
      else {
        catalogMissing.forEach((event) => {
          state.catalog.push({ ...event, ts: new Date().toISOString() });
        });
      }
    }

    await loadMonth();
    data = model();
    const monthMissing = missingMonthEvents(data);
    const exampleMonthKey = 'psAlloc_exampleMonth';
    const exampleMonth = localStorage.getItem(exampleMonthKey);
    if (monthMissing.length && data.wines.length && (!exampleMonth || exampleMonth === state.month)) {
      localStorage.setItem(exampleMonthKey, state.month);
      await postEvents(monthUrl(state.month), monthMissing);
      const monthSeeded = await loadEvents(monthUrl(state.month));
      if (monthSeeded.events.length >= state.monthLog.length) state.monthLog = monthSeeded.events;
      else {
        monthMissing.forEach((event) => {
          state.monthLog.push({ ...event, ts: new Date().toISOString() });
        });
      }
    }

    setSync(state.source === 'server' ? 'synced' : 'local');
    render();
  } catch {
    setSync('error');
    boardEl.innerHTML = '<div class="empty">Could not load allocations. Retry with the refresh button — local changes are kept.</div>';
  }
}

function foldName(value) {
  return prettyName(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function namesMatch(a, b) {
  const fa = foldName(a);
  const fb = foldName(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  const [short, long] = fa.length <= fb.length ? [fa, fb] : [fb, fa];
  return short.length >= 8 && long.includes(short);
}

function formatFromRow(row) {
  const size = String(row.Size || '').replace(/\s+/g, '').toLowerCase();
  const name = row.Wine || '';
  if (/1\.5l|1500ml/.test(size) || /magnum/i.test(name)) return 'magnum';
  return String(row.Size || '').trim();
}

function colorForName(name) {
  const palette = ['#7a2436', '#c48a2a', '#6b3a5a', '#2c4a6e', '#44513d', '#9a6a42', '#4a1420', '#6d7b63'];
  const key = foldName(name);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  return palette[hash % palette.length];
}

function wineIdFor(row) {
  const code = String(row['Item Code'] || '').trim();
  if (!code) return generateId();
  return `wine-${code.replace(/[^0-9A-Za-z]+/g, '-')}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function rowKey(row) {
  return [
    String(row['Item Code'] || '').trim(),
    String(row.Producer || '').trim(),
    String(row.Wine || '').trim(),
    String(row.Vintage || '').trim(),
    String(row.Size || '').trim(),
  ].join('\u001f');
}

function findProducerForRow(data, row) {
  return data.producers.find((producer) => namesMatch(producer.name, row.Producer)) || null;
}

function findExistingWine(data, row) {
  const code = String(row['Item Code'] || '').trim();
  if (code) {
    const byCode = data.wines.find((wine) => wine.itemCode === code || wine.id === `wine-${code}` || wine.id === wineIdFor(row));
    if (byCode) return byCode;
  }
  const producer = findProducerForRow(data, row);
  const vintage = String(row.Vintage || '').trim();
  return data.wines.find((wine) => {
    if (vintage && String(wine.vintage || '').trim() !== vintage) return false;
    if (producer && wine.producerId !== producer.id) return false;
    if (!producer && !namesMatch(data.producers.find((item) => item.id === wine.producerId)?.name, row.Producer)) return false;
    return namesMatch(wine.name, row.Wine);
  }) || null;
}

function pickerEls() {
  return {
    filters: document.getElementById('winePickerFilters'),
    search: document.getElementById('winePickerSearch'),
    empty: document.getElementById('winePickerEmpty'),
    list: document.getElementById('winePickerList'),
    selected: document.getElementById('winePickerSelected'),
    save: document.getElementById('wineSave'),
  };
}

function currentPickerFilter() {
  return document.querySelector('#winePickerFilters .picker-chip[aria-pressed="true"]')?.dataset.filter || 'all';
}

function selectedPickerRow() {
  if (!state.pickerKey) return null;
  return state.list.find((row) => rowKey(row) === state.pickerKey) || null;
}

function applyPickerFilter() {
  const { search, empty, list } = pickerEls();
  const tag = currentPickerFilter();
  const query = search?.value.trim() || '';
  const toks = query.toLowerCase().split(/\s+/).filter(Boolean);
  let matched = 0;
  list.querySelectorAll('.picker-wine').forEach((el) => {
    const catMatch = tag === 'all' || el.dataset.cat === tag;
    const hay = el.dataset.search || '';
    const textMatch = !toks.length || toks.every((tok) => hay.includes(tok));
    const match = catMatch && textMatch;
    if (match) matched += 1;
    el.hidden = !match;
    el.querySelectorAll('[data-original]').forEach((node) => {
      node.innerHTML = highlight(node.dataset.original, match ? query : '');
    });
  });
  empty.hidden = matched !== 0;
}

function fillAllotmentFields(row) {
  const data = model();
  const existing = row ? findExistingWine(data, row) : null;
  const allot = existing ? data.allotments.get(existing.id) : null;
  document.getElementById('wineCases').value = allot ? allot.cases : 1;
  document.getElementById('wineRetail').value = allot?.retail || parseMoney(row?.['UT Retail']) || '';
}

function selectPickerRow(row) {
  const { list, selected, save } = pickerEls();
  state.pickerKey = row ? rowKey(row) : '';
  list.querySelectorAll('.picker-wine').forEach((el) => {
    el.setAttribute('aria-selected', String(el.dataset.key === state.pickerKey));
  });
  if (!row) {
    selected.textContent = 'Pick a wine from the current list.';
    save.disabled = true;
    fillAllotmentFields(null);
    return;
  }
  const producer = prettyName(row.Producer);
  const wine = prettyName(row.Wine);
  const vintage = String(row.Vintage || '').trim();
  selected.textContent = [vintage, wine, '·', producer].filter(Boolean).join(' ');
  save.disabled = false;
  fillAllotmentFields(row);
}

function renderPickerList() {
  const { list } = pickerEls();
  const data = model();
  const current = data.producers.find((producer) => producer.id === state.producerId);
  const rows = [...state.list].sort((a, b) => {
    if (current) {
      const aMatch = namesMatch(a.Producer, current.name) ? 0 : 1;
      const bMatch = namesMatch(b.Producer, current.name) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    const byProducer = prettyName(a.Producer).localeCompare(prettyName(b.Producer));
    if (byProducer) return byProducer;
    return prettyName(a.Wine).localeCompare(prettyName(b.Wine));
  });

  if (!rows.length) {
    list.innerHTML = '<p class="picker-status">The current list could not be loaded. Try again shortly.</p>';
    return;
  }

  list.innerHTML = rows.map((row) => {
    const cat = wineCategory(row);
    const existing = findExistingWine(data, row);
    const onMonth = existing && data.allotments.has(existing.id);
    const producer = prettyName(row.Producer);
    const wine = prettyName(row.Wine);
    const region = prettyName(row['Region/Sub Region']);
    const vintage = String(row.Vintage || '').trim();
    const format = formatFromRow(row);
    const price = formatPrice(row['UT Per BTL']);
    const meta = [region, vintage, format === 'magnum' ? 'Magnum' : ''].filter(Boolean).join(' · ');
    const note = onMonth ? 'On this month' : existing ? 'On the book' : '';
    const key = rowKey(row);
    return `
      <button type="button" class="picker-wine" role="option" data-key="${escapeHtml(key)}" data-cat="${cat}" data-search="${escapeHtml(wineHaystack(row, cat, '', price))}" aria-selected="${key === state.pickerKey}">
        <span class="picker-swatch cat-${cat}" aria-hidden="true"></span>
        <span class="picker-copy">
          <span class="picker-name" data-original="${escapeHtml(wine)}">${escapeHtml(wine)}</span>
          <span class="picker-meta">
            <span data-original="${escapeHtml(producer)}">${escapeHtml(producer)}</span>
            ${meta ? `<span data-original="${escapeHtml(meta)}">${escapeHtml(meta)}</span>` : ''}
            <span>${escapeHtml(CAT_LABEL[cat] || 'Wine')}</span>
          </span>
        </span>
        <span class="picker-side">
          ${price ? `<span class="picker-price" data-original="${escapeHtml(price)}">${escapeHtml(price)}</span>` : ''}
          ${note ? `<span class="picker-badge">${note}</span>` : ''}
        </span>
      </button>
    `;
  }).join('');
  applyPickerFilter();
}

async function openWineDialog() {
  state.pickerKey = '';
  const { filters, search, save, list } = pickerEls();
  filters.querySelectorAll('.picker-chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.filter === 'all'));
  });
  search.value = '';
  save.disabled = true;
  list.innerHTML = '<p class="picker-status">Loading the current list…</p>';
  selectPickerRow(null);
  wineDialog.showModal();
  search.focus();
  if (!state.list.length) state.list = await loadCatalog();
  renderPickerList();
}

async function addCatalogWine(row, allotment) {
  const data = model();
  const existing = findExistingWine(data, row);
  let producerId = existing?.producerId || findProducerForRow(data, row)?.id;
  if (!producerId) {
    producerId = generateId();
    await save('catalog', {
      op: 'producer_added',
      id: producerId,
      name: prettyName(row.Producer),
      region: prettyName(row['Region/Sub Region']).replace(/[()]/g, '').trim(),
      color: colorForName(row.Producer),
    });
  }
  const wineId = existing?.id || wineIdFor(row);
  if (!existing) {
    await save('catalog', {
      op: 'wine_added',
      id: wineId,
      producerId,
      name: prettyName(row.Wine),
      vintage: String(row.Vintage || '').trim(),
      color: wineCategory(row),
      appellation: prettyName(row['Region/Sub Region']),
      format: formatFromRow(row),
      itemCode: String(row['Item Code'] || '').trim(),
    });
  }
  state.producerId = producerId;
  state.wineId = wineId;
  await persistAllotment(wineId, allotment);
}

function bind() {
  document.getElementById('prevMonth').addEventListener('click', async () => {
    state.month = shiftMonth(state.month, -1);
    await loadMonth();
    render();
  });
  document.getElementById('nextMonth').addEventListener('click', async () => {
    state.month = shiftMonth(state.month, 1);
    await loadMonth();
    render();
  });
  document.getElementById('refreshBtn').addEventListener('click', loadAll);
  producerNav.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-id]');
    if (!chip) return;
    state.producerId = chip.dataset.id;
    state.wineId = null;
    render();
  });
  wineNav.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-id]');
    if (!chip) return;
    state.wineId = chip.dataset.id;
    render();
  });
  boardEl.addEventListener('input', onBoardInput);
  boardEl.addEventListener('click', onBoardClick);
  showEmptyBtn.addEventListener('click', () => {
    state.showEmpty = !state.showEmpty;
    showEmptyBtn.setAttribute('aria-pressed', String(state.showEmpty));
    showEmptyBtn.textContent = state.showEmpty ? 'Hide empty accounts' : 'Show empty accounts';
    render();
  });

  document.getElementById('addWineBtn').addEventListener('click', openWineDialog);
  document.getElementById('wineCancel').addEventListener('click', () => wineDialog.close());
  document.getElementById('winePickerFilters').addEventListener('click', (event) => {
    const chip = event.target.closest('.picker-chip');
    if (!chip) return;
    document.querySelectorAll('#winePickerFilters .picker-chip').forEach((item) => {
      item.setAttribute('aria-pressed', 'false');
    });
    chip.setAttribute('aria-pressed', 'true');
    applyPickerFilter();
  });
  document.getElementById('winePickerSearch').addEventListener('input', applyPickerFilter);
  document.getElementById('winePickerList').addEventListener('click', (event) => {
    const button = event.target.closest('.picker-wine');
    if (!button) return;
    const row = state.list.find((item) => rowKey(item) === button.dataset.key);
    if (row) selectPickerRow(row);
  });
  document.getElementById('wineForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const row = selectedPickerRow();
    if (!row) return;
    await addCatalogWine(row, {
      cases: Number(document.getElementById('wineCases').value) || 0,
      retail: Number(document.getElementById('wineRetail').value) || 0,
    });
    wineDialog.close();
    event.target.reset();
    selectPickerRow(null);
  });

  document.getElementById('addCustomerBtn').addEventListener('click', () => customerDialog.showModal());
  document.getElementById('customerCancel').addEventListener('click', () => customerDialog.close());
  document.getElementById('customerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    await save('catalog', {
      op: 'customer_added',
      id: generateId(),
      name: document.getElementById('customerName').value.trim(),
    });
    state.showEmpty = true;
    customerDialog.close();
    event.target.reset();
  });

  document.getElementById('addProducerBtn').addEventListener('click', () => producerDialog.showModal());
  document.getElementById('producerCancel').addEventListener('click', () => producerDialog.close());
  document.getElementById('producerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = generateId();
    await save('catalog', {
      op: 'producer_added',
      id,
      name: document.getElementById('producerName').value.trim(),
      region: document.getElementById('producerRegion').value.trim(),
      color: document.getElementById('producerColor').value,
    });
    state.producerId = id;
    state.wineId = null;
    producerDialog.close();
    event.target.reset();
  });
}

bind();
loadAll();
