# DSAC Public Entities Performance & Reporting Platform

**Demo – synthetic data.** A hackathon prototype for the GovTech Hackathon 2026 (SITA), built against the
Department of Sport, Arts and Culture (DSAC) *Public Entities Reporting System* challenge statement.

DSAC funds 26 Public Entities and 6 NPOs, who currently report on targets and fund usage by email. This
platform gives DSAC a single portfolio view of performance, spend and compliance across all 32 entities,
with AI-assisted early warning so risks surface before deadlines are missed — instead of after.

All data in this repository is synthetic and fictional. No real DSAC entities, officials or figures are
represented.

## Quick start

Prerequisites: Node.js 20+, [pnpm](https://pnpm.io), Docker Desktop.

```bash
pnpm install
pnpm setup   # starts Postgres/MinIO/Mailpit, applies migrations, seeds demo data
pnpm dev
```

Open <http://localhost:3000> and sign in with any one-click demo account on the login page (shared demo
password: `Demo@2026`).

### What `pnpm setup` does

1. `docker compose up -d` — Postgres, MinIO (S3-compatible file storage) and Mailpit (SMTP catcher).
2. `prisma migrate deploy` — applies the schema.
3. `tsx prisma/seed.ts` — seeds 26 Public Entities + 6 NPOs, 3 financial years of KPIs/finance/audit
   history, workforce stats, job-creation figures and demo users across all 5 roles.

Re-run `pnpm db:seed` any time to reset the synthetic story (it's idempotent — it clears and re-seeds).

## Local ports

| Service | Port | Notes |
|---|---|---|
| App | 3000 | `pnpm dev` |
| Postgres | 5434 | Moved off the default 5432/5433 — this dev machine already had other local Postgres instances bound to those ports. Adjust in `docker-compose.yml` + `.env` if yours are free. |
| MinIO API / Console | 9000 / 9001 | Console login: `dsac_minio` / `dsac_minio_password` |
| Mailpit web UI | 8025 | View "sent" emails here |

## Roles & demo accounts

Five roles, enforced in the data-access layer (not just the UI) for tenant isolation — entity-scoped
users can only ever query their own entity's data:

- **DSAC Admin** — manages entities, cycles, targets, users. Only role with audit-log access.
- **DSAC Analyst / Manager** — portfolio-wide view, reviews/approves submissions, gets alerts.
- **Entity Admin** — manages one entity's users and submissions.
- **Entity Contributor** — uploads, edits, comments, completes tasks.
- **Executive Viewer** — read-only dashboards.

The login page lists featured one-click demo accounts (including a "healthy" entity and a "critical" one
for contrast), and the header's user menu lets you switch between them mid-session without re-typing a
password. Every seeded entity actually has at least one admin + one contributor account if you want to
sign in as any of the other 32 entities directly (`admin.<entity-slug>@<entity-slug>.demo.org`, same
shared password).

## What's real vs. mocked right now (Phase 1)

| Area | Status |
|---|---|
| Auth (demo credentials) | Real — bcrypt-hashed passwords, JWT sessions |
| Auth (Microsoft Entra ID) | Wired up, inactive until `MICROSOFT_ENTRA_ID_*` env vars are set |
| Tenant isolation | Real — enforced in `src/lib/current-user.ts`, used by the dashboard query |
| Database + seed data | Real — Postgres via Prisma, full synthetic dataset |
| File storage (MinIO) | Bucket provisioned; no upload UI yet (Phase 3) |
| Analytics dashboard | Minimal smoke-test view only; full Module A lands in Phase 2 |
| Document repository, early warning, workspaces, AI features | Not built yet — placeholder routes exist with phase labels |

Every integration (Entra ID, Microsoft Graph, Teams, email, Claude AI) is designed to fall back to a
mock or a no-op when unconfigured, so the demo never breaks because a credential is missing. See
`.env.example` for what's optional.

## Tech stack

Next.js 15 (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui (Base UI primitives), Recharts,
PostgreSQL + Prisma 6, Auth.js v5, MinIO (S3-compatible), pg-boss, Anthropic Claude API, Docker Compose,
pnpm, Vitest + Playwright.

A couple of deliberate pins versus "latest": Next.js is pinned to 15.x (the brief's spec; 16 was current
`latest` at scaffold time) and Prisma is pinned to 6.x (7 requires driver adapters + `prisma.config.ts`,
which is more migration than a hackathon prototype needs). shadcn's underlying primitives are Base UI
rather than Radix in this version — composition uses a `render` prop instead of `asChild`.

## Scripts

```bash
pnpm dev            # start the app
pnpm build           # production build
pnpm lint            # ESLint
pnpm typecheck        # tsc --noEmit
pnpm test            # Vitest
pnpm test:e2e         # Playwright
pnpm docker:up / docker:down
pnpm db:migrate        # prisma migrate dev
pnpm db:seed          # re-seed synthetic data
pnpm db:reset          # drop, re-migrate, re-seed
pnpm db:studio         # Prisma Studio
```

## Project status

Building in phases per the project brief, committing at the end of each and keeping the app runnable
throughout:

- [x] **Phase 1** — scaffold, Docker Compose, Prisma schema, auth + demo role switcher, seed data, app
      shell/navigation.
- [ ] Phase 2 — DSAC portfolio dashboard + entity drill-down (Module A).
- [ ] Phase 3 — document repository with versioning and review workflow (Module C).
- [ ] Phase 4 — early-warning engine, deadlines, countdowns, notifications (Module B).
- [ ] Phase 5 — workspaces: tasks, real-time comments, Microsoft integration layer (Module D).
- [ ] Phase 6 — AI features: briefings, document extraction, ask-the-data (Module A/B/C, mocked).
- [ ] Phase 7 — security hardening, audit log viewer, `SECURITY.md`, tests, PWA polish (Module E).
- [ ] Phase 8 — demo script (`docs/DEMO.md`).
