async function inlineIcon(icon) {
  const img = icon.querySelector('img');
  if (!img?.src) return;
  try {
    const res = await fetch(img.src);
    if (!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
    const svg = doc.documentElement;
    if (!(svg instanceof SVGElement)) return;
    svg.setAttribute('aria-hidden', 'true');
    icon.replaceChildren(document.importNode(svg, true));
  } catch {
    // keep the img fallback
  }
}

function isIconOnly(col) {
  if (!col.querySelector('.icon')) return false;
  if (col.querySelector('picture, a, h1, h2, h3, h4, h5, h6')) return false;
  return !col.textContent.trim();
}

function decorateStats(col) {
  col.querySelectorAll('ul').forEach((ul) => {
    const items = [...ul.children].filter((li) => li.tagName === 'LI');
    if (items.length < 2) return;
    const isStats = items.every((li) => {
      const strong = li.querySelector('strong');
      return strong && strong.textContent.trim().length <= 8;
    });
    if (isStats) ul.classList.add('columns-stats');
  });
}

function extractAccordionTitle(li) {
  const strong = li.querySelector('strong');
  if (!strong) return '';
  const title = strong.textContent.trim();
  const titleP = strong.closest('p');
  if (titleP && titleP.parentElement === li) {
    const leftover = [...titleP.childNodes]
      .filter((node) => node !== strong)
      .map((node) => node.textContent)
      .join('')
      .trim();
    titleP.remove();
    if (leftover) {
      const p = document.createElement('p');
      p.textContent = leftover;
      li.prepend(p);
    }
  } else {
    strong.remove();
  }
  return title;
}

function decorateAccordion(col) {
  col.querySelectorAll('ol, ul').forEach((list) => {
    if (list.classList.contains('columns-stats')) return;
    const items = [...list.children].filter((li) => li.tagName === 'LI');
    if (items.length < 2) return;
    const isAccordion = items.every((li) => {
      const strong = li.querySelector('strong');
      return strong && li.textContent.trim().length > strong.textContent.trim().length + 8;
    });
    if (!isAccordion) return;

    const accordion = document.createElement('div');
    accordion.className = 'columns-accordion';
    items.forEach((li, index) => {
      const details = document.createElement('details');
      details.className = 'columns-std';
      if (index === 0) details.open = true;

      const summary = document.createElement('summary');
      summary.textContent = extractAccordionTitle(li);
      details.append(summary, ...li.childNodes);
      accordion.append(details);
    });
    list.replaceWith(accordion);
  });
}

function splitCaption(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const bySep = trimmed.split(/\s*(?:[•●|/]|—|--)\s*/).map((part) => part.trim()).filter(Boolean);
  if (bySep.length > 1) return bySep;
  const byCap = trimmed.split(/\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean);
  if (byCap.length > 1) return byCap;
  return [trimmed];
}

function decorateImageCol(col) {
  const pic = col.querySelector('picture');
  if (!pic) return;
  if (col.querySelector('h1, h2, h3, h4, h5, h6, ul')) return;

  col.classList.add('columns-img-col');

  const leftover = col.cloneNode(true);
  leftover.querySelectorAll('picture, img').forEach((el) => el.remove());
  const parts = splitCaption(leftover.textContent || '');

  col.replaceChildren(pic);
  if (!parts.length) return;

  const caption = document.createElement('p');
  caption.className = 'columns-img-caption';
  parts.forEach((part) => {
    const span = document.createElement('span');
    span.textContent = part;
    caption.append(span);
  });
  col.append(caption);
}

export default async function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  await Promise.all([...block.children].map(async (row) => {
    await Promise.all([...row.children].map(async (col) => {
      decorateImageCol(col);

      if (isIconOnly(col)) {
        col.classList.add('columns-icon-col');
        const icon = col.querySelector('.icon');
        if (icon) await inlineIcon(icon);
      }

      decorateStats(col);
      decorateAccordion(col);
    }));
  }));
}
