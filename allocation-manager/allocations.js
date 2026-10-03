const {
  applyChrome,
  applyMonthFromUrl,
  bindMonthNav,
  boot,
  canEdit,
  compactQty,
  customerAllocations,
  customerEmails,
  escapeHtml,
  formatMonthLabel,
  loadMonth,
  loadSession,
  model,
  qtyPhrase,
  renderFigure,
  routeAfterAccess,
  setRender,
  shiftMonth,
  state,
  wineLabel,
} = await import(`./shared.js${new URL(import.meta.url).search}`);

const boardEl = document.getElementById('board');
const monthLabel = document.getElementById('monthLabel');
const statsEl = document.getElementById('stats');

function customerIdFromUrl(search = window.location.search) {
  return new URLSearchParams(search).get('customer') || '';
}

function urlForView(customerId = customerIdFromUrl()) {
  const params = new URLSearchParams();
  params.set('month', state.month);
  if (customerId) params.set('customer', customerId);
  return `${window.location.pathname}?${params.toString()}`;
}

function syncLocation(mode = 'replace') {
  const url = urlForView();
  const here = `${window.location.pathname}${window.location.search}`;
  if (here === url) return;
  if (mode === 'push') history.pushState({ month: state.month, customer: customerIdFromUrl() }, '', url);
  else history.replaceState({ month: state.month, customer: customerIdFromUrl() }, '', url);
}

function customerHref(id) {
  const params = new URLSearchParams();
  params.set('customer', id);
  params.set('month', state.month);
  return `./allocations.html?${params.toString()}`;
}

function setMonthControls(open) {
  document.getElementById('prevMonth').hidden = !open;
  document.getElementById('nextMonth').hidden = !open;
}

function allocatedCases(data, customerId) {
  return customerAllocations(data, customerId).reduce((sum, row) => sum + (row.alloc.cases || 0), 0);
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function pricedRows(data, customerId) {
  return customerAllocations(data, customerId).map((row) => {
    const retail = Number(data.allotments.get(row.wine.id)?.retail) || 0;
    return { ...row, retail, amount: (row.alloc.cases || 0) * retail };
  });
}

function printHead(customer) {
  return `
    <header class="print-head">
      <p class="print-kicker">Public Sediments</p>
      <h1>Allocation</h1>
      <p class="print-account">${escapeHtml(customer.name)}</p>
      <p class="print-month">${escapeHtml(formatMonthLabel(state.month))}</p>
    </header>
  `;
}

function renderPicker(data) {
  setMonthControls(true);
  monthLabel.textContent = formatMonthLabel(state.month);
  const totals = data.customers.map((customer) => allocatedCases(data, customer.id));
  const monthTotal = totals.reduce((sum, value) => sum + value, 0);
  statsEl.innerHTML = `
    <div class="stat"><b>${compactQty(monthTotal)}</b><span>Allocated</span></div>
  `;
  if (!data.customers.length) {
    boardEl.innerHTML = '<div class="empty">No customers yet. Add them on the customers page.</div>';
    return;
  }
  boardEl.innerHTML = `
    <p class="muted pick-lead">Choose an account</p>
    <ul class="pick-list">
      ${data.customers.map((customer, index) => `
        <li>
          <a class="pick-link ${totals[index] ? '' : 'is-empty'}" href="${escapeHtml(customerHref(customer.id))}">
            <span>
              <span class="account-name">${escapeHtml(customer.name)}</span>
              <span class="muted">${escapeHtml(customerEmails(customer).join(', ') || '')}</span>
            </span>
            ${compactQty(totals[index])}
          </a>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderCustomer(data, customerId) {
  const customer = data.customers.find((entry) => entry.id === customerId);
  setMonthControls(true);
  monthLabel.textContent = formatMonthLabel(state.month);
  if (!customer) {
    statsEl.innerHTML = '';
    boardEl.innerHTML = `
      <div class="empty">
        That account wasn’t found.
        ${canEdit() ? '<a class="text-btn" href="./allocations.html">All accounts</a>' : ''}
      </div>
    `;
    return;
  }
  const rows = pricedRows(data, customer.id);
  const total = allocatedCases(data, customer.id);
  const totalAmount = rows.reduce((sum, row) => sum + (row.amount || 0), 0);
  statsEl.innerHTML = `
    <div class="stat"><b>${compactQty(total)}</b><span>Allocated</span></div>
  `;
  const back = canEdit()
    ? `<p class="alloc-back screen-only"><a href="./allocations.html?month=${encodeURIComponent(state.month)}">All accounts</a></p>`
    : '';
  if (!rows.length) {
    boardEl.innerHTML = `
      <article class="alloc-sheet">
        ${printHead(customer)}
        ${back}
        <h2 class="account-head">${escapeHtml(customer.name)}</h2>
        <div class="empty">No allocation this month.</div>
      </article>
    `;
    return;
  }
  boardEl.innerHTML = `
    <article class="alloc-sheet">
      ${printHead(customer)}
      ${back}
      <h2 class="account-head">${escapeHtml(customer.name)}</h2>
      <ul class="alloc-list">
        <li class="alloc-cols print-only" aria-hidden="true">
          <span>Wine</span>
          <span>Quantity</span>
          <span>Price</span>
          <span>Total</span>
        </li>
        ${rows.map((row) => `
          <li class="alloc-row">
            <span class="alloc-wine">
              <span class="account-name">${escapeHtml(wineLabel(row.wine))}</span>
              <span class="muted">${escapeHtml(row.producer?.name || '')}</span>
            </span>
            <span class="alloc-qty">
              ${renderFigure(row.alloc.cases)}
              <span class="alloc-qty-words print-only">${escapeHtml(qtyPhrase(row.alloc.cases))}</span>
            </span>
            ${row.alloc.status
              ? `<span class="status screen-only ${escapeHtml(row.alloc.status)}">${escapeHtml(row.alloc.status)}</span>`
              : '<span class="screen-only"></span>'}
            <span class="alloc-price print-only">${row.retail ? `${formatMoney(row.retail)} / case` : '—'}</span>
            <span class="alloc-amount print-only">${formatMoney(row.amount)}</span>
          </li>
        `).join('')}
      </ul>
      <p class="alloc-totals print-only">
        <span>Total</span>
        <span>${escapeHtml(qtyPhrase(total))}</span>
        <span></span>
        <span>${formatMoney(totalAmount)}</span>
      </p>
    </article>
  `;
}

function render(historyMode = 'replace') {
  applyChrome();
  if (state.access !== 'staff' && state.access !== 'account') return;
  const data = model();
  const customerId = state.access === 'account' ? state.accountId : customerIdFromUrl();
  if (!customerId) renderPicker(data);
  else renderCustomer(data, customerId);
  syncLocation(historyMode);
}

async function reload() {
  try {
    await loadSession();
    if (!routeAfterAccess()) return;
    render();
  } catch {
    boardEl.innerHTML = '<div class="empty">Could not load allocations. Retry with the refresh button — local changes are kept.</div>';
  }
}

setRender(render);
bindMonthNav(async (delta) => {
  state.month = shiftMonth(state.month, delta);
  await loadMonth();
  render('push');
});
window.addEventListener('popstate', async () => {
  const previousMonth = state.month;
  applyMonthFromUrl();
  if (state.month !== previousMonth) await loadMonth();
  render('replace');
});
boot(reload);
