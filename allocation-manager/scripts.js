const {
  applyChrome,
  applyMonthFromUrl,
  assetQuery,
  bindMonthNav,
  boot,
  bottlesOf,
  canEdit,
  casesFromBottles,
  compactQty,
  escapeHtml,
  formatMonthLabel,
  generateId,
  loadMonth,
  loadSession,
  model,
  packFrom,
  qtyPhrase,
  renderFigure,
  routeAfterAccess,
  save,
  saveMany,
  setRender,
  shiftMonth,
  state,
  winesOnMonth,
  wineLabel,
} = await import(`./shared.js${new URL(import.meta.url).search}`);

const catalogMod = await import(`../scripts/catalog.js${assetQuery}`);
const {
  CAT_LABEL,
  formatPrice,
  highlight,
  loadCatalog,
  parseMoney,
  prettyName,
  wineCategory,
  wineHaystack,
} = catalogMod;

const timers = new Map();

const boardEl = document.getElementById('board');
const producerNav = document.getElementById('producerNav');
const wineNav = document.getElementById('wineNav');
const monthLabel = document.getElementById('monthLabel');
const statsEl = document.getElementById('stats');
const showEmptyBtn = document.getElementById('showEmptyBtn');
const wineDialog = document.getElementById('wineDialog');
const allocDock = document.getElementById('allocDock');
const allocSpread = document.getElementById('allocSpread');
const allocMinus = document.getElementById('allocMinus');

function viewFromSearch(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    month: params.get('month') || '',
    producerId: params.get('producer') || '',
    wineId: params.get('wine') || '',
  };
}

function applyViewFromUrl() {
  applyMonthFromUrl();
  const view = viewFromSearch();
  state.producerId = view.producerId || null;
  state.wineId = view.wineId || null;
}

function urlForView() {
  const params = new URLSearchParams();
  params.set('month', state.month);
  if (state.producerId) params.set('producer', state.producerId);
  if (state.wineId) params.set('wine', state.wineId);
  return `${window.location.pathname}?${params.toString()}`;
}

function locationKey() {
  return `${state.month}|${state.producerId || ''}|${state.wineId || ''}`;
}

let lastLocationKey = '';

function syncLocation(mode = 'replace') {
  const key = locationKey();
  const url = urlForView();
  const here = `${window.location.pathname}${window.location.search}`;
  if (key === lastLocationKey && here === url) return;
  lastLocationKey = key;
  const data = { month: state.month, producerId: state.producerId, wineId: state.wineId };
  if (mode === 'push') history.pushState(data, '', url);
  else history.replaceState(data, '', url);
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

function renderStats(data) {
  const { received, allocated, remaining } = totalsFor(winesOnMonth(data), data.allotments, data.allocations);
  statsEl.innerHTML = `
    <div class="stat"><b>${compactQty(received)}</b><span>Received</span></div>
    <div class="stat"><b>${compactQty(allocated)}</b><span>Allocated</span></div>
    <div class="stat ${remaining < -0.001 ? 'over' : ''}"><b>${compactQty(remaining)}</b><span>Remaining</span></div>
  `;
}

function producersOnMonth(data) {
  const ids = new Set(winesOnMonth(data).map((wine) => wine.producerId));
  return data.producers.filter((producer) => ids.has(producer.id));
}

function winesForProducer(data, producerId) {
  return winesOnMonth(data).filter((wine) => wine.producerId === producerId);
}

function syncSelection(data) {
  const producers = producersOnMonth(data);
  const monthWines = winesOnMonth(data);
  if (!producers.length) {
    state.producerId = null;
    if (state.wineId) state.selectedAccounts.clear();
    state.wineId = null;
    return { producer: null, wines: [], wine: null };
  }
  const linkedWine = monthWines.find((item) => item.id === state.wineId);
  if (linkedWine) state.producerId = linkedWine.producerId;
  const producer = producers.find((item) => item.id === state.producerId) || producers[0];
  state.producerId = producer.id;
  const wines = winesForProducer(data, producer.id);
  const wine = wines.find((item) => item.id === state.wineId) || wines[0] || null;
  if (wine?.id !== state.wineId) state.selectedAccounts.clear();
  state.wineId = wine?.id || null;
  return { producer, wines, wine };
}

function renderProducerNav(data) {
  producerNav.innerHTML = producersOnMonth(data).map((producer) => `
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

function renderBoard(data, producer, wine) {
  if (!winesOnMonth(data).length) {
    showEmptyBtn.hidden = true;
    boardEl.innerHTML = '<div class="empty">No wines this month yet. Add a wine to start this month’s allotment.</div>';
    return;
  }
  if (!producer || !wine) {
    showEmptyBtn.hidden = true;
    boardEl.innerHTML = '<div class="empty">Pick a wine to place this month’s allotment.</div>';
    return;
  }

  const allot = data.allotments.get(wine.id) || { cases: 0, wholesale: 0, retail: 0 };
  const allocated = allocatedForWine(wine.id, data.allocations);
  const nothingAllocated = allocated <= 0.001;
  const visibleCustomers = data.customers.filter((customer) => {
    if (state.showEmpty || nothingAllocated) return true;
    return data.allocations.has(`${wine.id}:${customer.id}`);
  });
  showEmptyBtn.hidden = nothingAllocated;
  const visibleIds = new Set(visibleCustomers.map((customer) => customer.id));
  [...state.selectedAccounts].forEach((id) => {
    if (!visibleIds.has(id)) state.selectedAccounts.delete(id);
  });
  const remaining = (allot.cases || 0) - allocated;
  const receivedBottles = Math.round((allot.cases || 0) * 12);
  const allocatedBottles = Math.round(allocated * 12);
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
    const selected = state.selectedAccounts.has(customer.id);
    return `
      <li class="account ${customer.kind === 'transfer' ? 'transfer' : ''} ${selected ? 'is-selected' : ''}" data-customer="${escapeHtml(customer.id)}" aria-selected="${selected}">
        <span class="account-name">${escapeHtml(customer.name)}</span>
        ${renderFigure(row?.cases || 0, { editable: canEdit(), pack: `alloc:${wine.id}:${customer.id}` })}
        <button class="status ${status}" data-status="${wine.id}:${customer.id}" type="button">${status || 'set status'}</button>
      </li>
    `;
  }).join('');

  boardEl.innerHTML = `
    <article class="overview" style="--wine-col:${producer.color}">
      <div class="overview-grid">
        <section class="figure">
          <p class="figure-label">Received</p>
          ${renderFigure(allot.cases, { editable: canEdit(), pack: `allot:${wine.id}` })}
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
      ${accounts || '<li class="accounts-empty">No accounts yet. Add a customer on the customers page to start placing bottles.</li>'}
    </ul>
  `;
}

function remainingBottlesFor(wineId) {
  if (!wineId) return 0;
  const data = model();
  const allot = data.allotments.get(wineId)?.cases || 0;
  const allocated = allocatedForWine(wineId, data.allocations);
  return Math.round((allot - allocated) * 12);
}

function selectedCustomerIds() {
  const data = model();
  return data.customers.map((customer) => customer.id).filter((id) => state.selectedAccounts.has(id));
}

function syncDock() {
  const ids = selectedCustomerIds();
  const open = canEdit() && Boolean(state.wineId && ids.length);
  allocDock.hidden = !open;
  document.body.classList.toggle('has-dock', open);
  if (!open) return;
  const remaining = remainingBottlesFor(state.wineId);
  const data = model();
  const canMinus = ids.some((id) => bottlesOf(data.allocations.get(`${state.wineId}:${id}`)?.cases) > 0);
  allocMinus.disabled = !canMinus;
  allocSpread.disabled = remaining <= 0;
}

function render(historyMode = 'replace') {
  applyChrome();
  if (state.access !== 'staff') {
    producerNav.innerHTML = '';
    wineNav.innerHTML = '';
    syncDock();
    return;
  }
  const data = model();
  monthLabel.textContent = formatMonthLabel(state.month);
  const { producer, wines, wine } = syncSelection(data);
  renderStats(data);
  renderProducerNav(data);
  renderWineNav(wines, producer);
  renderBoard(data, producer, wine);
  syncDock();
  syncLocation(historyMode);
}

async function persistAllotment(wineId, patch) {
  if (!canEdit()) return;
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

async function persistAllocations(wineId, patches) {
  if (!canEdit() || !patches.length) return;
  const data = model();
  const events = patches.map((patch) => {
    const current = data.allocations.get(`${wineId}:${patch.customerId}`) || { cases: 0, status: '' };
    return {
      op: 'allocation_set',
      wineId,
      customerId: patch.customerId,
      cases: patch.cases ?? current.cases,
      status: patch.status ?? current.status,
    };
  });
  await saveMany('month', events);
}

async function persistAllocation(wineId, customerId, patch) {
  await persistAllocations(wineId, [{ customerId, ...patch }]);
}

function selectedAllocationPatches(deltaBottles) {
  const wineId = state.wineId;
  const ids = selectedCustomerIds();
  if (!wineId || !ids.length) return [];
  const data = model();
  return ids.map((customerId) => {
    const current = data.allocations.get(`${wineId}:${customerId}`);
    const bottles = Math.max(0, bottlesOf(current?.cases) + deltaBottles);
    return { customerId, cases: casesFromBottles(bottles) };
  });
}

async function nudgeSelected(deltaBottles) {
  if (!canEdit()) return;
  const patches = selectedAllocationPatches(deltaBottles);
  if (!patches.length) return;
  await persistAllocations(state.wineId, patches);
}

async function spreadSelected() {
  if (!canEdit()) return;
  const wineId = state.wineId;
  const ids = selectedCustomerIds();
  if (!wineId || !ids.length) return;
  const remaining = remainingBottlesFor(wineId);
  if (remaining <= 0) return;
  const data = model();
  const base = Math.floor(remaining / ids.length);
  let extra = remaining % ids.length;
  const patches = ids.map((customerId) => {
    const add = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    const current = data.allocations.get(`${wineId}:${customerId}`);
    return { customerId, cases: casesFromBottles(bottlesOf(current?.cases) + add) };
  });
  await persistAllocations(wineId, patches);
}

function nextStatus(current) {
  if (current === 'waiting') return 'confirmed';
  if (current === 'confirmed') return '';
  return 'waiting';
}

function onBoardInput(event) {
  if (!canEdit()) return;
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
  if (!canEdit()) return;
  const statusBtn = event.target.closest('[data-status]');
  if (statusBtn) {
    const [wineId, customerId] = statusBtn.dataset.status.split(':');
    const data = model();
    const current = data.allocations.get(`${wineId}:${customerId}`);
    persistAllocation(wineId, customerId, { status: nextStatus(current?.status || '') });
    return;
  }
  if (event.target.closest('input, button')) return;
  const account = event.target.closest('.account[data-customer]');
  if (!account) return;
  const id = account.dataset.customer;
  if (state.selectedAccounts.has(id)) state.selectedAccounts.delete(id);
  else state.selectedAccounts.add(id);
  account.classList.toggle('is-selected', state.selectedAccounts.has(id));
  account.setAttribute('aria-selected', String(state.selectedAccounts.has(id)));
  syncDock();
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
  const { list, selected, save: saveBtn } = pickerEls();
  state.pickerKey = row ? rowKey(row) : '';
  list.querySelectorAll('.picker-wine').forEach((el) => {
    el.setAttribute('aria-selected', String(el.dataset.key === state.pickerKey));
  });
  if (!row) {
    selected.textContent = 'Pick a wine from the current list.';
    saveBtn.disabled = true;
    fillAllotmentFields(null);
    return;
  }
  const producer = prettyName(row.Producer);
  const wine = prettyName(row.Wine);
  const vintage = String(row.Vintage || '').trim();
  selected.textContent = [vintage, wine, '·', producer].filter(Boolean).join(' ');
  saveBtn.disabled = false;
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
  if (!canEdit()) return;
  state.pickerKey = '';
  const { filters, search, save: saveBtn, list } = pickerEls();
  filters.querySelectorAll('.picker-chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.filter === 'all'));
  });
  search.value = '';
  saveBtn.disabled = true;
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

async function reload() {
  try {
    await loadSession({ seedMonth: true, loadWineList: true });
    if (!routeAfterAccess()) return;
    render();
  } catch {
    boardEl.innerHTML = '<div class="empty">Could not load allocations. Retry with the refresh button — local changes are kept.</div>';
  }
}

function bind() {
  bindMonthNav(async (delta) => {
    state.month = shiftMonth(state.month, delta);
    state.selectedAccounts.clear();
    await loadMonth();
    render('push');
  });
  producerNav.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-id]');
    if (!chip) return;
    state.producerId = chip.dataset.id;
    state.wineId = null;
    state.selectedAccounts.clear();
    render('push');
  });
  wineNav.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-id]');
    if (!chip) return;
    if (chip.dataset.id !== state.wineId) state.selectedAccounts.clear();
    state.wineId = chip.dataset.id;
    render('push');
  });
  boardEl.addEventListener('input', onBoardInput);
  boardEl.addEventListener('click', onBoardClick);
  document.getElementById('allocPlus').addEventListener('click', () => nudgeSelected(1));
  allocMinus.addEventListener('click', () => nudgeSelected(-1));
  allocSpread.addEventListener('click', spreadSelected);
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
    if (!canEdit()) return;
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
  window.addEventListener('popstate', async () => {
    const previousMonth = state.month;
    applyViewFromUrl();
    state.selectedAccounts.clear();
    if (state.month !== previousMonth) await loadMonth();
    render('replace');
  });
}

setRender(render);
bind();
applyViewFromUrl();
boot(reload);
