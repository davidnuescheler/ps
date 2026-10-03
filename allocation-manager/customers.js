const {
  applyChrome,
  boot,
  canEdit,
  customerEmails,
  escapeHtml,
  generateId,
  loadSession,
  model,
  parseEmails,
  routeAfterAccess,
  save,
  setRender,
  state,
} = await import(`./shared.js${new URL(import.meta.url).search}`);

const boardEl = document.getElementById('board');
const customerDialog = document.getElementById('customerDialog');
const customerDialogTitle = document.getElementById('customerDialogTitle');

let editingCustomerId = null;

function openCustomerDialog(customer = null) {
  if (!canEdit()) return;
  editingCustomerId = customer?.id || null;
  customerDialogTitle.textContent = customer ? 'Edit customer' : 'Add customer';
  document.getElementById('customerName').value = customer?.name || '';
  document.getElementById('customerEmails').value = customerEmails(customer).join('\n');
  customerDialog.showModal();
}

function closeCustomerDialog() {
  editingCustomerId = null;
  customerDialog.close();
  document.getElementById('customerForm').reset();
}

function render() {
  applyChrome();
  if (state.access !== 'staff') return;
  const data = model();
  if (!data.customers.length) {
    boardEl.innerHTML = '<div class="empty">No customers yet. Add one to start placing allocations.</div>';
    return;
  }
  boardEl.innerHTML = `
    <ul class="customer-list">
      ${data.customers.map((customer) => `
        <li class="customer-card ${customer.kind === 'transfer' ? 'transfer' : ''}">
          <button type="button" class="customer-edit" data-customer="${escapeHtml(customer.id)}">
            <span class="account-name">${escapeHtml(customer.name)}</span>
            <span class="muted">${escapeHtml(customerEmails(customer).join(', ') || 'no email')}</span>
          </button>
          <a class="text-btn" href="./allocations.html?customer=${encodeURIComponent(customer.id)}">Allocations</a>
        </li>
      `).join('')}
    </ul>
  `;
}

async function reload() {
  try {
    await loadSession();
    if (!routeAfterAccess()) return;
    render();
  } catch {
    boardEl.innerHTML = '<div class="empty">Could not load customers. Retry with the refresh button — local changes are kept.</div>';
  }
}

setRender(render);
document.getElementById('addCustomerBtn').addEventListener('click', () => openCustomerDialog());
document.getElementById('customerCancel').addEventListener('click', closeCustomerDialog);
boardEl.addEventListener('click', (event) => {
  const item = event.target.closest('[data-customer]');
  if (!item) return;
  const customer = model().customers.find((entry) => entry.id === item.dataset.customer);
  if (customer) openCustomerDialog(customer);
});
document.getElementById('customerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!canEdit()) return;
  const name = document.getElementById('customerName').value.trim();
  const emails = parseEmails(document.getElementById('customerEmails').value).join(', ');
  if (editingCustomerId) {
    await save('catalog', {
      op: 'customer_updated',
      id: editingCustomerId,
      name,
      emails,
    });
  } else {
    await save('catalog', {
      op: 'customer_added',
      id: generateId(),
      name,
      emails,
    });
  }
  closeCustomerDialog();
});
boot(reload);
