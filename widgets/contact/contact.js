const THANKS = 'Thank you. We will write back from Salt Lake City.';
const DEFAULT_EMAIL = 'hello@publicsediments.com';

function submitUrl(email) {
  return `https://formsubmit.co/ajax/${encodeURIComponent(email)}`;
}

export default async function decorate(widget) {
  if (widget.dataset.contactInitialized === 'true') return;
  widget.dataset.contactInitialized = 'true';

  const form = widget.querySelector('.contact-form');
  const note = widget.querySelector('.contact-note');
  const submit = form?.querySelector('button[type="submit"]');
  if (!form) return;

  const email = widget.dataset.email || DEFAULT_EMAIL;
  form.action = `https://formsubmit.co/${encodeURIComponent(email)}`;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (note) note.textContent = '';
    if (submit) submit.disabled = true;

    try {
      const res = await fetch(submitUrl(email), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === 'false' || data.success === false) {
        throw new Error(data.message || String(res.status));
      }
      form.reset();
      if (note) note.textContent = widget.dataset.thanks || THANKS;
    } catch {
      if (note) note.textContent = 'Something went wrong. Try again or write us directly.';
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}
