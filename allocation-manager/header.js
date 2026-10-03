(() => {
  const header = document.querySelector('header');
  if (!header) return;

  const page = document.body.dataset.page || 'place';
  const sub = {
    place: 'Allocation manager',
    allocations: 'Allocations',
    customers: 'Customers',
  }[page] || 'Allocation manager';
  const current = (id) => (page === id ? ' aria-current="page"' : '');

  header.classList.add('site-header');
  header.innerHTML = `
    <div class="nav-bar">
      <a class="brand" href="../">
        <span class="icon-mark" aria-hidden="true"></span>
        <span>
          <span class="brand-name">Public Sediments</span>
          <span class="brand-sub">${sub}</span>
        </span>
      </a>
      <div class="header-tools">
        <div class="waffle" id="waffle" hidden>
          <button class="waffle-btn" type="button" id="waffleBtn" aria-expanded="false" aria-haspopup="true" aria-controls="waffleMenu" aria-label="Menu">
            <span class="waffle-icon" aria-hidden="true"></span>
          </button>
          <div class="waffle-menu" id="waffleMenu" hidden>
            <nav class="waffle-nav" id="pageNav" hidden>
              <a href="./index.html"${current('place')}>Place</a>
              <a href="./allocations.html"${current('allocations')}>Allocations</a>
              <a href="./customers.html"${current('customers')}>Customers</a>
            </nav>
            <button class="session" type="button" id="sessionEmail" title="Log out">Log out</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const waffle = document.getElementById('waffle');
  if (waffle) waffle.hidden = !localStorage.getItem('psAlloc_email');
})();
