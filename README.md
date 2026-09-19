# DSAC Public Entity & NPO Reporting and Oversight Platform

**Demo – synthetic data.** A hackathon prototype for the GovTech Hackathon 2026 (SITA), built against the
Department of Sport, Arts and Culture (DSAC) reporting-and-oversight challenge.

DSAC funds 26 public entities and 6 NPOs. This platform replaces email, spreadsheets and PDFs with **one
standardised digital reporting system**: entities capture their KPIs and expenditure in a fixed structure, and
DSAC sees the consolidated portfolio — approved, disbursed and utilised money, KPI performance, compliance and
outstanding reports — automatically, live, and drillable down to a single KPI or budget line.

> *Simple at the top. Detailed when the user clicks deeper. Standardised reporting on the entity side;
> automatic consolidation on the DSAC side.*

All data in this repository is synthetic and fictional. No real DSAC entities, officials or figures are
represented.

## Quick start

Prerequisites: Node.js 20+, [pnpm](https://pnpm.io), Docker Desktop.

```bash
pnpm install
pnpm setup            # starts Postgres/MinIO/Mailpit, applies migrations, seeds demo data
pnpm build && pnpm start   # production mode — recommended (every page in ~1s)
# or: pnpm dev              # development mode with hot reload (slower on a low-memory machine)
```

Open <http://localhost:3000> and sign in with any one-click demo account (shared password: `Demo@2026`).
Try **Thandiwe Mokoena** (DSAC Admin) and **Lindiwe Dube** (an entity) side by side. The walkthrough is in
[`docs/DEMO.md`](docs/DEMO.md).

## The two experiences

**DSAC** (Admin, Analyst, Executive Viewer) — sidebar: **Dashboard · Entities & NPOs · Reports · Requests /
Support · Alerts · Administration**.

- **Dashboard** — portfolio cards (public entities, NPOs, reports submitted/outstanding, compliance rate, KPI
  performance), financial cards (approved, disbursed, utilised, utilisation) with an Approved → Disbursed →
  Utilised flow, and "where DSAC needs to intervene".
- **Entities & NPOs** — searchable list with compliance and performance status. Selecting one opens an oversight
  page with the **same six tabs for every organisation**: Overview · Performance · Finance · Compliance ·
  Reports · Profile.
- **Reports** — every required submission across the portfolio; review, accept, return (with a reason) and finalise.
- **Requests / Support** — decide budget and support requests.
- **Alerts** — which organisations need intervention and why, plus the explainable early-warning score.
- **Administration** (Admin only) — the reporting standards and formulas, and the audit log.

**Entity / NPO portal** — sidebar: **Dashboard · Performance · Finance · Compliance · Reports · Requests ·
Documents · Profile**. Each quarter the entity enters *only the latest* KPI results and expenditure; the system
accumulates year-to-date, variance, achievement and utilisation. It then submits the report to DSAC.

## One source of truth for every amount and percentage

Money and percentages are the easiest thing to get subtly wrong across many screens, so they are computed in
exactly one place and everything else reads from it:

- **`src/lib/calc/`** — pure, unit-tested functions: money (all addition through integer cents, so no
  floating-point drift), finance, KPI performance, compliance. The tests use the worked examples from the brief
  (R20m / R15m / R11.5m → 76.7% and 57.5%; 8,300 vs 9,000 → −700 and 92.2%; the expense-line table; the
  compliance colours; the due dates).
- **`src/lib/data/metrics.ts`** — turns raw rows into finance, performance and compliance figures for any set
  of entities. **Every** screen — the DSAC dashboard, the entities list, all six entity tabs, the entity portal,
  the Excel/PDF export, "Ask the data" and the risk engine — reads from this. A portfolio figure is the entity
  figures *pooled* (raw amounts and counts summed first, ratios derived last), never an average of percentages.

The definitions (also shown in-app under **Administration → Reporting standards**):

| Figure | Formula |
|---|---|
| Approved budget | Sum of the entity's approved expense lines |
| Actual expenditure to date | Sum of every reported quarter's expenditure (Q2 is added to Q1, and so on) |
| Remaining budget | Approved − actual |
| **Budget utilisation** | Actual ÷ **approved** annual budget (every expense line; the entity Overview) |
| **Utilisation of disbursed funds** | Actual ÷ **disbursed** (the portfolio's headline "Overall utilisation"; the entity Finance summary) |
| Achievement | YTD actual ÷ YTD target → Achieved ≥ 100% · On Track ≥ 85% · At Risk ≥ 60% · Not Achieved |
| Overall performance | (Achieved + On Track) ÷ KPIs with a target due |
| Compliance rate | Reports delivered on time ÷ reports assessed (delivered, or past due) |

The brief uses both utilisation measures (75% = utilised ÷ disbursed for the portfolio; 57.5% = utilised ÷
approved on the entity dashboard), so both are shown, always with an explicit label.

Two commands prove the numbers agree:

```bash
pnpm verify:data    # recomputes the totals a second, independent way (raw DB aggregates) and compares them
                    #   with what every screen uses — per entity, per budget line, per KPI, and the portfolio
pnpm verify:flows   # against a running app: logs in as DSAC and as an entity, changes real numbers the way a
                    #   user would, and checks each figure moves by exactly the right amount on every screen
                    #   and every role guard holds. Writes to the DB — run on fresh data, reseed afterwards
```

## What `pnpm setup` does

1. `docker compose up -d` — Postgres, MinIO (S3-compatible file storage) and Mailpit (SMTP catcher).
2. `prisma migrate deploy` — applies the schema.
3. `tsx prisma/seed.ts` — seeds 32 organisations across three financial years: approved budgets split over the
   seven standard expense lines, quarterly disbursement tranches, quarterly expenditure, KPIs in the standard
   Programme → Objective → KPI structure with phased quarterly targets, every required report with a realistic
   workflow status (draft, submitted, under review, accepted, returned, finalised, overdue), support requests,
   audit findings, aggregated workforce data, demo users across all five roles, and evidence documents uploaded
   as real files to the local MinIO bucket. It ends by computing real risk scores.

The seed is deterministic (fixed random seed). Re-run `pnpm db:seed` any time to reset it.

**"Today" and the seed.** Which reports are overdue or due soon depends on the date. The app and the seed both
read the clock through `src/lib/clock.ts`; set `APP_TODAY="2026-09-19"` in `.env` to freeze it for a repeatable
demo (then `pnpm db:seed`).

`pnpm start` / `pnpm dev` run two processes (via `concurrently`): the Next.js app, and a background worker
(`scripts/worker.ts`, pg-boss) that recalculates risk every 15 minutes, checks report deadlines every 10
minutes and sends a weekly risk briefing. It is a separate process rather than wired through Next's
`instrumentation.ts` because pg-boss depends on Node-only `pg`, which Next would try to bundle for the edge
runtime that `middleware.ts` uses. Run it alone with `pnpm worker`, or the app alone with `pnpm dev:next`.

## Reporting workflow

- **Reports** — each entity has a report row per requirement: a quarterly performance report, a quarterly
  financial report and a governance return for each quarter, plus the annual report. Due dates follow the
  standard calendar (Q1 reports 31 Jul; governance return 15 Aug; annual report 31 Aug).
- **Workflow** — Draft → Submitted → Under review → Accepted / Returned for correction → Finalised.
- **Attachments are evidence.** The captured figures *are* the report; documents attach to a report, KPI or
  budget line. A report can't be submitted until it's complete (every KPI has a result, every budget line has
  an expenditure, a variance reason where a KPI is At Risk/Not Achieved, evidence where the report is
  document-based) — the Reports page lists what's missing.
- **Locking** — once submitted, a quarter's figures are read-only until DSAC returns the report.
- **Alerts** — reminders at the configured day thresholds before a deadline (`DEADLINE_ALERT_DAYS`, default
  30 and 15), daily in the final stretch, and an escalation to DSAC once overdue; a returned report notifies the
  entity with DSAC's reason.

## Local ports

| Service | Port | Notes |
|---|---|---|
| App | 3000 | `pnpm start` / `pnpm dev` |
| Postgres | 5434 | Moved off the default port because this dev machine already had other Postgres instances. Adjust in `docker-compose.yml` + `.env` if yours are free. |
| MinIO API / Console | 9000 / 9001 | Console login: `dsac_minio` / `dsac_minio_password` |
| Mailpit web UI | 8025 | View "sent" emails here |

## Roles & demo accounts

Five roles, enforced in the data-access layer (not just the UI) — an entity user can only ever read or write
their own organisation's data:

- **DSAC Admin** — everything DSAC can do, plus finalising reports and Administration (standards, audit log).
- **DSAC Analyst / Manager** — portfolio-wide view; reviews reports and decides requests; gets alerts.
- **Executive Viewer** — read-only dashboards.
- **Entity Admin / Entity Contributor** — capture performance and expenditure, submit reports, raise requests,
  upload evidence for their own organisation.

The login page lists featured one-click demo accounts. Every seeded organisation also has an admin and a
contributor (`admin.<entity-slug>@<entity-slug>.demo.org`, same shared password).

## What's real vs. mocked

| Area | Status |
|---|---|
| Auth (demo credentials) | Real — bcrypt-hashed passwords, JWT sessions |
| Auth (Microsoft Entra ID) | Wired up, inactive until `MICROSOFT_ENTRA_ID_*` env vars are set |
| Tenant isolation & RBAC | Real — `src/lib/tenant-scope.ts`, used by every data-access function and re-checked in each write path; unit-tested |
| Database + seed data | Real — Postgres via Prisma; deterministic synthetic dataset; money stored as `Decimal(14,2)` |
| Finance, performance, compliance, reports, requests | Real — see above. Data capture, report submission, DSAC review, requests workflow, and completeness checks are all live and verified end to end (`pnpm verify:flows`) |
| Dashboards, entity tabs, exports | Real — Excel (totals come from the pooled portfolio figures) and PDF export of the portfolio |
| Early-warning engine | Real — transparent weighted score (KPI shortfall, late/outstanding reports, unresolved audit findings, returned reports, deadline proximity, spend-vs-delivery mismatch) with a per-factor breakdown, plus a small logistic regression trained on the platform's own history (year *n* predicts year *n*+1). Built from the same figures as the dashboards |
| Notifications | Real in-app (bell) and email (Mailpit); Teams is a real webhook POST when `TEAMS_WEBHOOK_URL` is set, else a logged no-op |
| Document repository | Real — versioned uploads with SHA-256 checksums, DSAC review workflow, signed expiring URLs, evidence links to a report / KPI / budget line. PDF and text preview inline; Word/Excel download-only |
| File storage (MinIO) | Real — S3-compatible adapter (`src/lib/storage.ts`), signed URLs only |
| "Ask the data" | Real — a fixed set of tenant-scoped query tools (never raw SQL) over the same data functions; without `ANTHROPIC_API_KEY` a keyword router calls the same tools and answers from real data |
| Document AI assist, weekly briefing | Real with `ANTHROPIC_API_KEY`; honest deterministic fallback without it. Always suggestions — never a decision. Text/CSV only |
| AI safeguards | PII redaction on everything sent to Claude; every AI call logged to the append-only audit log |
| Audit log | Real, append-only — report submissions and reviews, data capture, requests, document views/downloads/decisions, AI calls. **Administration → Audit log** (DSAC Admin) |
| Microsoft Graph layer | Interface + mock only (`src/lib/microsoft/graph.ts`) — no Azure AD app to test against. SharePoint link buttons say "(mock)" when unconfigured |
| Validation, rate limiting, CSRF, headers | Real — `zod` schemas on every write; per-user rate limit; Origin check on mutating routes; CSP and security headers on every response |
| PWA | Real in production builds (installable, service worker). Disabled in dev on purpose — a service worker caching assets during development causes stale-asset confusion |
| Retention / purge | Advisory only — a retention date is set and shown; no job deletes expired documents |
| Tasks & threaded comments | Built in an earlier iteration and **left in the codebase but out of the navigation** — the brief keeps the product deliberately simple. The `/tasks` route and comment APIs still work if you want them back |
| Tests | Vitest unit suite (calculation library incl. every worked example from the brief, tenant isolation, role matrix, ML model, PII redaction, rate limiting); `pnpm verify:data`, `pnpm verify:flows`; Playwright e2e in a real browser |

See [`docs/SECURITY.md`](docs/SECURITY.md) for the security and privacy posture and an honest list of gaps.

## Tech stack

Next.js 15 (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui (Base UI primitives), Recharts, PostgreSQL +
Prisma 6, Auth.js v5, MinIO (S3-compatible), pg-boss, Anthropic Claude API, Docker Compose, pnpm, Vitest +
Playwright.

Deliberate pins: Next.js 15.x (the brief's spec) and Prisma 6.x (7 needs driver adapters and
`prisma.config.ts` — more migration than a prototype needs). shadcn's primitives are Base UI rather than Radix
in this version — composition uses a `render` prop instead of `asChild`.

## Scripts

```bash
pnpm dev              # app + background worker, hot reload
pnpm dev:next         # app only, no worker
pnpm build            # production build (stop any running server first)
pnpm start            # app + worker in production mode
pnpm worker           # worker only
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit (run a build first: it generates route types)
pnpm test             # Vitest
pnpm verify:data      # reconcile every total against the database
pnpm verify:flows     # end-to-end flows against the running app (writes data; reseed after)
pnpm test:e2e         # Playwright — first run: npx playwright install chromium
pnpm docker:up / docker:down
pnpm db:migrate       # prisma migrate dev
pnpm db:seed          # reset the synthetic data
pnpm db:reset         # drop, re-migrate, re-seed
pnpm db:studio        # Prisma Studio
```

**Build hygiene.** Never run `pnpm build` while `pnpm dev` or `pnpm start` is running — it corrupts the live
`.next` output (unstyled pages, 404 assets). Stop the server, build, start again. On a memory-constrained
machine `next.config.ts` caps the build-worker pool (`experimental.cpus: 2`) and disables the dev filesystem
cache; production mode avoids per-route dev compilation entirely.

## Further reading

- [`docs/DEMO.md`](docs/DEMO.md) — the 5-minute demo script, with exact figures.
- [`docs/SECURITY.md`](docs/SECURITY.md) — security and privacy posture, POPIA/NCPF alignment, known gaps.
- [`src/lib/microsoft/README.md`](src/lib/microsoft/README.md) — Microsoft Graph integration layer: what's
  mocked, and the scopes a real implementation would need.
