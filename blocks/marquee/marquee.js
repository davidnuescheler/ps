function splitItems(text) {
  const byBullet = text.split(/\s*[●•]\s*/u).map((part) => part.trim()).filter(Boolean);
  if (byBullet.length > 1) return byBullet;
  return text.split(/\s*[,|\n]\s*/).map((part) => part.trim()).filter(Boolean);
}

function collectItems(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  return cells.flatMap((cell) => {
    const listItems = [...cell.querySelectorAll('li')].map((li) => li.textContent.trim()).filter(Boolean);
    if (listItems.length) return listItems;
    return splitItems(cell.textContent || '');
  });
}

function buildGroup(items) {
  const group = document.createElement('div');
  group.className = 'marquee-group';
  items.forEach((item) => {
    const word = document.createElement('span');
    word.textContent = item;
    group.append(word);
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = '●';
    group.append(dot);
  });
  return group;
}

export default function decorate(block) {
  const items = collectItems(block);
  if (!items.length) return;

  const copies = items.length < 6 ? 3 : 1;
  const sequence = Array.from({ length: copies }, () => items).flat();
  const group = buildGroup(sequence);
  const track = document.createElement('div');
  track.className = 'marquee-track';
  track.append(group, group.cloneNode(true));

  block.replaceChildren(track);
  block.setAttribute('aria-hidden', 'true');
}
