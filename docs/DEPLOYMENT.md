# Deployment Guide — Gammo Pharmacy API

Steps to deploy the backend and share it with the frontend team.

---

## Before you deploy

1. **Auth is working locally** — test login with `EMP-001`
2. **Database migrated & seeded**
3. **Strong secrets** — never use default `JWT_SECRET` in production

---

## Required environment variables

| Variable | Example | Notes |
|----------|---------|--------|
| `PORT` | `5000` | Host may override (e.g. Railway sets this) |
| `DATABASE_URL` | `postgresql://...` | Managed Postgres connection string |
| `PRISMA_HIDE_UPDATE_MESSAGE` | `true` | Optional; avoids Railway false deploy failures from Prisma update notices |
| `JWT_SECRET` | long random string | **Required in production** |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CORS_ORIGIN` | `https://your-frontend.com` | Frontend URL — **critical** |
| `VAT_RATE` | `0.15` | |
| `CURRENCY` | `ETB` | |
| `TZ` | `Africa/Addis_Ababa` | |

---

## Deploy steps (any platform)

```bash
# 1. Build
npm install
npx prisma generate
npm run build

# 2. Run migrations on production DB
npx prisma migrate deploy

# 3. Seed demo users (staging only — skip in prod or use real users)
npm run prisma:seed

# 4. Start
npm start
```

---

## Platform options

### Option A — Railway (easiest)

1. Push repo to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add **PostgreSQL** plugin → copy `DATABASE_URL`
4. Set env vars (`JWT_SECRET`, `CORS_ORIGIN`, etc.)
5. Build command: `npm install && npx prisma generate && npm run build`
6. Start command: `npm start` (runs migrations automatically, then starts the API)
7. Do **not** set a separate pre-deploy command — migrations run on startup via `prepare-db`
8. Copy public URL → `https://xxx.up.railway.app/api`

### Option B — Render

1. [render.com](https://render.com) → Web Service + PostgreSQL
2. **Root Directory:** leave empty (repo root)
3. **Build Command:** `npm run build` (Render runs `npm install` first automatically; `heroku-postbuild` also compiles if this is left empty)
4. **Start Command:** `npx prisma migrate deploy && npm start` (or `npm start` if migrations are handled separately)
5. Set env vars in dashboard (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, etc.)
6. Optional: connect the repo `render.yaml` for the same settings automatically

**Important:** Do not set `NODE_ENV=production` before the build step unless `typescript` is installed as a production dependency (this project includes it in `dependencies` so builds work on Render).

### Option C — VPS (DigitalOcean / AWS EC2)

1. Install Node 20 + PostgreSQL (or use managed DB)
2. Clone repo, set `.env`
3. Use PM2: `pm2 start dist/server.js --name gammo-api`
4. Nginx reverse proxy + SSL (Let's Encrypt)
5. Point domain: `api.gammo.et` → server

---

## After deploy — send to frontend developer

Share this package:

| # | What to send |
|---|--------------|
| 1 | **API base URL** — e.g. `https://api.gammo.et/api` |
| 2 | **`docs/FRONTEND-INTEGRATION.md`** — integration guide |
| 3 | **`docs/openapi.yaml`** — import to Postman |
| 4 | **Demo credentials** — `EMP-001` / `Pharmacy@123` (staging only) |
| 5 | **CORS confirmation** — their frontend URL is whitelisted |
| 6 | **Status sheet** — which endpoints are live vs `501` |

### Email template

```
Subject: Gammo Pharmacy API — Integration Handoff

Hi [Name],

The backend API is deployed and ready for integration.

API Base URL: https://YOUR-URL/api
Docs: see attached FRONTEND-INTEGRATION.md
OpenAPI: import openapi.yaml into Postman

Auth (live now):
  POST /api/auth/login
  GET  /api/auth/me
  POST /api/auth/logout

Staging login:
  Employee ID: EMP-001
  Password: Pharmacy@123

Frontend env:
  NEXT_PUBLIC_API_URL=https://YOUR-URL/api

Other modules return 501 until implemented — auth can be wired now.

Let me know your frontend URL so we can set CORS_ORIGIN.

Thanks,
[Your name]
```

---

## Production checklist

- [ ] `JWT_SECRET` is a long random value
- [ ] `CORS_ORIGIN` matches frontend production URL
- [ ] `DATABASE_URL` points to production Postgres
- [ ] Migrations applied (`prisma migrate deploy`)
- [ ] HTTPS enabled
- [ ] Health check works: `GET /api/health`
- [ ] Login works from frontend origin
- [ ] Demo seed users removed or passwords changed (production)

---

## Health check URL

Use for uptime monitoring:

```
GET https://YOUR-URL/api/health
```

Expected: `{ "status": "ok", ... }`
