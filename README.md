# Firstcrop.in

Astro 7 + React 19 e-commerce platform for micro-microbial biologicals, aimed at Indian farmers.
Supabase backend (auth via phone OTP, Postgres + RLS), Netlify deployment, Easebuzz payments.

## Requirements

- Node >= 22.12.0
- A Supabase project (URL + anon key + service-role key)
- Easebuzz sandbox credentials (optional — checkout falls back to mock payment without them)

## Setup

1. Copy `.env.example` to `.env` and fill in values.
2. Apply migrations: `npx supabase db push`
3. Seed the catalog: `npm run seed`
4. Generate a server-island key (`npx astro create-key`, put it in `ASTRO_KEY`).

## Commands

| Task | Command |
|---|---|
| Dev | `npm run dev` |
| Build | `npm run build` |
| E2E tests | `npm test` |
| Seed | `npm run seed` |

## Architecture

- **Rendering**: `output: 'server'` (Netlify adapter). Catalog pages get ISR-style cache headers
  (`s-maxage` + `Netlify-Cache-Tags: products`) via `integrations/cache-middleware.mjs`;
  cart/checkout/account/admin/api routes are `no-store`.
- **Server island**: PDP price/stock via `server:defer` PriceDisplay with fixed-size fallback.
- **Payments**: Easebuzz hosted checkout. `POST /api/webhooks/easebuzz` verifies the salt hash,
  logs to `webhook_logs`, and performs guarded order status transitions (`src/lib/orders.ts`).
- **Auth**: phone OTP through Supabase; middleware resolves `locals.claims` once per request.
- **Stock**: atomic `decrement_stock()` Postgres function; cart additions clamped to stock.

## Conventions

See `AGENTS.md` for the full engineering conventions (component patterns, styling tokens,
accessibility rules, payment/security invariants).
