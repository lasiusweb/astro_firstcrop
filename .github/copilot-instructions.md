# Copilot Instructions for astro_firstcrop

## Project Overview

This is a minimal Astro 7.2.4 static site starter project. The codebase is intentionally lightweight with room for growth.

## Commands

### Development
- `npm run dev` - Start local dev server at `localhost:4321` (use `astro dev --background` for background mode)
- `npm run build` - Build production site to `./dist/`
- `npm run preview` - Preview production build locally before deploying
- `npm run astro -- [command]` - Run arbitrary Astro CLI commands
- `npm run astro -- --help` - Get help on Astro CLI

### Testing (Playwright)
- `npm test` - Run all Playwright tests (headless)
- `npm run test:ui` - Run tests with interactive UI (browser windows visible)
- `npm run test:debug` - Run tests with debugger attached
- `npx playwright show-report` - View HTML test report after runs
- `npx playwright codegen http://localhost:4321` - Record new test by interacting with page

### Background Server Management
When using `astro dev --background`:
- `astro dev stop` - Stop the background server
- `astro dev status` - Check server status
- `astro dev logs` - View server logs

## Architecture

### Directory Structure
```
src/
├── pages/           # Routes (each .astro/.md file = one route)
└── components/      # (Create as needed) Reusable Astro/framework components
public/             # Static assets (images, fonts, etc.)
dist/               # Build output (generated, not committed)
```

### Routing
- File-based routing in `src/pages/`
- `.astro` files become HTML routes
- `.md` files can be converted to pages via content collections
- Dynamic routes via `[slug].astro` or `[...slug].astro`
- Learn more: https://docs.astro.build/en/guides/routing/

### Component System
- Create `.astro` files for Astro components (interactive or not)
- Place in `src/components/` by convention
- Can integrate React, Vue, Svelte, Preact, Solid, etc. with `client:*` directives
- By default, components are server-rendered (no JavaScript sent to client)
- Learn more: https://docs.astro.build/en/basics/astro-components/

## Conventions

### TypeScript
- Project uses `astro/tsconfigs/strict` for strict type checking
- Type definitions: `.astro/types.d.ts` is auto-generated
- `tsconfig.json` is configured to exclude `dist/` from type checking

### Static Assets
- Place images, fonts, and static files in `public/`
- Reference with root-relative paths: `/favicon.svg`, `/images/logo.png`
- Assets in `public/` are served as-is; never processed or bundled

### Styling
- Astro supports `.css`, `.scss`, `.less` scoped to components
- Scoped styles don't leak outside a component
- For global styles, create a CSS file and import it (e.g., in a layout)
- Tailwind CSS can be added with `npm run astro add tailwind`
- Learn more: https://docs.astro.build/en/guides/styling/

### Development Workflow
- Changes to `.astro` files and `public/` trigger hot reload
- Restart dev server if `astro.config.mjs` or environment variables change

## Environment

**Node.js:** >= 22.12.0
**Dependencies:** astro ^7.2.4
**Dev Dependencies:** @playwright/test ^1.62.1
**Output:** Static HTML (no server-side rendering by default)

## Key Documentation Links

- [Astro Documentation](https://docs.astro.build/)
- [Adding pages, dynamic routes, middleware](https://docs.astro.build/en/guides/routing/)
- [Framework components (React/Vue/Svelte)](https://docs.astro.build/en/guides/framework-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling & CSS](https://docs.astro.build/en/guides/styling/)
- [Internationalization (i18n)](https://docs.astro.build/en/guides/internationalization/)

## Next Steps When Growing the Project

- Add linting: `npm run astro add prettier` or integrate ESLint
- Write more e2e tests: Add tests in `tests/e2e/*.spec.ts`
- Add styling framework: `npm run astro add tailwind`
- Add database/CMS integration: Content collections or third-party APIs
- Add analytics: Integrate provider of choice (Vercel Analytics, Plausible, etc.)

## Testing

### Playwright Setup
Tests are located in `tests/e2e/` and configured in `playwright.config.ts`. The dev server starts automatically when running tests.

**Key features:**
- Multi-browser testing (Chrome, Firefox, Safari, mobile)
- Automatic dev server startup
- CI-friendly with retries and parallel workers
- HTML report generation
- Interactive UI and debugger modes

**Example test structure:**
```typescript
import { test, expect } from '@playwright/test';

test('page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Expected text');
});
```

See `tests/e2e/homepage.spec.ts` for sample tests.

### CI/CD (GitHub Actions)
Tests run automatically on:
- Every push to `main` or `develop` branches
- Every pull request to `main` or `develop` branches

**Workflow details (.github/workflows/tests.yml):**
- Builds the site before testing (`npm run build`)
- Runs full Playwright test suite
- Installs Playwright browsers
- Uploads test reports as artifacts (30-day retention)
- Comments on PRs with test status
- Matrix support for multiple Node.js versions (currently 22.12.0)

**To skip tests on a commit:** Add `[skip ci]` to your commit message (not recommended)
