/* Cloudflare Worker: a tiny CORS proxy for the Monitor page.
 *
 *   GET /api/monitor          -> the whole board (18 hot lists, merged + geolocated)
 *   GET /api/s?id=weibo       -> one raw hot list, passed through
 *
 * Deploy:  cd worker && npx wrangler deploy
 * Then put the printed URL into monitor.html's live setting (or monitor-live.js).
 */

import { buildPayload, isPlatform } from './core.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function cors(env, request) {
  const configured = (env && env.ALLOW_ORIGIN) || '*';
  let origin = '*';
  if (configured !== '*') {
    const allowed = configured.split(',').map((value) => value.trim()).filter(Boolean);
    const asked = request.headers.get('Origin') || '';
    origin = allowed.includes(asked) ? asked : allowed[0] || '*';
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Proxy': 'xyc-monitor',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

async function upstreamPlatform(id, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(
      `https://newsnow.busiyi.world/api/s?id=${encodeURIComponent(id)}&latest`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
        },
        signal: controller.signal,
      }
    );
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env, ctx) {
    const headers = cors(env, request);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'GET') {
      return json({ error: 'method not allowed' }, 405, headers);
    }

    const url = new URL(request.url);
    const cache = typeof caches !== 'undefined' ? caches.default : null;

    if (url.pathname === '/') {
      const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>xyc-monitor proxy</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#141413; color:#faf9f5;
         font:15px/1.65 ui-sans-serif,-apple-system,"PingFang SC",sans-serif; }
  main { max-width:560px; padding:48px 32px; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#e05252; margin-right:8px; }
  h1 { font-size:26px; font-weight:500; letter-spacing:-.01em; margin:0 0 14px; }
  p { color:#b0aea5; margin:0 0 10px; }
  code { font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace; color:#faf9f5;
         background:#262624; border:1px solid #3d3d3a; border-radius:6px; padding:2px 6px; }
  a { color:#e05252; }
</style></head>
<body><main>
  <p><span class="dot"></span><span style="color:#87867f;font-size:12px;letter-spacing:.14em;text-transform:uppercase">Cloudflare Worker</span></p>
  <h1>xyc-monitor proxy is running.</h1>
  <p>This URL is a data endpoint, not a page. The live board JSON lives at:</p>
  <p><code>/api/monitor</code> &nbsp;·&nbsp; one board at <code>/api/s?id=weibo</code></p>
  <p>Paste <code>https://xyc-monitor.xycdesign.workers.dev/api/monitor</code> into
     <a href="https://xyc-design.pages.dev/monitor">Monitor → Sentiment settings → Live proxy</a>.</p>
</main></body></html>`;
      return new Response(page, {
        headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      });
    }

    if (url.pathname === '/api/monitor') {
      const cacheKey = new Request(url.toString(), { method: 'GET' });
      if (cache) {
        const hit = await cache.match(cacheKey);
        if (hit) return hit;
      }
      try {
        const payload = await buildPayload();
        const response = json(payload, 200, {
          ...headers,
          'Cache-Control': 'public, max-age=180, s-maxage=180',
        });
        if (cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return json(
          { error: 'build failed', detail: String(error && error.message ? error.message : error) },
          502,
          headers
        );
      }
    }

    if (url.pathname === '/api/s') {
      const id = url.searchParams.get('id') || '';
      if (!isPlatform(id)) {
        return json({ error: 'unknown platform', id }, 400, headers);
      }
      const cacheKey = new Request(url.toString(), { method: 'GET' });
      if (cache) {
        const hit = await cache.match(cacheKey);
        if (hit) return hit;
      }
      try {
        const data = await upstreamPlatform(id);
        const response = json(data, 200, {
          ...headers,
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        });
        if (cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return json(
          { error: 'upstream failed', detail: String(error && error.message ? error.message : error) },
          502,
          headers
        );
      }
    }

    return json(
      {
        name: 'xyc-monitor-proxy',
        endpoints: ['/api/monitor', '/api/s?id=weibo'],
        hint: 'GET /api/monitor returns the whole board as JSON.',
      },
      404,
      headers
    );
  },
};
