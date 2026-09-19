export const LOGGER_ORIGIN = 'https://sheet-logger.david8603.workers.dev';
export const API_BASE = `${LOGGER_ORIGIN}/publicsediments/allocation-manager`;

const USER_KEY = 'psAlloc_user';

export function generateId() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let id = '';
  for (let i = 0; i < 8; i += 1) {
    id += chars[Math.floor(Math.random() * 62)];
  }
  return id;
}

export function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function parseMonthKey(key) {
  const [year, month] = String(key).split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function formatMonthLabel(key) {
  return parseMonthKey(key).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function shiftMonth(key, delta) {
  const date = parseMonthKey(key);
  date.setMonth(date.getMonth() + delta);
  return monthKey(date);
}

export function getUser() {
  let user = localStorage.getItem(USER_KEY);
  if (!user) {
    user = 'studio';
    localStorage.setItem(USER_KEY, user);
  }
  return user;
}

export function catalogUrl() {
  return `${API_BASE}/catalog`;
}

export function monthUrl(key) {
  return `${API_BASE}/months/${key}`;
}

function localKey(path) {
  return `psAlloc_${path}`;
}

export function normalizeEvents(payload) {
  const list = Array.isArray(payload) ? payload : [];
  return list.map((event) => ({
    ...event,
    ts: event.timeStamp || event.ts,
    id: event.id,
  }));
}

export async function loadEvents(url) {
  const fallbackKey = localKey(url);
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const events = normalizeEvents(await response.json());
    localStorage.setItem(fallbackKey, JSON.stringify(events));
    return { events, source: 'server' };
  } catch (error) {
    const saved = localStorage.getItem(fallbackKey);
    return {
      events: saved ? JSON.parse(saved) : [],
      source: 'local',
      error,
    };
  }
}

export async function postEvent(url, data) {
  const event = {
    ...data,
    user: getUser(),
  };
  const params = new URLSearchParams();
  Object.entries(event).forEach(([key, value]) => {
    if (value == null) return;
    params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });

  const fallbackKey = localKey(url);
  const saved = localStorage.getItem(fallbackKey);
  const cache = saved ? JSON.parse(saved) : [];
  cache.push({ ...event, ts: new Date().toISOString() });
  localStorage.setItem(fallbackKey, JSON.stringify(cache));

  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(`${url}?${params.toString()}`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return true;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => {
        setTimeout(resolve, 300 * (attempt + 1));
      });
    }
  }
  throw lastError;
}

export async function postEvents(url, events) {
  const results = [];
  for (let i = 0; i < events.length; i += 1) {
    // Sequential so the sheet-logger worker keeps event order.
    // eslint-disable-next-line no-await-in-loop
    results.push(await postEvent(url, events[i]));
  }
  return results;
}
