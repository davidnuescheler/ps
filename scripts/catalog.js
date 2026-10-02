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

export const CAT_LABEL = {
  skin: 'Skin contact',
  red: 'Red',
  white: 'White',
  sparkling: 'Sparkling',
  rose: 'Rosé',
  other: 'Wine',
};

export function wineCategory(row) {
  const t = `${row.Wine || ''} ${row['Region/Sub Region'] || ''}`.toLowerCase();
  if (/pet-?nat|pétillant|sparkling|champagne|crémant|cap classique|mousseux|col fondo|sekt|frizzante/.test(t)) return 'sparkling';
  if (/rosé|rosato|rosado|\brose\b|\brosa\b/.test(t)) return 'rose';
  if (/orange|macerat|skin contact|amber|orangée|orangee/.test(t)) return 'skin';
  if (/\bwhite\b|\bblanc\b|bianco|weiss|weiß|blanco|chardonnay|riesling|gr[uü]ner|gew[uü]rz|chenin|aligot|sauvignon|pinot gris|friulano/.test(t)) return 'white';
  if (/\bred\b|\brouge\b|rosso|tinto|noir|syrah|shiraz|gamay|cabernet|merlot|blaufr|zweigelt|grenache|pinot noir/.test(t)) return 'red';
  return 'other';
}

export function parseMoney(raw) {
  const n = Number(String(raw || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n < 2) return 0;
  return Math.round(n);
}

export function formatPrice(raw) {
  const n = parseMoney(raw);
  return n ? `$${n}` : '';
}

export function wineHaystack(row, cat, note, price) {
  return [
    row.Wine,
    row.Producer,
    prettyName(row.Producer),
    prettyName(row.Wine),
    row['Region/Sub Region'],
    row.Vintage,
    row.Size,
    row['Item Code'],
    note,
    price,
    CAT_LABEL[cat],
  ].filter(Boolean).join(' ').toLowerCase();
}

export function highlight(text, query) {
  const safe = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const toks = [...new Set(String(query || '').trim().split(/\s+/).filter(Boolean))];
  if (!toks.length) return safe;
  const pattern = toks
    .sort((a, b) => b.length - a.length)
    .map((tok) => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return safe.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}
