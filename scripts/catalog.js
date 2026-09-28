export const DEFAULT_CATALOG = '/data/wines-2026-09.json';
export const FALLBACK_CATALOG = 'https://main--ps--davidnuescheler.aem.live/data/wines-2026-09.json';

export function prettyName(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  const letters = s.replace(/[^\p{L}]/gu, '');
  const caps = (s.match(/\p{Lu}/gu) || []).length;
  if (letters && caps / letters.length >= 0.6) {
    return s.toLowerCase().replace(/(^|[\s(/'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  }
  return s;
}

export function isKeg(row) {
  const size = String(row.Size || '').replace(/\s+/g, '').toLowerCase();
  const name = String(row.Wine || '').toLowerCase();
  return /20\.?0?l/.test(size) || name.includes('keg');
}

export function catalogUrls(widget) {
  const authored = widget?.dataset?.src;
  const urls = [];
  if (authored) urls.push(authored);
  urls.push(DEFAULT_CATALOG);
  if (!urls.includes(FALLBACK_CATALOG)) urls.push(FALLBACK_CATALOG);
  return urls;
}

export async function loadRows(urls) {
  for (let i = 0; i < urls.length; i += 1) {
    try {
      const res = await fetch(urls[i]);
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length) return json.data;
    } catch {
      /* try next source */
    }
  }
  return [];
}

export function bottledWines(rows) {
  return rows.filter((row) => String(row.Wine || '').trim() && !isKeg(row));
}

export async function loadCatalog(widget) {
  return bottledWines(await loadRows(catalogUrls(widget)));
}

export function uniqueGrowers(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const name = String(row.Producer || '').trim();
    if (!name) return;
    const entry = map.get(name) || { name, region: row['Region/Sub Region'] || '', count: 0 };
    entry.count += 1;
    if (!entry.region) entry.region = row['Region/Sub Region'] || '';
    map.set(name, entry);
  });
  return [...map.values()].sort((a, b) => prettyName(a.name).localeCompare(prettyName(b.name)));
}
