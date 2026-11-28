# Bansify AI — Architecture

One product, two clients — **Web App** (React 19 + Vite 6 + Tailwind 4) and **Android App** (Jetpack Compose) — both powered by **one Cloudflare Worker (`bansifyai`)**.

```
apps/web (React, static)  ─┐
                           ├─→  worker/ (Cloudflare Worker: bansifyai)
Android app (Compose)     ─┘      ├── D1 (ai): users, providers, models, cache, usage, feedback, user_memory
                                  ├── KV (CACHE): answer cache (24h TTL) & rate limits
                                  └── Bansify Accounts (https://accounts.bansify.com)
```

## Worker Endpoints (`worker/src/index.ts`)
- `GET /v1/health` — uptime + degraded providers
- `GET /v1/models` — enabled models from D1
- `GET /v1/providers` — provider list + daily quota remaining
- `POST /v1/chat` — SSE streaming (`data: {"delta":"..."}` → `data: [DONE]`)
- `POST /v1/guest` — rate-limited anonymous guest token
- `POST /v1/feedback` — thumbs up/down stored in D1
- `POST /admin/providers` & `GET /admin/usage` — protected by `X-Admin-Token`

## Routing & Free-Tier Reality
- **Quota-aware fallback chain** (`worker/src/scheduler.ts`): sorts providers by remaining daily quota & priority, drops providers >80% used one tier, marks 429/5xx/timeout (>12s) degraded for 60s in KV.
- **Total free capacity**: ~2,500–3,000 requests/day (~200–400 DAU) across Groq (~1,000/day), Gemini Flash-Lite (~500/day), OpenRouter free (~50/day), and Workers AI.
- When all providers are exhausted, returns `"Abhi free quota khatam hai, kal reset hoga"` with next UTC reset time.
