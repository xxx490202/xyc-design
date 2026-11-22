/* Node fallback for the Monitor proxy — same JSON as the Cloudflare Worker.
 *
 *   node worker/server.mjs
 *   -> http://localhost:8787/api/monitor
 *
 * Uses only Node 18+ built-ins (global fetch). No dependencies.
 */

import http from 'node:http';
import { buildPayload, isPlatform } from './core.js';

const PORT = Number(process.env.PORT || 8787);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const MONITOR_TTL = 180 * 1000;
const PLATFORM_TTL = 300 * 1000;

let monitorCache = { at: 0, body: null };
const platformCache = new Map();

function headers(extra) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Proxy': 'xyc-monitor-node',
    ...extra,
  };
}

function send(res, status, body, extra) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, headers(extra));
  res.end(payload);
}

async function getPlatform(id) {
  const now = Date.now();
  const hit = platformCache.get(id);
  if (hit && now - hit.at < PLATFORM_TTL) return hit.body;
  const response = await fetch(
    `https://newsnow.busiyi.world/api/s?id=${encodeURIComponent(id)}&latest`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    }
  );
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  const body = await response.json();
  platformCache.set(id, { at: now, body });
  return body;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers({}));
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    send(res, 405, { error: 'method not allowed' });
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/' || url.pathname === '/api/monitor') {
    try {
      if (!monitorCache.body || Date.now() - monitorCache.at > MONITOR_TTL) {
        monitorCache = { at: Date.now(), body: await buildPayload() };
      }
      send(res, 200, monitorCache.body, { 'Cache-Control': 'public, max-age=180' });
    } catch (error) {
      send(res, 502, {
        error: 'build failed',
        detail: String(error && error.message ? error.message : error),
      });
    }
    return;
  }

  if (url.pathname === '/api/s') {
    const id = url.searchParams.get('id') || '';
    if (!isPlatform(id)) {
      send(res, 400, { error: 'unknown platform', id });
      return;
    }
    try {
      send(res, 200, await getPlatform(id), { 'Cache-Control': 'public, max-age=300' });
    } catch (error) {
      send(res, 502, {
        error: 'upstream failed',
        detail: String(error && error.message ? error.message : error),
      });
    }
    return;
  }

  send(res, 404, {
    name: 'xyc-monitor-proxy',
    endpoints: ['/api/monitor', '/api/s?id=weibo'],
  });
});

server.listen(PORT, () => {
  console.log(`xyc monitor proxy -> http://localhost:${PORT}/api/monitor`);
});
