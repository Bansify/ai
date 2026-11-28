# Bansify AI

One product, two clients — this **Web App** (React 19 + Vite 6 + Tailwind 4) and a native **Android App** (Jetpack Compose) — both powered by **one Cloudflare Worker** (`worker/`)

## Architecture

```
apps/web (React, static)  ─┐
                           ├─→  worker/ (Cloudflare Worker, ONE API)
Android app (Compose)     ─┘      ├── D1: users, providers, models, cache, usage, feedback, user_memory
                                  ├── KV: answer cache (24h TTL) & rate limits
                                  └── Bansify Accounts (session JWT)
```

## Free-Tier Reality

Total free capacity across all configured providers (Groq ~1,000/day, Gemini Flash-Lite ~500/day, OpenRouter free ~50/day, Workers AI) is roughly **2,500–3,000 requests/day** — enough for **~200–400 daily active users**.

## Development

### Web App
```bash
npm install
npm run lint
npm run build
npm run dev
```

### Cloudflare Worker
```bash
cd worker
npm install
npm run lint
npm test
npm run dev
```
