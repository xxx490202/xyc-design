# Monitor proxy

A small CORS proxy for `monitor.html`. The newsnow hot-list API sends no
`Access-Control-Allow-Origin` header, so a browser cannot call it directly.
This service fetches the 18 boards, merges duplicates, geolocates and ranks
them, then returns the same JSON shape as `monitor-data.js`.

## Endpoints

| Method | Path | What |
|--------|------|------|
| GET | `/api/monitor` | The whole board: platforms, events, regions, categories, totals |
| GET | `/api/s?id=weibo` | One raw hot list, passed through |

Both are cached for about three minutes. CORS is `*` by default; set `ALLOW_ORIGIN`
to a comma-separated allowlist to tighten it.

## Option A — Cloudflare Worker (recommended)

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Copy the printed URL (for example
`https://xyc-monitor.your-name.workers.dev/api/monitor`) into the Monitor page:
open **Sentiment settings → Live proxy**, paste it, press **Use**. The URL is
stored in `localStorage`, so no rebuild is needed.

Or hard-code it in `monitor-live.js`:

```js
window.XYC_MONITOR_LIVE = 'https://xyc-monitor.your-name.workers.dev/api/monitor';
```

## Option B — Node (any VPS / local)

```bash
node worker/server.mjs
# -> http://localhost:8787/api/monitor
```

Node 18+ only, no dependencies. Put it behind HTTPS before pointing the public
site at it.

## Test

```bash
curl -i http://localhost:8787/api/monitor | head
curl -s http://localhost:8787/api/monitor | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.totals)})"
```

If `errors` is non-empty, an upstream board failed; the rest of the board still
renders. The page shows the failure in **Sentiment settings → Live proxy**.

`rules.js` is generated — do not edit it by hand. After changing the province /
country / category tables in `tools/build_monitor_data.py`:

```bash
python3 tools/gen_worker_rules.py
```
