# M1 Implementation Plan — Foundation + Storefront

**Date:** 2026-08-20
**Source spec:** `docs/superpowers/specs/2026-08-20-firstcrop-design.md`
**Scope:** Full M1 deliverable (foundation, storefront, checkout, auth, admin, search, GST, monitoring)

---

## Execution Order

Each task lists dependencies, files to create/modify, and acceptance criteria.
Tasks within a phase are parallelizable unless noted.

---

## Phase 1: Project Bootstrap (Day 1)

### 1.1 Install Dependencies

```bash
npm install @astrojs/netlify @supabase/supabase-js @supabase/ssr @astrojs/sentry lucide-react
```

**Verify:** `npm run build` passes with no errors.

### 1.2 Generate Server Island Key

```bash
npx astro create-key
```

Set result as `ASTRO_KEY` in `.env`.

### 1.3 Update `astro.config.mjs`

**Modify:** `astro.config.mjs`
- `output: 'server'`
- Add `netlify()` adapter
- Add `cacheNetlify()` integration (create `integrations/cache-netlify.mjs` first)
- Add `vite.ssr.noExternal: ['lucide-react']`
- Add `@astrojs/sentry` integration

**Acceptance:** `npm run dev` starts on port 4321 with server mode.

### 1.4 Create `integrations/cache-netlify.mjs`

Custom integration wrapping Netlify's cache API with cache-tag support.

**Files:**
- `integrations/cache-netlify.mjs`

**Interface:**
```javascript
// Usage in pages:
// import { cacheNetlify } from '../integrations/cache-netlify.mjs';
// export const prerender = false;
// cacheNetlify({ tags: ['products', 'category-soil'] });

// Purge from admin:
// import { purgeCache } from '../integrations/cache-netlify.mjs';
// await purgeCache({ tags: ['products'] });
```

**Acceptance:** Import compiles, `cacheNetlify()` returns no-op in dev, sets cache headers in production.

### 1.5 Environment Variables

**Create:** `.env.example`
```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_EASEBUZZ_KEY=
PUBLIC_EASEBUZZ_MODE=sandbox
SUPABASE_SERVICE_ROLE_KEY=
EASEBUZZ_SALT=
SENTRY_DSN=
ASTRO_KEY=
```

**Create:** `src/env.d.ts` with `astro:env` schema + `App.SessionData` types.

**Acceptance:** TypeScript compiles, env vars accessible via `import.meta.env`.

---

## Phase 2: Foundation Layer (Days 1–2)

### 2.1 Supabase Clients

**Create:**
- `src/lib/supabase/server.ts` — SSR-safe client using cookies (per spec §2.5)
- `src/lib/supabase/client.ts` — Browser client (for `client:` islands)
- `src/lib/supabase/admin.ts` — Service-role client (for admin operations, webhook verification)

**Acceptance:** `createServerClient(cookies)` returns authenticated client, `adminClient` has service-role access.

### 2.2 Auth Helpers

**Create:**
- `src/lib/auth/get-claims.ts` — Reads JWT from cookies, returns `{ userId, role, phone }` or `null`
- `src/lib/auth/middleware.ts` — Astro middleware: attaches `locals.claims` on every request
- `src/lib/auth/guard.ts` — `requireAuth(locals)` and `requireAdmin(locals)` helpers

**Modify:** `astro.config.mjs` — register middleware

**Acceptance:** Unauthenticated requests to `/checkout` redirect to `/auth/login`. Non-admin requests to `/admin` return 403.

### 2.3 Database Schema

**Create:** `supabase/migrations/001_initial_schema.sql`

Tables: `products`, `categories`, `orders`, `order_status_history`, `webhook_logs`, `audit_log`, `wishlist` (per spec §2.9)

RLS policies: per spec §2.9

Indexes: per spec §2.9 (including GIN index for FTS)

**Acceptance:** Migration applies cleanly on fresh Supabase project. `SELECT * FROM products` returns empty set without error.

### 2.4 Seed Data

**Create:** `supabase/seed.sql` or `scripts/seed.ts`
- 4 categories: Soil Treatment, Crop Protection, Compost & Bio, Tools & Equipment
- 12 products (3 per category) with realistic Indian bio-agricultural products
- 1 admin user (phone number for testing)

**Acceptance:** `npm run seed` populates tables, products visible via Supabase dashboard.

---

## Phase 3: Layout & Styling (Day 2)

### 3.1 Global CSS Tokens

**Create:** `src/styles/tokens.css`
- Storefront tokens (§3.2, §3.4): colors, spacing, typography, shadows, radii
- Dashboard tokens (§4.1): surface, border, glass, sidebar
- Shared tokens (§5.1): motion easing, durations
- Breakpoints, safe areas

**Create:** `src/styles/global.css`
- Import tokens
- Reset (box-sizing, margin, font-smoothing)
- Typography base (Inter + Space Grotesk with preload)
- Utility classes (truncate, line-clamp, tabular-nums, focus-visible ring)
- `prefers-reduced-motion` media query

**Acceptance:** CSS loads on all pages, tokens accessible via `var(--c-green-600)` etc.

### 3.2 Base Layout

**Create:** `src/layouts/BaseLayout.astro`
- `<head>`: font preloads, meta tags, `@astrojs/sentry` client init
- Skip-to-content link
- Slot for page content
- `<slot name="head">` for page-specific meta

**Create:** `src/layouts/StorefrontLayout.astro` (extends BaseLayout)
- MegaMenu (static HTML + vanilla `<script>`)
- MobileBottomNav (static HTML + vanilla `<script>`)
- Toast container (`client:load` React)
- CartDrawer (`client:load` React)

**Create:** `src/layouts/DashboardLayout.astro` (extends BaseLayout)
- Collapsible sidebar (static HTML + vanilla `<script>`)
- Main content area with padding

**Acceptance:** Pages render with correct layout, nav works, no hydration errors in console.

### 3.3 Typography & Font Loading

**Modify:** `src/layouts/BaseLayout.astro`
- `<link rel="preload" as="font" href="..." type="font/woff2" crossorigin>` for Inter + Space Grotesk
- `<style>` with `@font-face` declarations, `font-display: swap`

**Acceptance:** Lighthouse font-display audit passes, no FOIT.

---

## Phase 4: Storefront Pages (Days 3–5)

### 4.1 Homepage (`/`)

**Create:** `src/pages/index.astro`
- ISR: fetch featured products, categories, hero content from Supabase
- Sections per spec §3.7: Hero → Category Nav → Featured Products → How It Works → Social Proof → Blog Preview
- HeroSection: static, full-bleed image with CSS overlay
- TrustBar: static icons + copy
- SectionProductRow: horizontal scroll of ProductCards

**Create components:**
- `src/components/storefront/HeroSection.astro`
- `src/components/storefront/CategoryCards.astro`
- `src/components/storefront/SectionProductRow.astro`
- `src/components/storefront/HowItWorks.astro`
- `src/components/storefront/SocialProof.astro`
- `src/components/storefront/BlogPreview.astro`
- `src/components/storefront/ProductCard.astro`

**Acceptance:** Homepage renders at `/`, all sections visible, images lazy-loaded, responsive at 375/768/1024/1440.

### 4.2 Product Listing Page (`/products`)

**Create:** `src/pages/products/index.astro`
- ISR for default view (no query params)
- SSR fallback when `?q=` present (hits FTS endpoint)
- Faceted filtering: `?category=&min=&max=&sort=`
- FilterSidebar (`client:load` React): URL-synced filters
- ProductCard grid

**Create:** `src/components/storefront/FilterSidebar.tsx`

**Acceptance:** `/products` loads, filters update URL, grid responsive, skeleton shows during load.

### 4.3 Product Detail Page (`/products/[slug]`)

**Create:** `src/pages/products/[slug].astro`
- ISR shell: product images, description, benefits, application rate
- `server:defer` PriceDisplay: live price, stock, discount
- `client:load` AddToCartButton
- BreadcrumbNav (static)
- StickyCTA (mobile-only, static)
- Product schema structured data

**Create components:**
- `src/components/storefront/PriceDisplay.astro` (server island)
- `src/components/storefront/AddToCartButton.tsx` (client island)
- `src/components/storefront/ProductGallery.astro`
- `src/components/storefront/ProductInfo.astro`
- `src/components/storefront/BreadcrumbNav.astro`
- `src/components/storefront/StickyCTA.astro`

**Acceptance:** PDP loads, price/stock are fresh (verify by updating in admin), Add to Cart works, structured data validates in Rich Results Test.

### 4.4 Category Page (`/categories/[slug]`)

**Create:** `src/pages/categories/[slug].astro`
- Same pattern as PLP but filtered to one category
- ISR with cache tags

**Acceptance:** Category pages render, products filtered correctly.

### 4.5 Search

**Create:** `src/pages/search.astro` (SSR)
**Create:** `src/pages/api/search.ts` (SSR endpoint)
- Postgres FTS: `to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $1)`
- Results: product name, price, image, slug
- SearchDrawer (`client:load` React): full-screen overlay

**Create:** `src/components/storefront/SearchDrawer.tsx`

**Acceptance:** Search returns relevant results, drawer opens/closes, keyboard accessible (Escape to close).

---

## Phase 5: Cart & Checkout (Days 5–7)

### 5.1 Cart API

**Create:** `src/pages/api/cart/add.ts` (POST)
**Create:** `src/pages/api/cart/update.ts` (POST)
**Create:** `src/pages/api/cart/remove.ts` (POST)
**Create:** `src/lib/cart.ts` — cart CRUD operations against Supabase sessions table

**Acceptance:** Add/update/remove work, cart persists across page loads.

### 5.2 Cart Drawer

**Create:** `src/components/storefront/CartDrawer.tsx` (`client:load`)
- Slide-in from right
- Item list with image, name, price, qty adjuster, remove
- Subtotal with `tabular-nums`
- "Proceed to Checkout" CTA
- Empty state

**Acceptance:** Cart drawer opens, items display correctly, qty updates work, responsive.

### 5.3 Checkout Flow (3-step)

**Create:** `src/pages/checkout.astro` (SSR, auth-gated)
- Step 1: Shipping address form
- Step 2: Order review + GST summary
- Step 3: Payment redirect

**Create:** `src/pages/checkout/payment.astro` (SSR)
- Server-side Easebuzz payload generation
- Redirect to Easebuzz hosted checkout

**Create:** `src/pages/checkout/confirmation.astro` (SSR)
- Post-payment verification
- Order summary + GST invoice download link

**Create API endpoints:**
- `src/pages/api/checkout/initiate.ts` — validates items, creates order, signs Easebuzz payload
- `src/pages/api/checkout/verify.ts` — verifies payment signature, updates order status, decrements stock

**Create:** `src/lib/payment/easebuzz.ts` — HMAC signing, payload generation, signature verification
**Create:** `src/lib/payment/provider.ts` — `PaymentProvider` interface (mockable for testing)

**Acceptance:** Full checkout flow works end-to-end in Easebuzz sandbox mode. Stock decrements on success.

### 5.4 GST Invoice PDF

**Create:** `src/pages/api/invoice/[orderId].ts` (GET, auth-gated)
**Create:** `src/lib/invoice/generate.ts` — server-side PDF generation
- GSTIN, HSN codes, CGST/SGST (intra-state) or IGST (inter-state)
- Order items, quantities, rates, tax breakdown
- Invoice number, date

**Acceptance:** Invoice PDF downloads with correct GST breakdown.

### 5.5 Toast System

**Create:** `src/components/storefront/Toast.tsx` (`client:load`)
- `aria-live="polite"`
- Auto-dismiss 5s
- Green success / red error variants
- Queue multiple toasts

**Acceptance:** Toasts appear on cart add, checkout success, errors. Dismiss automatically.

---

## Phase 6: Auth Pages (Day 6)

### 6.1 Login & OTP Verification

**Create:** `src/pages/auth/login.astro` (SSR)
**Create:** `src/pages/auth/verify.astro` (SSR)
**Create:** `src/components/auth/OTPForm.tsx` (`client:load`)
- Phone input with `type="tel"`, `inputmode="tel"`
- OTP input (6-digit, auto-advance)
- Resend timer (60s cooldown)
- Error handling

**Acceptance:** Login flow works: enter phone → receive OTP → verify → redirected to account.

### 6.2 Account Pages

**Create:** `src/pages/account.astro` (SSR, auth-gated)
**Create:** `src/pages/account/orders.astro` (SSR, auth-gated)
**Create:** `src/pages/account/wishlist.astro` (SSR, auth-gated)

**Create:** `src/components/account/OrderHistory.tsx`
**Create:** `src/components/account/WishlistGrid.tsx`
**Create:** `src/components/account/ReorderButton.tsx`

**Acceptance:** Account pages render, orders display, wishlist toggle works, reorder adds items to cart.

---

## Phase 7: Admin Dashboard (Days 7–8)

### 7.1 Admin Layout & Navigation

**Create:** `src/layouts/DashboardLayout.astro` (if not done in Phase 3)
**Create:** `src/components/admin/Sidebar.astro` (static + vanilla JS)
**Create:** `src/components/admin/KPICard.astro` (static)

### 7.2 Dashboard Home (`/admin`)

**Create:** `src/pages/admin/index.astro` (SSR, admin-guarded)
- KPI cards: orders today, revenue, low-stock alerts
- Recent orders table (last 10)

**Acceptance:** Dashboard loads with real data, KPIs update on page refresh.

### 7.3 Orders Management (`/admin/orders`)

**Create:** `src/pages/admin/orders/index.astro` (SSR, admin-guarded)
**Create:** `src/components/admin/OrdersTable.tsx` (`client:load`)
- Sortable columns, status filter, search
- Bulk status update
- StatusBadge component (static)

**Acceptance:** Orders table loads, filters work, status updates persist.

### 7.4 Products Management (`/admin/products`)

**Create:** `src/pages/admin/products/index.astro` (SSR, admin-guarded)
**Create:** `src/components/admin/ProductEditor.tsx` (`client:load`)
- Inline stock/price editing
- Status toggle (active/draft/archived)

**Acceptance:** Products table loads, inline edits save, status toggles work.

### 7.5 Settings (`/admin/settings`)

**Create:** `src/pages/admin/settings.astro` (SSR, admin-guarded)
- GST configuration (GSTIN, state code)
- Store info

**Acceptance:** Settings page renders, saves to Supabase.

---

## Phase 8: Monitoring & Compliance (Day 8)

### 8.1 Sentry Integration

**Modify:** `astro.config.mjs` — add `@astrojs/sentry` with source maps
**Create:** Error boundaries for all `client:` islands

**Acceptance:** Sentry captures errors in dev, source maps upload on build.

### 8.2 Webhook Logging

**Modify:** `src/pages/api/checkout/verify.ts` — log all Easebuzz callbacks to `webhook_logs` table

**Acceptance:** Webhook attempts logged with signature validity and processing status.

### 8.3 Audit Logging

**Create:** `src/lib/audit.ts` — log function writing to `audit_log` table
**Use in:** Admin product/order updates, order status changes

**Acceptance:** Admin actions appear in audit_log.

### 8.4 Web Interface Guidelines Review

**Process:** Review all created/modified files against the Vercel Web Interface Guidelines checklist (spec §10).

**Acceptance:** Zero findings in `file:line` format before merge.

---

## Phase 9: Testing & Polish (Days 8–9)

### 9.1 Playwright E2E Tests

**Create/expand:** `tests/e2e/`
- Homepage loads, all sections visible
- PLP: filters update URL, products filter correctly
- PDP: price loads (server island), add to cart works
- Cart: add/update/remove items
- Checkout: full flow in sandbox
- Auth: login with OTP, protected routes redirect
- Search: results appear for valid queries
- Admin: login as admin, KPIs display

**Acceptance:** All E2E tests pass in CI.

### 9.2 Responsive Testing

**Visual regression:** Playwright screenshots at 375/768/1024/1440
- Homepage, PDP, PLP, Cart, Checkout, Admin dashboard

**Acceptance:** No layout breaks, text truncation works, touch targets ≥44px.

### 9.3 Accessibility Testing

- axe-core automated scan on key pages
- Manual keyboard navigation check
- Focus-visible verification
- Screen reader spot-check (VoiceOver/NVDA)

**Acceptance:** WCAG 2.1 AA compliance on all pages.

### 9.4 Performance Baseline

- Lighthouse CI on homepage and PDP
- Target: LCP <3s on simulated 3G, CLS <0.1, LCP <2.5s on 4G

**Acceptance:** Core Web Vitals within thresholds.

---

## File Manifest (New Files)

```
integrations/
  cache-netlify.mjs

src/
  env.d.ts
  styles/
    tokens.css
    global.css
  layouts/
    BaseLayout.astro
    StorefrontLayout.astro
    DashboardLayout.astro
  lib/
    supabase/
      server.ts
      client.ts
      admin.ts
    auth/
      get-claims.ts
      middleware.ts
      guard.ts
    cart.ts
    audit.ts
    invoice/
      generate.ts
    payment/
      easebuzz.ts
      provider.ts
  middleware.ts
  components/
    storefront/
      HeroSection.astro
      CategoryCards.astro
      SectionProductRow.astro
      HowItWorks.astro
      SocialProof.astro
      BlogPreview.astro
      ProductCard.astro
      ProductCardSkeleton.astro
      PriceDisplay.astro        (server island)
      AddToCartButton.tsx       (client island)
      ProductGallery.astro
      ProductInfo.astro
      BreadcrumbNav.astro
      StickyCTA.astro
      FilterSidebar.tsx         (client island)
      SearchDrawer.tsx          (client island)
      CartDrawer.tsx            (client island)
      Toast.tsx                 (client island)
    auth/
      OTPForm.tsx               (client island)
    account/
      OrderHistory.tsx
      WishlistGrid.tsx
      ReorderButton.tsx
    admin/
      Sidebar.astro
      KPICard.astro
      OrdersTable.tsx           (client island)
      ProductEditor.tsx         (client island)
      StatusBadge.astro
  pages/
    index.astro
    products/
      index.astro
      [slug].astro
    categories/
      [slug].astro
    cart.astro
    checkout/
      index.astro
      payment.astro
      confirmation.astro
    account/
      index.astro
      orders.astro
      wishlist.astro
    auth/
      login.astro
      verify.astro
    admin/
      index.astro
      orders/
        index.astro
      products/
        index.astro
      settings.astro
    search.astro
    api/
      cart/
        add.ts
        update.ts
        remove.ts
      checkout/
        initiate.ts
        verify.ts
      search.ts
      wishlist/
        toggle.ts
      invoice/
        [orderId].ts

supabase/
  migrations/
    001_initial_schema.sql
  seed.sql

scripts/
  seed.ts

tests/
  e2e/
    homepage.spec.ts
    plp.spec.ts
    pdp.spec.ts
    cart.spec.ts
    checkout.spec.ts
    auth.spec.ts
    search.spec.ts
    admin.spec.ts
```

## Estimated Effort

| Phase | Days | Parallelizable |
|-------|------|----------------|
| 1. Bootstrap | 1 | Sequential |
| 2. Foundation | 1–2 | Partially (2.3 + 2.4 parallel) |
| 3. Layout/Styling | 1 | Sequential |
| 4. Storefront | 2–3 | Mostly parallel |
| 5. Cart/Checkout | 2 | Sequential (API → UI) |
| 6. Auth | 1 | Sequential |
| 7. Admin | 1–2 | Mostly parallel |
| 8. Monitoring | 0.5 | Sequential |
| 9. Testing/Polish | 1–2 | Parallel |
| **Total** | **~9–12 days** | |

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| Easebuzz sandbox API changes | Mock provider interface, test with mock first |
| Supabase OTP delivery delays | Test with known numbers, implement retry + cooldown UI |
| ISR cache invalidation bugs | Start with short TTL (60s), increase after validation |
| Server island fallback layout shift | Fixed-dimension skeletons in fallback slots |
| GST calculation edge cases | Unit tests for intra-state vs inter-state, round-off |
