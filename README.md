# Gammo Pharmacy API

Backend for the Gammo Pharmacy Clinical Management System.

## Stack

- Node.js + Express + TypeScript
- Prisma + PostgreSQL
- JWT auth

## Setup

1. Copy env file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Set `DATABASE_URL` in `.env`, then:

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

4. Start the API:

```bash
npm run dev
```

API: `http://localhost:5000/api`  
Health: `http://localhost:5000/api/health`  
**Swagger UI:** `http://localhost:5000/api/docs`

## Demo login

| Employee ID | Password       | Role        |
|-------------|----------------|-------------|
| EMP-001     | Pharmacy@123   | Admin       |
| EMP-002     | Pharmacy@123   | Pharmacist  |

## Folder map

```
src/
  config/       env
  db/           prisma client
  middleware/   auth, errors, validation
  utils/        jwt, password, vat
  modules/      one folder per feature
  app.ts        route wiring
  server.ts     listen
```

Each module: `*.routes.ts` → `*.controller.ts` → `*.service.ts`

## Status

- **Auth** (`POST /api/auth/login`, `GET /api/auth/me`) — implemented
- Other modules — scaffolded stubs (return 501 until built)
