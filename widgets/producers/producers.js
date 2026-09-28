import { loadCatalog, uniqueGrowers, prettyName } from '../../scripts/catalog.js';

const DEFAULT_PAGE_SIZE = 12;

function growerCard(grower) {
  const countLabel = grower.count === 1
    ? '1 wine on the current list'
    : `${grower.count} wines on the current list`;

  const article = document.createElement('article');
  article.className = 'grower-card';

  const place = document.createElement('p');
  place.className = 'place';
  place.textContent = prettyName(grower.region).replace(/[()]/g, '').trim();

  const title = document.createElement('h3');
  title.textContent = prettyName(grower.name);

  const count = document.createElement('p');
  count.textContent = countLabel;

  article.append(place, title, count);
  return article;
}

export default async function decorate(widget) {
  if (widget.dataset.producersInitialized === 'true') return;
  widget.dataset.producersInitialized = 'true';

  const grid = widget.querySelector('.producers-grid');
  const more = widget.querySelector('.producers-more');
  const moreBtn = more?.querySelector('button');
  const pageSize = parseInt(widget.dataset.pageSize, 10) || DEFAULT_PAGE_SIZE;

  let showAll = false;

  const applyVisibility = () => {
    const cards = [...grid.querySelectorAll('.grower-card')];
    cards.forEach((card, index) => {
      card.classList.toggle('is-hidden', !showAll && index >= pageSize);
    });
    if (!more || !moreBtn) return;
    if (cards.length > pageSize) {
      more.hidden = false;
      moreBtn.textContent = showAll ? 'Show fewer growers' : `Show all ${cards.length} growers`;
    } else {
      more.hidden = true;
      showAll = false;
    }
  };

  moreBtn?.addEventListener('click', () => {
    showAll = !showAll;
    applyVisibility();
    if (!showAll) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const wines = await loadCatalog(widget);
  const growers = uniqueGrowers(wines);
  if (!growers.length) {
    grid.replaceChildren(Object.assign(document.createElement('p'), {
      className: 'producers-status',
      textContent: 'Growers could not be loaded.',
    }));
    if (more) more.hidden = true;
    return;
  }

  grid.replaceChildren(...growers.map(growerCard));
  showAll = false;
  applyVisibility();
}
