## Project

Astro 7.2.4 + React 19 e-commerce platform for Firstcrop.in — micro-microbial biologicals for Indian farmers. Two shells: public storefront (Clean Agritech) + internal dashboard (Attio × Linear). Supabase backend, Netlify deployment, Easebuzz payments.

Node >= 22.12.0. No lint/typecheck formatter yet (planned M1).

## Commands

| Task | Command |
|---|---|
| Dev server (foreground) | `npm run dev` |
| Dev server (background) | `astro dev --background` |
| Stop/status/logs | `astro dev stop`, `astro dev status`, `astro dev logs` |
| Build | `npm run build` → `dist/` |
| Preview | `npm run preview` |
| E2E tests | `npm test` (auto-starts dev server) |
| E2E with UI | `npm run test:ui` |
| View test report | `npx playwright show-report` |
| Record new test | `npx playwright codegen http://localhost:4321` |
| DB seed | `npm run seed` (after creating script) |
| DB migrate | `npx supabase db push` (or `supabase migration up`) |
| Server island key | `npx astro create-key` |

## Architecture

- **Rendering:** `output: 'server'` with per-page `prerender = true/false`
  - Static: `/about`, `/blog/*`, `/learn/*`, `/privacy`, `/terms`
  - ISR: `/`, `/products`, `/categories/[slug]` via `cacheNetlify()`
  - SSR-no-cache: `/cart`, `/checkout/*`, `/account/*`, `/admin/*`, `/api/*`, `/search`
- **Server islands:** `server:defer` for PriceDisplay (PDP) — live price/stock per request
- **Client islands:** `client:load` for interactive React components (cart, filters, search, OTP)
- **Static HTML:** Nav, footer, product cards, hero — zero JS hydration

## Structure

```
src/
  pages/          — file-based routing (.astro = route, .ts = API endpoint)
  components/
    storefront/   — Clean Agritech components (Astro + React)
    auth/         — OTP form
    account/      — Order history, wishlist
    admin/        — Dashboard components
  layouts/
    BaseLayout.astro
    StorefrontLayout.astro
    DashboardLayout.astro
  lib/
    supabase/     — server.ts, client.ts, admin.ts
    auth/         — get-claims.ts, middleware.ts, guard.ts
    payment/      — easebuzz.ts, provider.ts
    invoice/      — generate.ts
    cart.ts
    audit.ts
  styles/
    tokens.css    — CSS custom properties
    global.css    — reset, typography, utilities
integrations/
  cache-netlify.mjs — custom Netlify cache integration
supabase/
  migrations/     — SQL migration files
  seed.sql        — sample data
```

## Design Systems

- **Storefront (Clean Agritech):** Earth-green palette (`#15803D`/`#16A34A`/`#22C55E`), harvest-gold accent (`#A16207`), `#F0FDF4` bg, Space Grotesk (display) + Inter (body)
- **Dashboard (Attio × Linear):** `#FAFAFA` bg, glass panels, green accent `#16A34A`, Inter 13px + tabular numerals
- **Motion:** CSS/WAAPI only in M1. Tokens: `--ease-out`, `--ease-spring`, 150–300ms durations. Transforms/opacity only. `prefers-reduced-motion` respected everywhere.
- **Icons:** Lucide React (1.5px stroke). No emoji as icons.

## Conventions

### Component patterns
- `.astro` for static/server-rendered components (no hydration)
- `.tsx` for interactive components with `client:load`
- **Never** hydrate components that don't need interactivity
- Mobile menu toggle: vanilla `<script>`, not a React component
- Fallback slots on all `server:defer` components (fixed dimensions, no CLS)
- Server island props: pass IDs only, not full objects (URL size limit)

### Styling
- Scoped `<style>` in `.astro` components
- Global tokens in `src/styles/tokens.css`
- CSS custom properties for all design tokens (no magic numbers)
- No `transition: all` — always list explicit properties
- No Tailwind — vanilla CSS only

### Data & API
- All API endpoints in `src/pages/api/` as `.ts` files
- Supabase client: `createServerClient(Astro.cookies)` for SSR
- Admin operations: service-role client (never expose to client)
- Idempotency keys on all mutation endpoints
- Webhook verification: HMAC signature check before processing

### Auth & security
- Phone OTP via Supabase — no email/password
- `getClaims()` reads JWT from cookies, returns `{ userId, role, phone }`
- Middleware attaches `locals.claims` on every request
- Protected routes: `/checkout`, `/account/*`, `/admin/*`
- Admin guard: `locals.claims?.role === 'admin'`
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client

### Payments
- Easebuzz hosted checkout (redirect flow)
- `PaymentProvider` interface for testability
- Stock decrement: `UPDATE … WHERE stock_qty >= ?` with `rowCount` check
- Order status transitions: guarded (`pending → paid` only)
- All webhook callbacks logged to `webhook_logs`

### Testing
- Playwright E2E in `tests/e2e/`
- Tests auto-start dev server (port 4321)
- Run `npm test` before finishing any task
- Cross-browser: Chrome, Firefox, WebKit, mobile viewports

### Accessibility (Web Interface Guidelines)
- `:focus-visible` rings on all interactive elements
- Icon-only buttons: `aria-label`
- Form controls: `<label>` or `aria-label`
- `aria-live="polite"` on toasts and async updates
- `<button>` for actions, `<a>` for navigation
- Semantic HTML before ARIA
- Images: explicit `width`/`height`, `alt` text, lazy below fold
- Touch targets: ≥44px

## Gotchas

- `astro.config.mjs` includes React integration — restart dev server after modifying
- TypeScript extends `astro/tsconfigs/strict`; `.astro/types.d.ts` is auto-generated
- Server islands: `Astro.url` returns `/_server-islands/ComponentName`, NOT the page URL — use `Referer` header instead
- Server island props must be serializable (no functions) — keep under 2048 bytes
- `cacheNetlify()` is a custom integration in `integrations/cache-netlify.mjs`
- `ASTRO_KEY` env var must be set for server island encryption
- Supabase OTP: test with known phone numbers, implement 60s resend cooldown
- GST: intra-state = CGST+SGST, inter-state = IGST — determine from pincode/state
- Easebuzz sandbox vs live controlled by `PUBLIC_EASEBUZZ_MODE` env var
- RLS policies in Supabase must be applied via migrations, not dashboard
- Font preloads: always set `crossorigin` on font `<link>` tags
