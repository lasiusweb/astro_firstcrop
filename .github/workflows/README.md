# GitHub Actions Workflows

## Playwright Tests (.github/workflows/tests.yml)

**Triggers:** Push to `main`/`develop`, or any PR to `main`/`develop`

**What it does:**
1. Checks out code
2. Sets up Node.js 22.12.0 (with npm cache)
3. Installs dependencies (`npm ci`)
4. Installs Playwright browsers
5. Builds the site (`npm run build`)
6. Runs all Playwright tests (`npm test`)
7. Uploads test reports as artifacts (30-day retention)
8. Comments on PRs with pass/fail status

**Artifacts:**
- `playwright-report/` - Full HTML test report (30 days)
- `test-results/` - Failure details if tests fail (7 days)

**PR Integration:**
- Automatically comments with test status on PRs
- Does not block merges (informational only)
- To see detailed reports, download artifacts from the Actions tab

**Modifying the workflow:**
- To add branches: Update `branches:` in the `on:` section
- To change Node.js version: Update `node-version` in the matrix
- To require passing tests for merge: Add branch protection rules in Settings > Branches
