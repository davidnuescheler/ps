export default function decorate(block) {
  const row = block.firstElementChild;
  if (!row) return;

  [...row.children].forEach((cell) => {
    if (cell.querySelector('picture')) {
      cell.classList.add('banner-media');
      const img = cell.querySelector('img');
      if (img && !img.alt) cell.querySelector('picture')?.setAttribute('aria-hidden', 'true');
    } else if (cell.textContent.trim()) {
      cell.classList.add('banner-copy');
    }
  });
}
