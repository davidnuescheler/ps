export const assetQuery = new URL(import.meta.url).search;

const logger = await import(`./logger.js${assetQuery}`);

export const {
  catalogUrl,
  customersUrl,
  generateId,
  getEmail,
  isStaffEmail,
  loadEvents,
  monthKey,
  monthUrl,
  parseEmails,
  parseMonthKey,
  formatMonthLabel,
  postEvents,
  setEmail,
  shiftMonth,
} = logger;

const catalogMod = await import(`../scripts/catalog.js${assetQuery}`);
const { loadCatalog, prettyName, wineCategory } = catalogMod;

export const PAGE = document.body.dataset.page || 'place';

export const state = {
  month: monthKey(),
  customers: [],
  monthLog: [],
  producerId: null,
  wineId: null,
  showEmpty: false,
  source: 'server',
  list: [],
  pickerKey: '',
  selectedAccounts: new Set(),
  access: 'pending',
  accountId: null,
  legacyWines: new Map(),
  legacyProducers: new Map(),
};

let renderFn = () => {};

export function setRender(fn) {
  renderFn = fn;
}

export function customerEmails(customer) {
  return parseEmails(customer?.emails);
}

export function canEdit() {
  return state.access === 'staff';
}

export function resolveAccess(customers = model().customers) {
  const email = getEmail();
  if (!email) {
    state.access = 'pending';
    state.accountId = null;
    return state.access;
  }
  if (isStaffEmail(email)) {
    state.access = 'staff';
    state.accountId = null;
    return state.access;
  }
  const account = customers.find((customer) => customerEmails(customer).includes(email));
  if (account) {
    state.access = 'account';
    state.accountId = account.id;
    return state.access;
  }
  state.access = 'denied';
  state.accountId = null;
  return state.access;
}

const PAGE_SUB = {
  place: 'Allocation manager',
  allocations: 'Allocations',
  customers: 'Customers',
};

function waffleEls() {
  return {
    menu: document.getElementById('waffleMenu'),
    button: document.getElementById('waffleBtn'),
  };
}

function closeWaffle() {
  const { menu, button } = waffleEls();
  if (menu) menu.hidden = true;
  button?.setAttribute('aria-expanded', 'false');
}

function toggleWaffle() {
  const { menu, button } = waffleEls();
  if (!menu) return;
  const open = menu.hidden;
  menu.hidden = !open;
  button?.setAttribute('aria-expanded', String(open));
}

export function applyChrome() {
  const email = getEmail();
  const waffle = document.getElementById('waffle');
  const sessionEmail = document.getElementById('sessionEmail');
  const gateEmail = document.getElementById('gateEmail');
  const gateNote = document.getElementById('gateNote');
  const brandSub = document.querySelector('.brand-sub');
  const pageNav = document.getElementById('pageNav');

  document.body.classList.toggle('role-gate', state.access === 'pending' || state.access === 'denied');
  document.body.classList.toggle('role-staff', state.access === 'staff');
  document.body.classList.toggle('role-account', state.access === 'account');
  document.body.classList.toggle('role-denied', state.access === 'denied');
  if (waffle) waffle.hidden = !email;
  if (sessionEmail) {
    sessionEmail.hidden = !email;
    sessionEmail.textContent = email || 'Log out';
  }
  if (pageNav) pageNav.hidden = state.access !== 'staff';
  if (brandSub) {
    brandSub.textContent = state.access === 'account' ? 'Your allocation' : (PAGE_SUB[PAGE] || 'Allocation manager');
  }
  if (email && gateEmail && !gateEmail.value) gateEmail.value = email;
  if (gateNote) {
    if (state.access === 'denied') {
      gateNote.hidden = false;
      gateNote.textContent = 'That email isn’t on an allocation account. Ask Public Sediments to add it, or try a different address.';
    } else {
      gateNote.hidden = true;
      gateNote.textContent = '';
    }
  }
  if (!email) closeWaffle();
}

export function routeAfterAccess() {
  if (state.access !== 'account') return true;
  const params = new URLSearchParams(window.location.search);
  const customer = params.get('customer');
  if (PAGE === 'allocations' && customer === state.accountId) return true;
  params.set('customer', state.accountId);
  if (state.month) params.set('month', state.month);
  const next = `./allocations.html?${params.toString()}`;
  const here = `${window.location.pathname}${window.location.search}`;
  const dest = new URL(next, window.location.href);
  if (`${dest.pathname}${dest.search}` === here) return true;
  window.location.replace(next);
  return false;
}

export function isMonthKey(key) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key) && monthKey(parseMonthKey(key)) === key;
}

export function applyMonthFromUrl(search = window.location.search) {
  const month = new URLSearchParams(search).get('month') || '';
  if (isMonthKey(month)) state.month = month;
}

export function setSync(status) {
  const syncEl = document.getElementById('sync');
  if (!syncEl) return;
  syncEl.className = `sync ${status}`;
  const titles = {
    syncing: 'Syncing to sheet-logger…',
    synced: 'Synced',
    local: 'Saved locally — sheet-logger unreachable',
    error: 'Sync error',
  };
  syncEl.title = titles[status] || status;
}

export const BOTTLES_PER_CASE = 12;

export function splitCases(value) {
  const bottles = Math.round((Number(value) || 0) * BOTTLES_PER_CASE);
  const negative = bottles < 0;
  const abs = Math.abs(bottles);
  return {
    bottles,
    cases: Math.floor(abs / BOTTLES_PER_CASE) * (negative ? -1 : 1),
    leftover: (abs % BOTTLES_PER_CASE) * (negative ? -1 : 1),
  };
}

export function casesFromBottles(bottles) {
  return (Number(bottles) || 0) / BOTTLES_PER_CASE;
}

export function bottlesOf(value) {
  return Math.round((Number(value) || 0) * BOTTLES_PER_CASE);
}

export function casesFromParts(cases, bottles) {
  return (Number(cases) || 0) + (Number(bottles) || 0) / BOTTLES_PER_CASE;
}

export function qtyPhrase(value) {
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

export function renderUnit(kind, value, { editable = false, muted = false } = {}) {
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

export function renderFigure(value, { editable = false, pack = '', over = false } = {}) {
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

export function compactQty(value) {
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

export function packFrom(el) {
  const cases = el.querySelector('[data-part="cases"]')?.value;
  const bottles = el.querySelector('[data-part="bottles"]')?.value;
  return casesFromParts(cases, bottles);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

export function producerIdFor(name) {
  const slug = foldName(name).replace(/\s+/g, '-') || 'producer';
  return `prod-${slug}`.slice(0, 80);
}

export function wineIdFor(row) {
  const code = String(row['Item Code'] || row.itemCode || '').trim();
  if (!code) return '';
  return `wine-${code.replace(/[^0-9A-Za-z]+/g, '-')}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function colorForName(name) {
  const palette = ['#7a2436', '#c48a2a', '#6b3a5a', '#2c4a6e', '#44513d', '#9a6a42', '#4a1420', '#6d7b63'];
  const key = foldName(name);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  return palette[hash % palette.length];
}

export function wineFromRow(row) {
  const producerName = prettyName(row.Producer || row.producer || '');
  const id = wineIdFor(row) || row.id;
  if (!id) return null;
  return {
    id,
    producerId: row.producerId || producerIdFor(producerName),
    producer: producerName,
    name: prettyName(row.Wine || row.name || ''),
    vintage: String(row.Vintage || row.vintage || '').trim(),
    appellation: prettyName(row['Region/Sub Region'] || row.appellation || ''),
    color: row.color || wineCategory(row),
    format: row.format || '',
    itemCode: String(row['Item Code'] || row.itemCode || '').trim(),
  };
}

function bookFromList(rows) {
  const producers = new Map();
  const wines = [];
  rows.forEach((row) => {
    const wine = wineFromRow(row);
    if (!wine) return;
    if (!producers.has(wine.producerId)) {
      producers.set(wine.producerId, {
        id: wine.producerId,
        name: wine.producer,
        region: wine.appellation,
        color: colorForName(wine.producer),
      });
    }
    wines.push(wine);
  });
  return { producers, wines };
}

function customerEvents(events) {
  return events.filter((event) => String(event.op || '').startsWith('customer_'));
}

export function replayCustomers(changelog) {
  const customers = new Map();
  const customerOrder = [];

  [...changelog].sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || ''))).forEach((event) => {
    if (event.op === 'customer_added' && event.id) {
      customers.set(event.id, {
        id: event.id,
        name: event.name || '',
        kind: event.kind || 'account',
        emails: parseEmails(event.emails),
      });
      if (!customerOrder.includes(event.id)) customerOrder.push(event.id);
    } else if (event.op === 'customer_updated' && customers.has(event.id)) {
      const customer = customers.get(event.id);
      Object.assign(customer, {
        name: event.name ?? customer.name,
        kind: event.kind ?? customer.kind,
        emails: event.emails != null ? parseEmails(event.emails) : customer.emails,
      });
    } else if (event.op === 'customer_removed') {
      customers.delete(event.id);
    }
  });

  return customerOrder.map((id) => customers.get(id)).filter(Boolean);
}

function replayLegacyBook(changelog) {
  const producers = new Map();
  const wines = new Map();
  [...changelog].sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || ''))).forEach((event) => {
    if (event.op === 'producer_added' && event.id) {
      producers.set(event.id, {
        id: event.id,
        name: event.name || '',
        color: event.color || '#7a2436',
        region: event.region || '',
      });
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
    }
  });
  return { producers, wines };
}

export function replayMonth(changelog) {
  const allotments = new Map();
  const allocations = new Map();

  [...changelog].sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || ''))).forEach((event) => {
    if (event.op === 'allotment_set' && event.wineId) {
      allotments.set(event.wineId, {
        wineId: event.wineId,
        cases: Number(event.cases) || 0,
        wholesale: Number(event.wholesale) || 0,
        retail: Number(event.retail) || 0,
        name: event.name || '',
        vintage: event.vintage || '',
        producer: event.producer || '',
        producerId: event.producerId || '',
        color: event.color || '',
        appellation: event.appellation || '',
        format: event.format || '',
        itemCode: event.itemCode || '',
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

function wineFromAllotment(allot) {
  if (!allot?.name && !allot?.producer) return null;
  const producerName = allot.producer || '';
  return {
    id: allot.wineId,
    producerId: allot.producerId || producerIdFor(producerName),
    producer: producerName,
    name: allot.name || '',
    vintage: allot.vintage || '',
    appellation: allot.appellation || '',
    color: allot.color || 'red',
    format: allot.format || '',
    itemCode: allot.itemCode || '',
  };
}

export function model() {
  const customers = replayCustomers(state.customers);
  const month = replayMonth(state.monthLog);
  const book = bookFromList(state.list);
  const wines = new Map(book.wines.map((wine) => [wine.id, wine]));
  const producers = new Map(book.producers);
  month.allotments.forEach((allot, id) => {
    if (wines.has(id)) return;
    const wine = wineFromAllotment(allot) || state.legacyWines.get(id);
    if (!wine) return;
    wines.set(id, wine);
    if (wine.producerId && !producers.has(wine.producerId)) {
      producers.set(wine.producerId, state.legacyProducers.get(wine.producerId) || {
        id: wine.producerId,
        name: wine.producer || '',
        color: colorForName(wine.producer || wine.producerId),
        region: wine.appellation || '',
      });
    }
  });
  return {
    customers,
    wines: [...wines.values()],
    producers: [...producers.values()],
    ...month,
  };
}

export function winesOnMonth(data) {
  return data.wines.filter((wine) => data.allotments.has(wine.id));
}

export function wineLabel(wine) {
  return [wine.vintage, wine.name].filter(Boolean).join(' ');
}

export function customerAllocations(data, customerId) {
  if (!customerId) return [];
  const producerById = new Map(data.producers.map((producer) => [producer.id, producer]));
  return winesOnMonth(data).flatMap((wine) => {
    const alloc = data.allocations.get(`${wine.id}:${customerId}`);
    if (!alloc?.cases) return [];
    return [{
      wine,
      producer: producerById.get(wine.producerId),
      alloc,
    }];
  });
}

export async function save(kind, event) {
  return saveMany(kind, [event]);
}

export async function saveMany(kind, events) {
  if (!canEdit() || !events.length) return;
  const url = kind === 'month' ? monthUrl(state.month) : customersUrl();
  setSync('syncing');
  const stamped = events.map((event) => ({ ...event, ts: new Date().toISOString() }));
  if (kind === 'month') state.monthLog.push(...stamped);
  else state.customers.push(...stamped);
  renderFn();
  try {
    await postEvents(url, events);
    setSync(state.source === 'local' ? 'local' : 'synced');
  } catch {
    setSync('error');
  }
}

export async function loadMonth() {
  setSync('syncing');
  const result = await loadEvents(monthUrl(state.month));
  state.monthLog = result.events;
  state.source = result.source;
  await hydrateLegacyWines();
  setSync(result.source === 'server' ? 'synced' : 'local');
}

async function loadCustomers() {
  const current = await loadEvents(customersUrl());
  if (customerEvents(current.events).length) {
    state.customers = current.events;
    state.source = current.source;
    return;
  }
  const legacy = await loadEvents(catalogUrl());
  const migrated = customerEvents(legacy.events);
  if (migrated.length && isStaffEmail(getEmail())) {
    await postEvents(customersUrl(), migrated.map((event) => ({
      op: event.op,
      id: event.id,
      name: event.name,
      kind: event.kind,
      emails: event.emails || '',
    })));
    const seeded = await loadEvents(customersUrl());
    state.customers = customerEvents(seeded.events).length ? seeded.events : migrated;
    state.source = seeded.source;
    return;
  }
  state.customers = migrated;
  state.source = current.source || legacy.source;
}

async function hydrateLegacyWines() {
  const month = replayMonth(state.monthLog);
  const known = new Set(bookFromList(state.list).wines.map((wine) => wine.id));
  month.allotments.forEach((allot, id) => {
    if (known.has(id) || wineFromAllotment(allot) || state.legacyWines.has(id)) known.add(id);
  });
  const missing = [...month.allotments.keys()].filter((id) => !known.has(id));
  if (!missing.length) return;
  const legacy = await loadEvents(catalogUrl());
  const book = replayLegacyBook(legacy.events);
  book.wines.forEach((wine, id) => state.legacyWines.set(id, wine));
  book.producers.forEach((producer, id) => state.legacyProducers.set(id, producer));
}

export async function loadSession() {
  if (!getEmail()) {
    state.access = 'pending';
    applyChrome();
    return state.access;
  }
  setSync('syncing');
  try {
    await loadCustomers();
    resolveAccess();
    if (state.access === 'denied' || state.access === 'pending') {
      setSync(state.source === 'server' ? 'synced' : 'local');
      applyChrome();
      return state.access;
    }

    state.list = await loadCatalog();
    await loadMonth();
    await hydrateLegacyWines();

    resolveAccess();
    setSync(state.source === 'server' ? 'synced' : 'local');
    return state.access;
  } catch {
    setSync('error');
    applyChrome();
    throw new Error('load failed');
  }
}

export function bindChrome(reload) {
  const gateForm = document.getElementById('gateForm');
  const gateEmail = document.getElementById('gateEmail');
  const sessionEmail = document.getElementById('sessionEmail');
  const waffle = document.getElementById('waffle');
  const waffleBtn = document.getElementById('waffleBtn');

  gateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = gateForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      setEmail(gateEmail.value);
      await reload();
    } finally {
      submit.disabled = false;
    }
  });
  waffleBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleWaffle();
  });
  document.addEventListener('click', (event) => {
    if (waffle && !waffle.contains(event.target)) closeWaffle();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeWaffle();
  });
  sessionEmail?.addEventListener('click', () => {
    setEmail('');
    state.access = 'pending';
    state.accountId = null;
    if (gateEmail) gateEmail.value = '';
    applyChrome();
  });
}

export function bindMonthNav(onChange) {
  document.getElementById('prevMonth')?.addEventListener('click', () => onChange(-1));
  document.getElementById('nextMonth')?.addEventListener('click', () => onChange(1));
}

export async function boot(reload) {
  bindChrome(reload);
  applyMonthFromUrl();
  const storedEmail = getEmail();
  const gateEmail = document.getElementById('gateEmail');
  if (storedEmail) {
    if (gateEmail) gateEmail.value = storedEmail;
    await reload();
  } else {
    applyChrome();
  }
}
