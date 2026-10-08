# Audit Report — RENDI VIRGO

Date: 30 September 2026
Project: `/Users/drefan/Projects/RENDI VIRGO`
Scope: baseline, build, tests, type safety, dependencies, security review, and deployment readiness.

## Important limitation
The audit was run against the project source using Hermes Lead Agent tools. Direct control of the Codex desktop window was unavailable because the desktop-control daemon was not running.

## Score

**76/100**

### Score breakdown

- Build and type safety: 18/20
- Unit tests: 17/20
- Structure and maintainability: 16/20
- Security: 13/20
- Dependency and deployment readiness: 12/20

## Stage 1 — Baseline

- Branch: `main`
- Repository was synchronized with `origin/main` before audit.
- Existing local change: `.codex/` configuration.
- Stack: Next.js 16.3.3, React 19.2.0, NestJS API, Prisma 7.x, PostgreSQL.
- Main areas: storefront/admin, API, auth/session cookies, catalog, orders, reviews, payments, uploads, and reports.

## Stage 2 — Quality gates

All passed:

- `npm run lint` — PASS; this currently runs `tsc --noEmit`.
- `npm test` — PASS; 33 tests passed, 0 failed.
- `npm run build` — PASS; 40 static pages generated.
- `npm --prefix api run typecheck` — PASS.
- `npm run build:api` — PASS.
- Root `npm audit --omit=dev` — 0 vulnerabilities.

## Stage 3 — Findings

### High

1. API dependency audit reports four high-severity transitive findings involving `deepmerge-ts` and `mysql2`, pulled through Prisma. `npm audit fix --force` proposes a breaking Prisma change and must not be applied blindly.
2. JSON-LD is inserted with `dangerouslySetInnerHTML` without consistent `<` escaping in:
   - `app/(storefront)/page.tsx`
   - `app/(storefront)/blog/[slug]/page.tsx`
   Content such as store settings, blog title, excerpt, or author may be admin-controlled. This can create stored-XSS risk through a `</script>` payload.

### Medium

3. Magic-link tokens are placed in query strings (`/orders?token=...`) and the API logger records `request.originalUrl`, increasing the chance of token exposure in logs or history.
4. `api/src/orders/orders.service.ts` falls back from `SESSION_SECRET` to `ADMIN_PASSWORD`, and finally to `rv-insecure-development-secret`. Production should fail fast if `SESSION_SECRET` is missing.
5. The `lint` script only runs TypeScript checking; ESLint is not configured as a quality gate.
6. No E2E coverage was found for admin login, checkout, order tracking, magic-link history, uploads, or payment callbacks.

## Recommendations

### Priority 1

1. Escape all JSON-LD payloads before `dangerouslySetInnerHTML`, for example:
   `JSON.stringify(data).replace(/</g, "\\u003c")`.
2. Require `SESSION_SECRET` in production and remove insecure fallbacks.
3. Prevent magic-link tokens from being logged and avoid sensitive tokens in query strings where practical.
4. Review the Prisma dependency tree and resolve the API audit findings through a tested upgrade path.

### Priority 2

5. Add ESLint and run it in CI.
6. Add E2E tests for admin, checkout, tracking, magic links, uploads, and payment callbacks.

### Priority 3

7. Run staging verification on Coolify.
8. Verify HTTPS, secure cookies, CORS, proxy settings, security headers, and database health checks.
9. Add a deployment smoke test for `/api/health`, `/`, `/shop`, and `/admin`.

No application source code was modified during the audit.
