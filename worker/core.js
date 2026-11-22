/* Shared hot-list aggregation for the Monitor proxy.
   Used by both the Cloudflare Worker and the Node fallback server. */

import { RULES } from './rules.js';

const API_URL = 'https://newsnow.busiyi.world/api/s';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

const PLATFORM_IDS = new Set(RULES.PLATFORMS.map((p) => p[0]));
const COUNTRY_ZH = Object.fromEntries(
  Object.entries(RULES.COUNTRIES).map(([zh, en]) => [en, zh])
);

async function fetchPlatform(platformId, timeout = 15000) {
  const url = `${API_URL}?id=${encodeURIComponent(platformId)}&latest`;
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { headers: HEADERS, signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`upstream ${response.status}`);
      const data = await response.json();
      if (!data || !['success', 'cache'].includes(String(data.status || ''))) {
        throw new Error('bad upstream status');
      }
      const items = [];
      for (const [index, item] of (data.items || []).entries()) {
        const title = String(item.title || '').trim();
        if (!title) continue;
        items.push({
          title,
          url: item.url || item.mobileUrl || '',
          rank: index + 1,
        });
        if (items.length >= 40) break;
      }
      return { id: platformId, items, error: '' };
    } catch (error) {
      clearTimeout(timer);
      lastError = String(error && error.message ? error.message : error);
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
  return { id: platformId, items: [], error: lastError };
}

async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  );
  return results;
}

function matchRegion(title) {
  for (const [alias, province] of Object.entries(RULES.PROVINCE_ALIASES)) {
    if (title.includes(alias)) return [province, 'province'];
  }
  for (const name of RULES.PROVINCES) {
    if (title.includes(name)) return [name, 'province'];
  }
  for (const [alias, english] of Object.entries(RULES.COUNTRIES)) {
    if (title.includes(alias)) return [english, 'country'];
  }
  return ['', ''];
}

function matchCategory(title) {
  for (const [label, words] of RULES.CATEGORIES) {
    for (const word of words) if (title.includes(word)) return label;
  }
  for (const [label, words] of Object.entries(RULES.EXTRA_WORDS)) {
    for (const word of words) if (title.includes(word)) return label;
  }
  return '其他';
}

export async function buildPayload() {
  const started = Date.now();
  const results = await pool(
    RULES.PLATFORMS.map(([id]) => () => fetchPlatform(id)),
    6
  );
  const byId = Object.fromEntries(results.map((row) => [row.id, row]));
  const errors = results
    .filter((row) => row.error)
    .map((row) => ({ id: row.id, error: row.error }));

  const merged = new Map();
  for (const [id] of RULES.PLATFORMS) {
    for (const item of byId[id]?.items || []) {
      const entry = merged.get(item.title) || {
        title: item.title,
        url: item.url,
        rank: item.rank,
        platforms: [],
      };
      entry.rank = Math.min(entry.rank, item.rank);
      entry.platforms.push(id);
      if (!entry.url) entry.url = item.url;
      merged.set(item.title, entry);
    }
  }

  const names = Object.fromEntries(RULES.PLATFORMS.map(([id, zh, en]) => [id, [zh, en]]));
  const events = [];
  for (const entry of merged.values()) {
    const [region, kind] = matchRegion(entry.title);
    const first = entry.platforms[0];
    events.push({
      title: entry.title,
      url: entry.url,
      rank: entry.rank,
      region,
      kind,
      category: matchCategory(entry.title),
      platform: names[first]?.[0] || '',
      platform_en: names[first]?.[1] || '',
      platforms: entry.platforms,
      heat: Math.max(1, 62 - entry.rank) * (1 + Math.max(0, entry.platforms.length - 1)),
    });
  }
  events.sort((a, b) => b.heat - a.heat);

  const regions = {};
  for (const event of events) {
    if (!event.region) continue;
    const box =
      regions[event.region] ||
      (regions[event.region] = {
        name: event.region,
        name_zh:
          event.kind === 'province'
            ? event.region
            : COUNTRY_ZH[event.region] || event.region,
        name_en:
          event.kind === 'province'
            ? RULES.PROVINCE_EN[event.region] || event.region
            : event.region,
        kind: event.kind,
        count: 0,
      });
    box.count += 1;
  }

  const counts = {};
  for (const event of events) {
    counts[event.category] = (counts[event.category] || 0) + 1;
  }
  const categories = [
    { key: '全部', name_zh: '全部', name_en: 'All', count: events.length },
  ];
  for (const [label] of RULES.CATEGORIES) {
    if (counts[label]) {
      categories.push({
        key: label,
        name_zh: label,
        name_en: RULES.CATEGORIES_EN[label] || label,
        count: counts[label],
      });
    }
  }
  if (counts['其他']) {
    categories.push({
      key: '其他',
      name_zh: '其他',
      name_en: 'Other',
      count: counts['其他'],
    });
  }

  return {
    generated: started,
    generated_iso: new Date(started).toISOString(),
    source: 'newsnow public hot-list API',
    source_url: 'https://newsnow.busiyi.world',
    platforms: RULES.PLATFORMS.map(([id, zh, en]) => ({
      id,
      name: zh,
      name_en: en,
      count: byId[id]?.items.length || 0,
    })),
    categories,
    regions,
    events,
    totals: {
      events: events.length,
      regions: Object.keys(regions).length,
      provinces: Object.values(regions).filter((r) => r.kind === 'province').length,
      countries: Object.values(regions).filter((r) => r.kind === 'country').length,
      platforms: RULES.PLATFORMS.length,
      live_platforms: results.filter((row) => row.items.length).length,
    },
    errors,
  };
}

export function isPlatform(id) {
  return PLATFORM_IDS.has(id);
}

export { PLATFORM_IDS, RULES };
