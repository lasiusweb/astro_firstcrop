# M2 Design — Launch-Ready Quality Roadmap

**Date:** 2026-09-02
**Source:** Gap analysis + security/SEO/architecture audit of the M1 codebase (see git history `ee5fdef`, `feb3df5`)
**Goal:** Make Firstcrop M1 shippable: harden security, add a quality pipeline, complete SEO, and bring up a real backend for full E2E validation.

---

## Context

M1 delivered the full storefront, checkout with Easebuzz payments, OTP auth, admin dashboard, and 135 passing E2E tests (30 skipped for lack of backend credentials). The audit found the platform structurally sound — RLS on all tables, HMAC-verified webhooks, guarded order transitions, idempotency keys, rate limiting — with a short list of concrete gaps that block launch readiness.

## Workstream 1 — Platform Hardening (highest priority)

### 1.1 Security headers
Add to `netlify.toml` as global headers (all routes):
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` — scoped per route type (see 1.2)

### 1.2 Content Security Policy
CSP must permit: inline styles (Astro scoped styles), React islands (hydrated scripts), Easebuzz redirect (no iframe needed), Supabase API domain, Sentry, Google Fonts, Unsplash images. Approach: start with `Content-Security-Policy-Report-Only` in production for one week to catch violations, then flip to enforcing. Keep the policy in one place (netlify.toml headers) with a documented allowed-domain list.

**Acceptance:** No console CSP violations on home, PDP, cart, checkout, login, admin in production report-only mode; enforcing policy documented.

### 1.3 Webhook log fix
`src/pages/api/webhooks/easebuzz.ts` updates logs via `.eq('payload', params)` (JSON equality — fragile). Capture the `id` returned by the initial `insert` and update by primary key.

**Acceptance:** Log row updates target by id; no behavior change otherwise.

### 1.4 Invoice configuration
Replace hardcoded `GSTIN: XXAAAA0000A1Z5` in `src/pages/api/invoice/[orderId].ts` with env vars: `PUBLIC_COMPANY_GSTIN`, `PUBLIC_COMPANY_NAME`, `PUBLIC_COMPANY_ADDRESS` (public because invoices may also be rendered client-side in future; non-secret). Add to `.env.example`.

**Acceptance:** Invoice renders values from env; missing GSTIN fails loudly (500) rather than printing a placeholder.

### 1.5 Guard consolidation
Delete per-page duplication: add `redirectIfGuest(context)` / `redirectIfNotAdmin(context)` helpers in `src/lib/auth/guard.ts` (returning `Response | undefined`), then update all 12+ protected pages to a consistent one-liner pattern. `guard.ts` becomes the single auth-gate entry point.

**Acceptance:** All protected pages/APIs use guard helpers; existing E2E redirect tests pass; no page repeats inline `if (!claims)` logic.

### 1.6 Repo hygiene
- Add `test-output.txt`, `rerun-output.txt`, `nptest.err`, `*.err` to `.gitignore`
- Delete stray untracked artifacts

**Acceptance:** `git status` clean after a test run.

## Workstream 2 — Quality Pipeline

### 2.1 Tooling
- `astro check` (TypeScript diagnostics) — add `npm run check`
- ESLint (flat config, astro + react + typescript plugins) — `npm run lint`
- Prettier — configured to match the existing codebase style; run once as a single formatting commit — `npm run format`
- Wire `check` + `lint` into `npm test` pre-step or `build`

**Acceptance:** `npm run check` and `npm run lint` pass on the current codebase (or with documented, scoped suppressions).

### 2.2 CI
Create `.github/workflows/ci.yml`: on PR/push to master — install, `astro check`, lint, `npm run build`, Playwright tests (chromium project only in CI for speed; full matrix nightly or manual). Playwright needs Supabase secrets in CI to unskip catalog tests (see workstream 4).

**Acceptance:** Green CI run on master.

## Workstream 3 — SEO Completion

### 3.1 Site-wide structured data
In `StorefrontLayout.astro` add Organization + WebSite JSON-LD (name, logo, url, sameAs social links; WebSite with SearchAction pointing to `/search`). On PDP add BreadcrumbList JSON-LD matching the existing breadcrumb UI.

**Acceptance:** Rich-results test passes Product + Organization + Breadcrumb on PDP; no duplicate Organization blocks.

### 3.2 Canonical URLs + OG
- Verify `canonical` link on every page type (layout-level `<link rel="canonical">` using `Astro.url`)
- Add `og:image` (default branded OG image in `public/`, per-product override on PDP), `og:type`, `twitter:card`

**Acceptance:** All page types emit canonical + complete OG tags.

## Workstream 4 — Backend Bring-Up (user-dependent)

### 4.1 Credentials
User creates a Supabase project (or activates Netlify DB), applies migrations (`npx supabase db push`), seeds (`npm run seed`), and fills `.env`. No code changes required — this is configuration only.

### 4.2 Test re-enablement
Remove `test.skip` from `tests/e2e/plp.spec.ts` (3 tests) and `tests/e2e/pdp.spec.ts` (3 tests). Verify full matrix passes (165 tests, 0 skipped).

**Acceptance:** Full E2E suite green across all 5 browser projects with a real backend.

## Out of Scope (deferred to M3)

- Transactional notifications (email/SMS order confirmations) — needs provider selection
- Order tracking UI / cancellation flow
- OG image generation pipeline (static default only in M2)
- Admin low-stock alerts, analytics

## Risks

| Risk | Mitigation |
|---|---|
| CSP breaks islands/fonts in production | Report-Only phase first; allowed-domain list documented |
| CI Playwright flakiness on 1 worker | Chromium-only in CI; full matrix stays local |
| Supabase project delays block workstream 4 | Workstreams 1–3 are fully independent of backend |

## Execution Order

1.6 → 1.3 → 1.4 → 1.5 → 1.1/1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4 (parallel once credentials exist)
