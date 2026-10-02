import {
  prettyName,
  loadCatalog,
  CAT_LABEL,
  wineCategory,
  formatPrice,
  wineHaystack,
  highlight,
} from '../../scripts/catalog.js';

const DEFAULT_PAGE_SIZE = 12;

const SWATCH = {
  skin: 'linear-gradient(160deg, #e8b56b, #c45e2b 55%, #7a2436)',
  red: 'linear-gradient(160deg, #c46a7a, #7a2436 50%, #2a0e16)',
  white: 'linear-gradient(160deg, #f0e2b2, #d9c27a 40%, #8a9e72)',
  sparkling: 'linear-gradient(160deg, #f7f1dc, #e8d7a8 45%, #c9a07a)',
  rose: 'linear-gradient(160deg, #f3c3c8, #d9899a 48%, #7a2436)',
  other: 'linear-gradient(160deg, #e8d7c0, #c9a07a 50%, #6d7b63)',
};

function noteText(row) {
  const t = String(row['Tasting Notes'] || '').trim();
  if (t.length > 24 && !/^\d{4}$/.test(t) && t.toLowerCase() !== 'tasting notes') return t;
  return '';
}

function originalSpan(text) {
  const span = document.createElement('span');
  span.dataset.original = text;
  span.textContent = text;
  return span;
}

function buildCard(row, inquireHref) {
  const cat = wineCategory(row);
  const region = prettyName(row['Region/Sub Region']);
  const vintage = String(row.Vintage || '').trim();
  const size = String(row.Size || '').replace(/\s+/g, '').toLowerCase();
  const magnum = /1\.5l|1500ml/.test(size) || /magnum/i.test(row.Wine || '');
  const metaLeft = [region, vintage, magnum ? 'Magnum' : ''].filter(Boolean).join(' · ');
  const note = noteText(row);
  const price = formatPrice(row['UT Per BTL']);
  const producer = prettyName(row.Producer);
  const catLabel = CAT_LABEL[cat] || 'Wine';

  const article = document.createElement('article');
  article.className = 'wine';
  article.dataset.cat = cat;
  article.dataset.search = wineHaystack(row, cat, note, price);

  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  swatch.style.background = SWATCH[cat] || SWATCH.other;

  const meta = document.createElement('div');
  meta.className = 'wine-meta';
  meta.append(originalSpan(metaLeft), originalSpan(catLabel));

  const title = document.createElement('h3');
  title.dataset.original = row.Wine || '';
  title.textContent = row.Wine || '';

  const producerEl = document.createElement('p');
  producerEl.className = 'producer';
  producerEl.dataset.original = producer;
  producerEl.textContent = producer;

  const noteEl = document.createElement('p');
  if (note) {
    noteEl.dataset.original = note;
    noteEl.textContent = note;
  }

  const foot = document.createElement('div');
  foot.className = 'wine-foot';
  const priceEl = document.createElement('span');
  if (price) {
    priceEl.className = 'price';
    priceEl.dataset.original = price;
    priceEl.textContent = price;
  }
  const inquire = document.createElement('a');
  inquire.className = 'inquire';
  inquire.href = inquireHref;
  inquire.textContent = 'Inquire';
  foot.append(priceEl, inquire);

  article.append(swatch, meta, title, producerEl, noteEl, foot);
  return article;
}

export default async function decorate(widget) {
  if (widget.dataset.winesInitialized === 'true') return;
  widget.dataset.winesInitialized = 'true';

  const filters = widget.querySelector('.wines-filters');
  const chips = [...widget.querySelectorAll('.chip')];
  const search = widget.querySelector('.wines-search input');
  const empty = widget.querySelector('.wines-empty');
  const grid = widget.querySelector('.wines-grid');
  const more = widget.querySelector('.wines-more');
  const moreBtn = more?.querySelector('button');
  const pageSize = parseInt(widget.dataset.pageSize, 10) || DEFAULT_PAGE_SIZE;
  const inquireHref = widget.dataset.inquire || '#visit';

  let showAll = false;

  const currentTag = () => filters.querySelector('.chip[aria-pressed="true"]')?.dataset.filter || 'all';

  const searchTokens = () => String(search?.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);

  const applyHighlights = (wine, query) => {
    wine.querySelectorAll('[data-original]').forEach((el) => {
      el.innerHTML = highlight(el.dataset.original, query);
    });
  };

  const applyVisibility = () => {
    const tag = currentTag();
    const toks = searchTokens();
    const query = search?.value.trim() || '';
    let shown = 0;
    let matched = 0;

    grid.querySelectorAll('.wine').forEach((wine) => {
      const catMatch = tag === 'all' || wine.dataset.cat === tag;
      const hay = wine.dataset.search || '';
      const textMatch = !toks.length || toks.every((tok) => hay.includes(tok));
      const match = catMatch && textMatch;
      if (match) matched += 1;
      const hide = !match || (!showAll && !toks.length && shown >= pageSize);
      if (match && !hide) shown += 1;
      wine.classList.toggle('is-hidden', hide);
      applyHighlights(wine, match ? query : '');
    });

    if (empty) empty.hidden = matched !== 0;
    if (!more || !moreBtn) return;
    if (matched > pageSize && !toks.length) {
      more.hidden = false;
      moreBtn.textContent = showAll ? 'Show fewer wines' : `Show all ${matched} wines`;
    } else {
      more.hidden = true;
      if (!toks.length) showAll = false;
    }
  };

  filters?.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip || !filters.contains(chip)) return;
    chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    showAll = false;
    applyVisibility();
  });

  search?.addEventListener('input', () => {
    showAll = false;
    applyVisibility();
  });

  moreBtn?.addEventListener('click', () => {
    showAll = !showAll;
    applyVisibility();
    if (!showAll) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const wines = await loadCatalog(widget);
  if (!wines.length) {
    grid.replaceChildren(Object.assign(document.createElement('p'), {
      className: 'wines-status',
      textContent: 'The current list could not be loaded. Try again shortly.',
    }));
    if (more) more.hidden = true;
    return;
  }

  grid.replaceChildren(...wines.map((row) => buildCard(row, inquireHref)));
  showAll = false;
  applyVisibility();
}
