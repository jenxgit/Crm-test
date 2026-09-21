# Mini CRM

A simple CRM for a tour company, built on Cloudflare Workers with D1.

## Stack

- **Hono** — API routes, running on Workers (`src/worker.ts`)
- **D1** — SQLite database (`mini-crm`), already provisioned with `customers`, `tours`, `tasks`, `bookings` tables
- **Drizzle ORM** — typed queries against D1 (`src/db/schema.ts`)
- **React + Vite + react-router** — frontend, built and served as static assets by the same Worker
- **@cloudflare/vite-plugin** — single `vite build` produces both the Worker bundle and the client assets

## Data model

- **customers** — title, first name, last name, date of birth, street address, state, postcode, dietaries
- **tours** — tour name, departure/return dates, `num_days` (SQLite generated column, computed automatically), price, total passengers
- **tasks** — linked to a customer, free-text multi-line task
- **bookings** — links a customer to a tour (many-to-many join table)

The D1 database (`mini-crm`) already exists in the connected Cloudflare account with these tables live. `wrangler.jsonc` points at it by `database_id`.

## Local development

```bash
npm install
npm run dev
```

This runs Vite + Miniflare together (via `@cloudflare/vite-plugin`), so the Worker API and D1 binding work locally against the same production database. If you'd rather develop against a local copy of the schema, create a `.dev.vars`-based local D1 database with `wrangler d1 execute` and update the binding.

## Deploy

```bash
npm run deploy
```

This builds the client, bundles the Worker, and runs `wrangler deploy`. You'll need to be logged into Wrangler with access to the Cloudflare account that owns the `mini-crm` D1 database:

```bash
npx wrangler login
```

## Project structure

```
src/
  worker.ts          # Hono API (mounted at /api/*)
  db/schema.ts        # Drizzle schema mirroring the live D1 tables
  client/
    main.tsx          # React router setup
    App.tsx            # Sidebar + layout shell
    pages/
      CustomersList.tsx
      CustomerDetail.tsx   # bookings + tasks for one customer
      ToursList.tsx
      TourDetail.tsx       # passenger manifest for one tour
      TasksList.tsx
    lib/api.ts          # typed fetch wrapper for the API
```

## Notes

- `num_days` on tours is a SQLite generated column (`departure_date`/`return_date` difference) — never set it directly, it's computed on read.
- Drizzle here is used for typed queries, not migrations, since the tables were created directly in D1. If you want Drizzle to manage schema changes going forward, run `drizzle-kit introspect` first so `drizzle.config.ts` and the live schema agree.
