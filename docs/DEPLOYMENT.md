# Bansify AI — Cloudflare Web Dashboard Deployment Guide

## 1. Deploy Cloudflare Worker (`bansifyai`) via Dashboard

1. **Cloudflare Dashboard** → **Workers & Pages** → **Create** → **Workers** → **Connect to Git** (or **Create Worker**).
2. Repository: **`Bansify/ai`**, Branch: **`main`**.
3. **Worker Name**: `bansifyai`
4. **Root directory / Path**: `worker`
5. **Deploy command**: `npx wrangler deploy`
6. **Bind D1 Database**:
   - Go to Worker **`bansifyai`** → **Settings** → **Bindings** → **Add** → **D1 database**
   - Variable name: `DB`
   - Database: `ai` (`a0f1ac80-2a02-48b6-9dd7-872be6708140`)
7. **Bind KV Namespace**:
   - Go to **Storage & Databases** → **KV** → **Create a namespace** named `CACHE`
   - Go to Worker **`bansifyai`** → **Settings** → **Bindings** → **Add** → **KV namespace**
   - Variable name: `CACHE`, Namespace: `CACHE`
8. **Add Secrets (Variables and Secrets)**:
   - Worker **`bansifyai`** → **Settings** → **Variables and Secrets** → **Add** (select **Secret**):
     - `GEMINI_API_KEY`
     - `GROQ_API_KEY`
     - `OPENROUTER_API_KEY`
     - `ADMIN_SERVICE_TOKEN`
     - `BANSIFY_JWT_SECRET`
9. **Run D1 Migrations**:
   - Go to **Storage & Databases** → **D1** → **`ai`** → **Console** tab.
   - Paste & execute `worker/migrations/0001_init.sql`, then `worker/migrations/0002_seed.sql`.

---

## 2. Deploy Cloudflare Pages (`bansifyai`) via Dashboard

1. **Cloudflare Dashboard** → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Repository: **`Bansify/ai`**, Branch: **`main`**.
3. **Project name**: `bansifyai`
4. **Build settings**:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. **Environment Variables (Production)**:
   - `VITE_WORKER_URL` = `https://bansifyai.<your-subdomain>.workers.dev`
   - `VITE_BANSIFY_ACCOUNTS_URL` = `https://accounts.bansify.com`
6. Click **Save and Deploy**. Live at `https://bansifyai.pages.dev`.
