export const assetQuery = new URL(import.meta.url).search;

const logger = await import(`./logger.js${assetQuery}`);
const seed = await import(`./seed.js${assetQuery}`);

export const {
  catalogUrl,
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

const { catalogSeedEvents, monthSeedEvents } = seed;

export const PAGE = document.body.dataset.page || 'place';

export const state = {
  month: monthKey(),
  catalog: [],
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

export function replayCatalog(changelog) {
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

export function model() {
  return { ...replayCatalog(state.catalog), ...replayMonth(state.monthLog) };
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
  const url = kind === 'catalog' ? catalogUrl() : monthUrl(state.month);
  setSync('syncing');
  const stamped = events.map((event) => ({ ...event, ts: new Date().toISOString() }));
  if (kind === 'catalog') state.catalog.push(...stamped);
  else state.monthLog.push(...stamped);
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
  setSync(result.source === 'server' ? 'synced' : 'local');
}

function idsOf(items) {
  return new Set(items.map((item) => item.id));
}

async function seedCatalogIfNeeded() {
  const data = model();
  const producerIds = idsOf(data.producers);
  const customerIds = idsOf(data.customers);
  const wineIds = idsOf(data.wines);
  const catalogMissing = catalogSeedEvents().filter((event) => {
    if (event.op === 'producer_added') return !producerIds.has(event.id);
    if (event.op === 'customer_added') return !customerIds.has(event.id);
    if (event.op === 'wine_added') return !wineIds.has(event.id);
    return false;
  });
  if (!catalogMissing.length) return;
  await postEvents(catalogUrl(), catalogMissing);
  const seeded = await loadEvents(catalogUrl());
  if (seeded.events.length >= state.catalog.length) state.catalog = seeded.events;
  else {
    catalogMissing.forEach((event) => {
      state.catalog.push({ ...event, ts: new Date().toISOString() });
    });
  }
}

async function seedMonthIfNeeded() {
  const data = model();
  const existingAllot = new Set(data.allotments.keys());
  const existingAlloc = new Set(data.allocations.keys());
  const monthMissing = monthSeedEvents().filter((event) => {
    if (event.op === 'allotment_set') return !existingAllot.has(event.wineId);
    if (event.op === 'allocation_set') {
      return !existingAlloc.has(`${event.wineId}:${event.customerId}`);
    }
    return false;
  });
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
}

export async function loadSession({ seedMonth = false, loadWineList = false } = {}) {
  if (!getEmail()) {
    state.access = 'pending';
    applyChrome();
    return state.access;
  }
  setSync('syncing');
  try {
    const catalog = await loadEvents(catalogUrl());
    state.catalog = catalog.events;
    state.source = catalog.source;
    resolveAccess();
    if (state.access === 'denied' || state.access === 'pending') {
      setSync(state.source === 'server' ? 'synced' : 'local');
      applyChrome();
      return state.access;
    }

    if (state.access === 'staff') {
      if (loadWineList) {
        const catalogMod = await import(`../scripts/catalog.js${assetQuery}`);
        state.list = await catalogMod.loadCatalog();
      }
      await seedCatalogIfNeeded();
    }

    await loadMonth();
    if (state.access === 'staff' && seedMonth) await seedMonthIfNeeded();

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
