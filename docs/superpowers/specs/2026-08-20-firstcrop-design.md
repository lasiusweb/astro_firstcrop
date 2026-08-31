# Firstcrop.in — Design Spec

**Date:** 2026-08-20  
**Status:** Final  
**Purpose:** Single source of truth for all architectural, design, and feature decisions.  
**Next step:** Invoke writing-plans skill to produce M1 implementation plan.

---

## 1. Executive Summary

Firstcrop.in is a vertically integrated e-commerce storefront + internal CRM/dashboard for selling micro-microbial biologicals to Indian farmers. Built on Astro 7 + Supabase + Vanilla CSS, deployed on Netlify. Two shells (public storefront, internal dashboard) share one Astro app but have distinct design languages: Clean Agritech (storefront) and Attio × Linear (dashboard).

**Key constraints:** Rural 3G-first performance. English-only initially (i18n-ready schema). Server-rendered for fresh pricing/stock. Supabase phone OTP for auth. Easebuzz for payments (sandbox → live). Zero JS for catalog pages.

---

## 2. Technical Architecture

### 2.1 Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Astro 7.2.4 + React 19 | Islands architecture, zero-JS default |
| Deployment | Netlify (adapter) | ISR via `cacheNetlify()`, edge middleware |
| Database | Supabase (Postgres) | Managed, RLS built-in, auth built-in |
| Auth | Supabase phone OTP + `@supabase/ssr` | Cookie-based, SSR-safe |
| Payments | Easebuzz | Indian payment gateway, sandbox keys available |
| Monitoring | Sentry + `@astrojs/sentry` | Error tracking from M1 |
| Styling | Vanilla CSS (scoped + global tokens) | Zero-JS, no build step |

### 2.2 Astro Configuration

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
// Custom integration — to be created in M1 (wraps Netlify cache API with cache-tag support)
import { cacheNetlify } from './integrations/cache-netlify.mjs';

export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [react(), cacheNetlify()],
  vite: {
    ssr: {
      noExternal: ['lucide-react'],
    },
  },
});
```

### 2.3 Three Rendering Tiers

| Tier | Strategy | Routes | Cache |
|------|----------|--------|-------|
| **Static** | `prerender = true` | `/about`, `/blog/*`, `/learn/*`, `/privacy`, `/terms` | CDN forever, rebuild purge |
| **ISR** | `cacheNetlify()` + cache tags | `/products`, `/categories/[slug]`, `/` (catalog sections) | `s-maxage=300`, on-demand purge via `purgeCache()` |
| **SSR-no-cache** | `prerender = false` | `/cart`, `/checkout`, `/account/*`, `/admin/*`, `/api/*`, `/search` | No cache |

### 2.4 Per-Page Rendering Decision Matrix

| Page | Tier | Rationale |
|------|------|-----------|
| `/` (homepage) | ISR | Catalog sections refresh at build; hero/CMS static, product rows cached |
| `/products` | ISR + SSR search fallback | Faceted PLP cached; `?q=` hits SSR FTS endpoint |
| `/products/[slug]` | ISR (shell) + server island (price) | Static product data cached; price/stock fresh per request via `server:defer` |
| `/categories/[slug]` | ISR | Category pages cached with cache tags |
| `/cart` | SSR-no-cache | Session-dependent |
| `/checkout` | SSR-no-cache | Session-dependent, auth-gated |
| `/checkout/payment` | SSR-no-cache | Easebuzz redirect |
| `/account` | SSR-no-cache | Auth-gated |
| `/account/orders` | SSR-no-cache | Auth-gated |
| `/admin/*` | SSR-no-cache | Auth + role-gated |
| `/api/*` | SSR-no-cache | All API endpoints |
| `/search?q=` | SSR-no-cache | Full-text search, fresh results |
| `/blog/*`, `/learn/*` | Static | Content collections, rebuild only |
| `/about`, `/privacy`, `/terms` | Static | Rarely change |

### 2.5 Supabase Client Setup

```typescript
// src/lib/supabase/server.ts — SSR-safe client
import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

export function createServerClient(cookies: AstroCookies) {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: 'pkce',
        storage: {
          getItem: (key) => cookies.get(key)?.value,
          setItem: (key, value) => cookies.set(key, value, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' }),
          removeItem: (key) => cookies.delete(key, { path: '/' }),
        },
      },
    }
  );
}
```

### 2.6 Auth Flow

1. User enters phone number → Supabase sends OTP
2. User enters OTP → Supabase verifies → sets `sb-access-token` + `sb-refresh-token` cookies (httpOnly)
3. `getClaims()` helper reads JWT, extracts role (`customer` | `admin`)
4. Middleware checks auth for `/checkout`, `/account/*`, `/admin/*`
5. Admin guard: `context.locals.claims?.role === 'admin'`

### 2.7 Payment Flow (Easebuzz)

1. Checkout page collects address → POST `/api/checkout/initiate`
2. Server creates order row (`status: 'pending'`), generates Easebuzz payload with HMAC signature
3. Redirect to Easebuzz hosted checkout (sandbox or live)
4. Easebuzz redirects back to `/checkout/confirmation?txnid=...&status=...`
5. Server verifies response signature → updates order to `paid` (guarded: only `pending → paid`)
6. **Stock decrement:** `UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?` — `rowCount` checked; if 0, order rejected with error

### 2.8 Session Strategy

- **Cart:** Supabase `sessions` table (`id`, `user_id`, `items JSONB`, `created_at`, `updated_at`). Anonymous users get a session cookie; cart merges on login.
- **Astro session driver:** `netlify-blob` or `memory` for temporary state (pending checkout data). Cart itself lives in Supabase for cross-device persistence.

### 2.9 Database Schema (Core Tables)

```sql
-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_desc TEXT,
  price NUMERIC(10,2) NOT NULL,
  compare_price NUMERIC(10,2),
  stock_qty INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id),
  images JSONB DEFAULT '[]',
  benefits TEXT[],
  application_rate TEXT,
  gst_hsn TEXT,
  gst_rate NUMERIC(4,2) DEFAULT 18.00,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_search ON products USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','delivered','cancelled','refunded')),
  items JSONB NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  gst_total NUMERIC(10,2) NOT NULL,
  shipping NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  payment_method TEXT,
  payment_id TEXT,
  payment_status TEXT DEFAULT 'unpaid',
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_idempotency ON orders(idempotency_key);

-- Order status history
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_osh_order ON order_status_history(order_id);

-- Webhook logs
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  before JSONB,
  after JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Wishlist
CREATE TABLE wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  product_id UUID REFERENCES products(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- RLS Policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

-- Products: anyone can read active, admin can CRUD
CREATE POLICY products_read ON products FOR SELECT USING (status = 'active' OR auth.jwt() ->> 'role' = 'admin');
CREATE POLICY products_write ON products FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Orders: users see own, admin sees all
CREATE POLICY orders_own ON orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY orders_admin ON orders FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Wishlist: users manage own
CREATE POLICY wishlist_own ON wishlist FOR ALL USING (user_id = auth.uid());
```

### 2.10 Environment Variables

```env
# Public
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_EASEBUZZ_KEY=
PUBLIC_EASEBUZZ_MODE=sandbox           # sandbox | live

# Server only
SUPABASE_SERVICE_ROLE_KEY=
EASEBUZZ_SALT=
SENTRY_DSN=
```

Use `astro:env` schema for type-safe access at build time.

---

## 3. Design System — Storefront (Clean Agritech)

### 3.1 Identity

**Voice:** Confident expertise — clean, direct, no jargon. "Farm smarter" not "leverage our proprietary bio-solutions."

### 3.2 Color Tokens

```css
:root {
  /* Primary — Earth Green */
  --c-green-700: #15803D;
  --c-green-600: #16A34A;
  --c-green-500: #22C55E;
  --c-green-100: #DCFCE7;
  --c-green-50: #F0FDF4;

  /* Accent — Harvest Gold */
  --c-gold-700: #A16207;
  --c-gold-500: #EAB308;
  --c-gold-50: #FEFCE8;

  /* Neutrals */
  --c-white: #FFFFFF;
  --c-gray-50: #F9FAFB;
  --c-gray-100: #F3F4F6;
  --c-gray-200: #E5E7EB;
  --c-gray-400: #9CA3AF;
  --c-gray-600: #4B5563;
  --c-gray-800: #1F2937;
  --c-gray-900: #111827;

  /* Semantic */
  --c-success: #22C55E;
  --c-warning: #F59E0B;
  --c-error: #EF4444;
  --c-info: #3B82F6;
}
```

### 3.3 Typography

| Role | Font | Fallback | Weight | Size | Use |
|------|------|----------|--------|------|-----|
| Display | Space Grotesk | system | 700 | 32–48px | Hero headlines, section titles |
| Heading | Space Grotesk | system | 600 | 24–28px | H2–H4, product names |
| Body | Inter | system | 400 | 14–16px | Descriptions, paragraphs, labels |
| Body Strong | Inter | system | 600 | 14–16px | Emphasis, prices |
| Caption | Inter | system | 400 | 12–13px | Metadata, badges, fine print |
| Numeric | Inter | system | 400 | — | `font-variant-numeric: tabular-nums` on all price/stock displays |

```css
/* Global typography */
body { font-family: 'Inter', system-ui, sans-serif; font-size: 16px; line-height: 1.5; color: var(--c-gray-900); }
h1, h2, h3, h4 { font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 600; }
.heading-display { font-weight: 700; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.1; text-wrap: balance; }
.numeric { font-variant-numeric: tabular-nums; }
```

Font loading: `<link rel="preload" as="font">` for Inter + Space Grotesk, `font-display: swap`.

### 3.4 Layout Tokens

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1);

  --container-max: 1200px;
  --grid-gap: 16px;
}
```

**Breakpoints:** 375px (mobile) · 768px (tablet) · 1024px (desktop) · 1440px (wide)

### 3.5 Component Inventory

| Component | Directive | Rendering | Key Notes |
|-----------|-----------|-----------|-----------|
| MegaMenu | `<script>` (vanilla JS) | Static HTML | Desktop: hover/click open, 3-col (dept nav + featured + promo). Mobile: drawer. Zero JS hydration. |
| MobileBottomNav | `<script>` (vanilla JS) | Static HTML | Fixed bottom bar: Home, Shop, Search, Cart, Account. 5 tabs, ≥44px touch. |
| ProductCard | — (static) | Static | Image (lazy), name, price (tabular-nums), "Quick Add" button. Grid layout. |
| ProductCardSkeleton | — (static) | Static | Shimmer placeholder matching ProductCard dimensions. |
| PriceDisplay | `server:defer` | Server island | Fallback: skeleton. Fetches live price + stock + discount %. |
| AddToCartButton | `client:load` (React) | Client island | Minimal React: POST `/api/cart/add`, update cart count, toast. |
| SearchDrawer | `client:load` (React) | Client island | Full-screen overlay: live FTS results via `/api/search?q=`. |
| CartDrawer | `client:load` (React) | Client island | Slide-in drawer: item list, qty adjust, remove, subtotal, CTA. |
| Toast | `client:load` (React) | Client island | `aria-live="polite"`, auto-dismiss 5s, green success / red error. |
| FilterSidebar | `client:load` (React) | Client island | Faceted filters: category, price range, rating. URL-synced. |
| HeroSection | — (static) | Static + ISR | Full-bleed image, bottom-left text block, CTA. Content from ISR. |
| TrustBar | — (static) | Static | Icons + copy: "Lab Tested", "Farmer Approved", etc. |
| SectionProductRow | — (static) | Static + ISR | Horizontal scroll of ProductCards. |
| BreadcrumbNav | — (static) | Static | Schema.org BreadcrumbList markup. |
| StickyCTA | — (static) | Static | Mobile-only fixed bottom bar on PDP: price + "Add to Cart". |

### 3.6 Hero Section — Mid Editorial

The homepage hero follows the "Mid Editorial" anchor from the imagegen skill: product image center-right, text block bottom-left over a semi-transparent scrim, full-bleed farm/biological imagery. Height: 60vh desktop, 50vh mobile. Content from ISR (headline, subtext, CTA label, image URL). No `client:` directive — pure static with CSS overlay.

### 3.7 Section Rhythm (Homepage)

Each homepage section varies its anchor to avoid grid fatigue:

1. **Hero** — Mid Editorial (full-bleed, bottom-left text)
2. **Category Nav** — 3-column cards (image top, text bottom)
3. **Featured Products** — Horizontal scroll row
4. **"How It Works"** — 3-step numbered ( oversized green numeral + icon + copy)
5. **Social Proof** — Bento grid (farmer testimonials + stat callouts)
6. **Blog/Learn Preview** — 2-column: large featured + 2 small stacked

### 3.8 Navigation Structure

**Desktop mega-menu (3 columns):**
```
Departments (Soil | Crops | Compost | Tools)
   ├── Featured Product of the Week
   └── Promo Banner ("Free shipping on ₹500+")
```

**Mobile bottom nav (5 tabs):**
```
Home | Shop | Search | Cart | Account
```

### 3.9 Accessibility Baseline

- Contrast: ≥4.5:1 body, ≥3:1 large text
- Touch targets: ≥44px × 44px
- Skip-to-content link
- Semantic HTML (`<button>`, `<a>`, `<label>`, `<table>`) before ARIA
- Focus-visible rings on all interactive elements
- `prefers-reduced-motion`: disable all non-essential animation
- All images: explicit `width`/`height`, `alt` text, below-fold `loading="lazy"`, hero `fetchpriority="high"`
- `aria-live="polite"` on toasts and async validation messages

---

## 4. Design System — Dashboard (Attio × Linear)

### 4.1 Color Tokens

```css
:root {
  --d-bg: #FAFAFA;
  --d-surface: #FFFFFF;
  --d-surface-glass: rgba(255,255,255,0.72);
  --d-border: #E5E7EB;
  --d-text: #1F2937;
  --d-text-secondary: #6B7280;
  --d-accent: #16A34A;
  --d-accent-light: #DCFCE7;
  --d-error: #EF4444;
  --d-warning: #F59E0B;

  --d-blur: blur(20px);
  --d-radius: 10px;
  --d-sidebar-width: 240px;
  --d-sidebar-collapsed: 64px;
}
```

### 4.2 Typography

| Role | Weight | Size | Notes |
|------|--------|------|-------|
| Sidebar nav | 500 | 13px | Active: green accent, bg highlight |
| Table headers | 600 | 13px | Uppercase, gray-400 |
| Table cells | 400 | 13px | `tabular-nums` for numeric columns |
| Card title | 600 | 14px | Gray-800 |
| Section title | 600 | 16px | Gray-900 |

### 4.3 Layout

- Collapsible sidebar: 240px expanded, 64px collapsed (icons only)
- Main content area: fluid, `padding: var(--space-6)`
- Cards: `background: var(--d-surface)`, `border: 1px solid var(--d-border)`, `border-radius: var(--d-radius)`
- Glass panels: `backdrop-filter: var(--d-blur)`, `background: var(--d-surface-glass)`
- Table: full-width, sticky header, alternating row hover

### 4.4 Dashboard Pages (M1 Minimal)

| Page | Features |
|------|----------|
| `/admin` | Dashboard home: KPI cards (orders today, revenue, stock alerts), recent orders table |
| `/admin/orders` | Orders table: status filter, search, bulk status update |
| `/admin/products` | Products table: edit stock, price, status toggle |
| `/admin/settings` | GST config, store info |

### 4.5 Dashboard Components

| Component | Directive | Notes |
|-----------|-----------|-------|
| Sidebar | `<script>` (vanilla) | Collapse toggle, active route highlight |
| KPICard | — (static) | Server-rendered number + label + trend arrow |
| OrdersTable | `client:load` (React) | Sortable columns, status badges, bulk actions |
| ProductEditor | `client:load` (React) | Inline stock/price editing |
| StatusBadge | — (static) | Color-coded pill: pending=yellow, paid=green, shipped=blue, etc. |

---

## 5. Shared Design Tokens

### 5.1 Motion System (CSS/WAAPI — No JS Library in M1)

**Tokens:**
```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-micro: 150ms;
  --dur-base: 200ms;
  --dur-panel: 300ms;
  --dur-exit: 120ms;
}
```

**Rules:**

| Pattern | Rule | Components |
|---------|------|------------|
| Button press | `press-release-spring` | All CTAs: `scale(0.97)` on `:active`, spring back |
| Card/panel entrance | `spring-pop-entrance` | Product cards on scroll, modals, drawers |
| Stat count-up | `counting-dynamic-scale` | KPI numbers, proof numerals — WAAPI, `tabular-nums` |
| Chart fill | `stat-bars-and-fills` | Progress bars, rating wipes — CSS `scaleX/scaleY` |
| SVG draw | `svg-path-draw` | Order success checkmark, line-art icons — `stroke-dasharray` |
| Idle shimmer | `sine-wave-loop` | Skeleton loaders, low-stock pulse — CSS keyframes |
| Ambient glow | `ambient-glow-bloom` | Hero backlight, toast success glow — CSS radial, ≤0.45 opacity |
| Drawer push | `reactive-displacement` | Filter drawer, cart drawer — `transform: translateX` + `opacity` |
| Menu expand | `center-outward-expansion` | Mega-menu columns, category tile grid — staggered transform |

**Constraints (from HyperFrames + Web Guidelines):**
- **Transforms/opacity only** — never `width/height/top/left` (zero CLS)
- **No `transition: all`** — always list explicit properties
- **`prefers-reduced-motion`** — disable all decorative loops; reduce durations to 0
- **150–300ms** micro-interactions; exit faster than enter (~70%)
- **Interruptible** — CSS transitions/transform respond to input changes mid-motion
- **No tween-time DOM measurement** — coordinates pre-calculated at setup

### 5.2 Icons

- **Library:** Lucide React (1.5px stroke, 24×24 default)
- **Rule:** No emoji as icons. All decorative SVGs get `aria-hidden="true"`. Icon-only buttons get `aria-label`.
- **Brand icons:** Custom SVG only (Firstcrop logo, product category icons)

### 5.3 Responsive Grid

```css
.grid-products {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--grid-gap);
}

/* Mobile: 2 columns */
@media (max-width: 767px) {
  .grid-products { grid-template-columns: repeat(2, 1fr); gap: 8px; }
}
```

### 5.4 Safe Areas (Mobile)

```css
.mobile-bottom-nav,
.sticky-cta {
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## 6. Feature Map — Milestones

### M1: Foundation + Storefront (Primary Deliverable)

**Scope:**
- Home, PLP (server-filtered), PDP (server-island pricing), Cart, 3-step Checkout → Easebuzz
- Phone OTP auth, Account (orders, wishlist, reorder)
- Postgres FTS search
- Mega-menu + mobile bottom-nav + toasts
- GST invoice PDF (server-side)
- Sentry monitoring
- Minimal admin (products, orders, settings)
- Full Web Interface Guidelines compliance gate
- Sample product data seeded

**Routes & Rendering:**

| Route | Rendering | Hydration | Notes |
|-------|-----------|-----------|-------|
| `/` | ISR | None (static) + `server:defer` product prices | Hero + section content from ISR |
| `/products` | ISR + SSR fallback for `?q=` | `client:load` for filters | Faceted: `?category=&min=&max=&sort=` |
| `/products/[slug]` | ISR shell + `server:defer` price | `client:load` for AddToCart | Price/stock never stale |
| `/categories/[slug]` | ISR | `client:load` for filters | Same facet pattern as PLP |
| `/cart` | SSR | `client:load` for CartDrawer | Session-dependent |
| `/checkout` | SSR | `client:load` for address form | Auth-gated |
| `/checkout/payment` | SSR | None (redirect to Easebuzz) | Server-side Easebuzz init |
| `/checkout/confirmation` | SSR | None | Post-payment verify |
| `/account` | SSR | `client:load` for tabs | Auth-gated |
| `/account/orders` | SSR | None (static list) | Auth-gated |
| `/account/wishlist` | SSR | `client:load` for remove | Auth-gated |
| `/auth/login` | SSR | `client:load` for OTP flow | |
| `/auth/verify` | SSR | `client:load` for OTP input | |
| `/search?q=` | SSR | `client:load` for search input | FTS results |
| `/admin` | SSR | `client:load` for tables | Admin role guard |
| `/admin/orders` | SSR | `client:load` for bulk actions | Admin role guard |
| `/admin/products` | SSR | `client:load` for inline edit | Admin role guard |
| `/admin/settings` | SSR | None | Admin role guard |
| `/api/checkout/initiate` | SSR | — | POST: create order + Easebuzz payload |
| `/api/checkout/verify` | SSR | — | POST: verify payment signature |
| `/api/cart/add` | SSR | — | POST: add item to session cart |
| `/api/cart/update` | SSR | — | POST: update qty |
| `/api/cart/remove` | SSR | — | POST: remove item |
| `/api/search` | SSR | — | GET: FTS query |
| `/api/wishlist/toggle` | SSR | — | POST: toggle wishlist |
| `/api/invoice/[orderId]` | SSR | — | GET: GST invoice PDF |

**Data Flow — Checkout:**

```
Cart (Supabase sessions table)
  → POST /api/checkout/initiate (auth required)
    → Validate items + prices (fresh from DB)
    → Calculate GST (CGST/SGST intra-state, IGST inter-state)
    → Create order row (status: pending, idempotency_key)
    → Sign Easebuzz payload
    → Redirect to Easebuzz
  → Easebuzz callback → /checkout/confirmation
    → Verify HMAC signature
    → UPDATE orders SET status='paid' WHERE status='pending' AND id=? 
    → Decrement stock: UPDATE products SET stock_qty = stock_qty - ? WHERE id=? AND stock_qty >= ?
    → If stock check fails: mark order as failed, return error
    → Generate GST invoice PDF
    → Redirect to confirmation page
```

### M2: CRM + User Profiles

- Customer list, order history by customer, communication log
- Lead tracking, follow-up reminders
- Dashboard: customer analytics, LTV calculation

### M3: CMS + Content

- Blog (MDX content collections), learn/how-to guides
- Product descriptions managed via admin
- **Storefront flips to full ISR** — all pages become `cacheNetlify()` with on-demand purge
- Hero/section content editable from admin

### M4: Inventory + Shipping

- Shipping integration (Delhivery/Shiprocket)
- Tracking page, delivery status updates
- Low-stock alerts, automated reorder suggestions
- Batch stock import (CSV upload)

### M5: Marketing

- Coupon system (percentage, flat, free shipping)
- Email campaigns (transactional + marketing)
- Referral program
- Product reviews/ratings

### M6: Analytics + Billing

- Sales dashboard with charts (revenue, orders, AOV, conversion)
- GST filing reports
- Subscription plans (advanced analytics, priority support)
- Easebuzz billing integration for subscriptions

### M7: Multi-store

- Storefront theming per region
- Regional pricing, language (i18n activation)
- Multi-vendor support

---

## 7. SEO Strategy

- **Structured data:** Product schema (name, price, availability, image), BreadcrumbList, Organization, FAQ
- **Meta:** Dynamic `<title>` / `<meta description>` from product/category data
- **Sitemap:** Auto-generated via `@astrojs/sitemap`
- **Canonical:** Self-referencing canonicals on all pages
- **Images:** WebP/AVIF via Netlify Image CDN, explicit dimensions, alt text
- **Performance:** <3s LCP on 3G (static/ISR pages serve from CDN edge)
- **URL structure:** `/products/[slug]`, `/categories/[slug]`, `/blog/[slug]`

---

## 8. Testing Strategy

| Type | Tool | Scope |
|------|------|-------|
| Unit | Vitest (future) | Utility functions, GST calculations |
| E2E | Playwright (existing) | Full checkout flow, auth, search |
| Visual | Playwright screenshots | Homepage, PDP, PLP at 375/768/1024/1440 |
| Accessibility | axe-core + manual | WCAG 2.1 AA compliance |
| Performance | Lighthouse CI | Core Web Vitals thresholds |
| UI Compliance | Web Interface Guidelines review | Per-milestone gate |

---

## 9. Monitoring

- **Sentry:** `@astrojs/sentry` integration, source maps uploaded at build
- **Webhook logs:** `webhook_logs` table for all Easebuzz callbacks (signed/unsigned, processed/failed)
- **Audit log:** `audit_log` table for all admin actions, order status changes
- **Error boundaries:** React error boundaries on all `client:` islands; Astro error page for SSR failures

---

## 10. UI Compliance Gate (Per Milestone)

Before each milestone ships, run a full review against the [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Findings in `file:line` format, all fixed before merge.

**Key rules codified into `AGENTS.md`:**

### Accessibility
- Icon-only buttons: `aria-label`
- Form controls: `<label>` or `aria-label`
- Interactive elements: keyboard handlers
- `<button>` for actions, `<a>` for navigation (not `<div onClick>`)
- Images: explicit `alt` (or `alt=""` if decorative)
- Decorative icons: `aria-hidden="true"`
- Async updates: `aria-live="polite"`
- Semantic HTML before ARIA
- Headings: hierarchical `<h1>`–`<h6>`, skip link

### Focus
- `:focus-visible` rings everywhere
- Never bare `outline:none` without focus replacement
- Sticky elements never cover focused element

### Forms
- `autocomplete`, `name`, correct `type`/`inputmode`
- Labels: clickable, single hit target with control
- Errors: inline, focus first on submit
- Submit: enabled until request starts, spinner during
- Placeholders: end with `…`, show example pattern

### Typography
- `…` not `...`
- Curly quotes `“”` not straight `"`
- `tabular-nums` on all numeric columns
- `text-wrap: balance` on headings
- Loading states: `"Loading…"`
- Numerals for counts: "8 orders" not "eight"

### Content
- Text containers: `truncate` or `line-clamp-*`
- Flex children: `min-w-0` for truncation
- Empty states handled gracefully
- Active voice, second person, specific button labels

### Images
- Explicit `width`/`height` (CLS prevention)
- Below-fold: `loading="lazy"`
- Above-fold hero: `fetchpriority="high"`
- No animated GIFs (use `<video>` with still fallback)

### Performance
- 50+ item lists: virtualize
- No layout reads in render
- `<link rel="preconnect">` for CDN domains
- Critical fonts: preload + `font-display: swap`
- `<video autoplay muted loop playsinline>` over GIF

### Navigation
- URL reflects state (filters, tabs, pagination)
- Links use `<a>` (Cmd/Ctrl+click support)
- Deep-link all stateful UI
- Destructive actions: confirmation modal or undo

### Touch
- `touch-action: manipulation`
- `overscroll-behavior: contain` in modals/drawers
- Drag/swipe: tap/click + keyboard alternatives

### Safe Areas
- `env(safe-area-inset-*)` on fixed mobile elements
- `overflow-x-hidden` on containers

### Anti-Patterns (Flagged)
- `user-scalable=no`
- `transition: all`
- Gesture-only without tap/keyboard
- `<div onClick>` navigation
- Images without dimensions
- Form inputs without labels
- Hardcoded date/currency formats (use `Intl.*`)

---

## 11. Migration Plan (Existing Repo)

The current repo has:
- `astro.config.mjs` — static-only, needs `output: 'server'` + Netlify adapter
- `src/pages/index.astro` — minimal starter (replace with homepage)
- `DESIGN.md` — Nike-inspired (replace with this spec's design systems)
- `CLAUDE.md` — project conventions (update with new commands/structure)

**Migration steps (M1 kickoff):**
1. Install `@astrojs/netlify`, `@supabase/supabase-js`, `@supabase/ssr`, `@astrojs/sentry`, `lucide-react`
2. Run `astro create-key` → set `ASTRO_KEY` env var (server island encryption)
3. Update `astro.config.mjs` with `output: 'server'`, Netlify adapter, `cacheNetlify()`
4. Create `integrations/cache-netlify.mjs` (custom integration wrapping Netlify cache API with cache-tag support)
5. Replace `DESIGN.md` with storefront + dashboard token references
6. Update `CLAUDE.md` with new project structure, commands, conventions
7. Create `src/env.d.ts` with `astro:env` schema + session types
8. Create `src/lib/supabase/server.ts` and `client.ts`
9. Create layout components (`BaseLayout.astro`, `DashboardLayout.astro`)
10. Create global CSS with token definitions (§3.2, §3.4, §4.1, §5.1)
11. Seed sample products
12. Build pages per route table above

---

## Appendix A: Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Output mode | `server` (not `hybrid`) | Most pages need freshness; static pages opt-in with `prerender = true` |
| Cart storage | Supabase sessions table | Cross-device, persists across sessions |
| Auth | Supabase phone OTP | Indian market — phone primary, email secondary |
| Payments | Easebuzz | Indian gateway, sandbox available |
| Stock management | Decrement-only at purchase | Simple, no reservation complexity for M1 |
| Search | Postgres FTS (`tsvector`) | No external dependency, good enough for M1 |
| Motion runtime | CSS/WAAPI in M1 | Zero-JS catalog pages, meets all interaction needs |
| Design split | Two systems (storefront + dashboard) | Different audiences, different density needs |
| Fonts | Space Grotesk + Inter | Distinct display, clean body, both load fast |
| GST | Server-side PDF generation | Compliance requirement from day one |
| Monitoring | Sentry from M1 | Catch errors early, set up alerting |
| Guidelines | Full Web Interface Guidelines per milestone | Ship accessible, compliant UI from start |
