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

const state = {
  month: monthKey(),
  catalog: [],
  monthLog: [],
  producerId: null,
  showEmpty: false,
  source: 'server',
};

const timers = new Map();

const syncEl = document.getElementById('sync');
const boardEl = document.getElementById('board');
const producerNav = document.getElementById('producerNav');
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

function formatCases(value) {
  const num = Number(value);
  if (!num) return '';
  return String(Number(num.toFixed(3)));
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
    <div class="stat"><b>${formatCases(received) || 0}</b><span>Cases in</span></div>
    <div class="stat"><b>${formatCases(allocated) || 0}</b><span>Allocated</span></div>
    <div class="stat ${remaining < -0.001 ? 'over' : ''}"><b>${formatCases(remaining) || 0}</b><span>Remaining</span></div>
  `;
}

function renderProducerNav(data) {
  producerNav.innerHTML = data.producers.map((producer) => `
    <button class="producer-chip" data-id="${producer.id}" aria-pressed="${producer.id === state.producerId}" style="--chip:${producer.color}">
      <span class="swatch"></span>${escapeHtml(producer.name)}
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

function fillWineProducerSelect(data) {
  const select = document.getElementById('wineProducer');
  select.innerHTML = data.producers.map((producer) => `
    <option value="${escapeHtml(producer.id)}" ${producer.id === state.producerId ? 'selected' : ''}>${escapeHtml(producer.name)}</option>
  `).join('');
}

function renderBoard(data) {
  if (!data.producers.length) {
    boardEl.innerHTML = '<div class="empty">No producers yet. Add the book, then allot wines for the month.</div>';
    return;
  }
  const producer = data.producers.find((item) => item.id === state.producerId) || data.producers[0];
  state.producerId = producer.id;
  const wines = data.wines.filter((wine) => wine.producerId === producer.id);
  if (!wines.length) {
    boardEl.innerHTML = `<div class="empty">No wines on ${escapeHtml(producer.name)} yet. Add a wine to start this month’s allotment.</div>`;
    return;
  }

  const visibleCustomers = data.customers.filter((customer) => {
    if (state.showEmpty) return true;
    return wines.some((wine) => data.allocations.has(`${wine.id}:${customer.id}`));
  });

  const wineHeads = wines.map((wine) => {
    const format = wine.format === 'magnum' ? ' · Magnum' : '';
    return `<th class="wine-head" style="--wine-col:${producer.color}">
      <span class="meta">${escapeHtml(wine.vintage)} ${escapeHtml(wine.appellation || '')}${format}</span>
      <span class="name">${escapeHtml(wine.name)}</span>
    </th>`;
  }).join('');

  const receivedRow = wines.map((wine) => {
    const allot = data.allotments.get(wine.id) || { cases: 0, wholesale: 0, retail: 0 };
    return `<td><input class="qty" data-allot="${wine.id}" type="number" min="0" step="0.001" value="${formatCases(allot.cases)}"></td>`;
  }).join('');

  const allocatedRow = wines.map((wine) => {
    const allocated = allocatedForWine(wine.id, data.allocations);
    return `<td>${formatCases(allocated) || '0'}</td>`;
  }).join('');

  const remainingRow = wines.map((wine) => {
    const received = data.allotments.get(wine.id)?.cases || 0;
    const remaining = received - allocatedForWine(wine.id, data.allocations);
    return `<td class="${remaining < -0.001 ? 'over' : ''}">${formatCases(remaining) || '0'}</td>`;
  }).join('');

  const priceRow = wines.map((wine) => {
    const allot = data.allotments.get(wine.id) || { wholesale: 0, retail: 0 };
    return `<td>
      <input class="price" data-wholesale="${wine.id}" type="number" min="0" step="1" value="${allot.wholesale || ''}" placeholder="WS">
      /
      <input class="price" data-retail="${wine.id}" type="number" min="0" step="1" value="${allot.retail || ''}" placeholder="RT">
    </td>`;
  }).join('');

  const customerRows = visibleCustomers.map((customer) => {
    const cells = wines.map((wine) => {
      const row = data.allocations.get(`${wine.id}:${customer.id}`);
      const status = row?.status || '';
      return `<td>
        <div class="cell">
          <input class="qty" data-alloc="${wine.id}:${customer.id}" type="number" min="0" step="0.001" value="${formatCases(row?.cases)}">
          <button class="status ${status}" data-status="${wine.id}:${customer.id}" type="button">${status || 'set status'}</button>
        </div>
      </td>`;
    }).join('');
    return `<tr class="${customer.kind === 'transfer' ? 'transfer' : ''}">
      <th class="sticky">${escapeHtml(customer.name)}</th>${cells}
    </tr>`;
  }).join('');

  boardEl.innerHTML = `
    <table class="grid">
      <thead>
        <tr>
          <th class="sticky">${escapeHtml(producer.name)}</th>
          ${wineHeads}
        </tr>
      </thead>
      <tbody>
        <tr class="metric"><th class="sticky">Cases received</th>${receivedRow}</tr>
        <tr class="metric"><th class="sticky">Total allocated</th>${allocatedRow}</tr>
        <tr class="metric"><th class="sticky">Remaining</th>${remainingRow}</tr>
        <tr class="metric"><th class="sticky">Pricing WS / RT</th>${priceRow}</tr>
        ${customerRows || '<tr><td class="sticky muted" colspan="20">No accounts allocated yet. Show empty accounts or add a customer.</td></tr>'}
      </tbody>
    </table>
  `;
}

function render() {
  const data = model();
  if (!state.producerId && data.producers[0]) state.producerId = data.producers[0].id;
  monthLabel.textContent = formatMonthLabel(state.month);
  renderStats(data);
  renderProducerNav(data);
  renderBoard(data);
  renderLists(data);
  fillWineProducerSelect(data);
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
  if (target.dataset.allot) {
    const wineId = target.dataset.allot;
    debounce(`allot-${wineId}`, () => persistAllotment(wineId, { cases: Number(target.value) || 0 }));
  } else if (target.dataset.wholesale) {
    const wineId = target.dataset.wholesale;
    debounce(`ws-${wineId}`, () => persistAllotment(wineId, { wholesale: Number(target.value) || 0 }));
  } else if (target.dataset.retail) {
    const wineId = target.dataset.retail;
    debounce(`rt-${wineId}`, () => persistAllotment(wineId, { retail: Number(target.value) || 0 }));
  } else if (target.dataset.alloc) {
    const [wineId, customerId] = target.dataset.alloc.split(':');
    debounce(`alloc-${wineId}-${customerId}`, () => persistAllocation(wineId, customerId, {
      cases: Number(target.value) || 0,
    }));
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
    const catalog = await loadEvents(catalogUrl());
    state.catalog = catalog.events;
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

  document.getElementById('addWineBtn').addEventListener('click', () => wineDialog.showModal());
  document.getElementById('wineCancel').addEventListener('click', () => wineDialog.close());
  document.getElementById('wineForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = generateId();
    const producerId = document.getElementById('wineProducer').value;
    await save('catalog', {
      op: 'wine_added',
      id,
      producerId,
      name: document.getElementById('wineName').value.trim(),
      vintage: document.getElementById('wineVintage').value.trim(),
      color: document.getElementById('wineColor').value,
      appellation: document.getElementById('wineAppellation').value.trim(),
      format: document.getElementById('wineFormat').value.trim(),
    });
    await persistAllotment(id, {
      cases: Number(document.getElementById('wineCases').value) || 0,
      wholesale: Number(document.getElementById('wineWholesale').value) || 0,
      retail: Number(document.getElementById('wineRetail').value) || 0,
    });
    state.producerId = producerId;
    wineDialog.close();
    event.target.reset();
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
    producerDialog.close();
    event.target.reset();
  });
}

bind();
loadAll();
