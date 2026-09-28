import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);
  if (!fragment) return;

  block.textContent = '';
  const footer = document.createElement('div');
  footer.className = 'footer-content';
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  const classes = ['brand', 'links', 'contact', 'legal'];
  [...footer.children].forEach((section, i) => {
    if (classes[i]) section.classList.add(`footer-${classes[i]}`);
  });

  footer.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener';
  });

  block.append(footer);
}
