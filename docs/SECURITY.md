# Security & Privacy

This document describes the security and privacy posture of the DSAC Public Entities Performance &
Reporting Platform — a **hackathon prototype using entirely synthetic data**. Nothing in this
document should be read as a compliance certification. Controls below are described as **"designed
to align with"** the referenced frameworks, not as an audited or attested compliance claim. A
production deployment handling real entity or personal data would need a full POPIA compliance
review, a penetration test, and sign-off from DSAC's Information Officer before go-live.

## 1. Data classification and minimisation

- **Workforce data is aggregated only.** `WorkforceStat` stores headcounts by gender, race category,
  age band and disability status — never individual employee records, names, or ID numbers. Every row
  carries a `piiClassification` tag (`NONE | AGGREGATED | PERSONAL | SENSITIVE`; workforce rows default
  to `AGGREGATED`), so any future model that *does* need to store more granular data has to declare
  that fact explicitly rather than inheriting a default.
- **No South African ID numbers, banking details, or biometric data** are collected anywhere in the
  schema. Demo user accounts use only name, work email, and role.
- **AI inputs are redacted before leaving the platform.** `src/lib/ai/redact.ts` strips ID-number-shaped
  sequences, phone numbers and email addresses from any free text (document content, "ask the data"
  questions) before it's sent to Claude. This is defence-in-depth on top of the data-minimisation above,
  not a substitute for it.

## 2. Access control

- **Role-based access control**: five roles (DSAC Admin, DSAC Analyst, Entity Admin, Entity
  Contributor, Executive Viewer), each with a fixed capability set defined in `src/lib/constants.ts`
  (`DSAC_WIDE_ROLES`, `READ_ONLY_ROLES`, `DOCUMENT_UPLOAD_ROLES`, `DOCUMENT_REVIEW_ROLES`,
  `taskDirectionsForRole`). Capability checks are unit-tested (`constants.test.ts`) after a real bug
  was found in this exact matrix during development (Executive Viewer was missing from the DSAC-wide
  visibility list).
- **Row-level tenant isolation is enforced in the data-access layer, not the UI.** Every query that
  touches entity-scoped data goes through `assertEntityAccess` / `entityScopeWhere` /
  `entityIdScopeWhere` in `src/lib/tenant-scope.ts`. An entity user's session simply cannot construct a
  query that returns another entity's rows — this was verified end-to-end for entities, documents,
  tasks, comments, and even the AI "ask the data" tools (an entity user asking "are we at risk?" gets
  only their own entity back, never the portfolio).
- **Least privilege**: Executive Viewer is deliberately DSAC-wide for *read* access but excluded from
  every upload/review/task-creation/comment capability (`isReadOnlyRole`). Entity roles can never
  approve their own document submissions — only DSAC Admin/Analyst can (`canReviewDocuments`).
- **MFA**: enforced via Microsoft Entra ID's own Conditional Access policies when
  `MICROSOFT_ENTRA_ID_*` is configured — this platform doesn't implement its own MFA, deliberately, so
  it inherits DSAC's existing identity governance rather than duplicating it. The demo credentials
  login (shared password, one-click role switching) exists only for the hackathon demo and would be
  disabled in any real deployment.

## 3. Encryption

- **In transit**: the app is designed to run behind TLS termination (a reverse proxy / Azure App
  Service / Front Door in production); local dev runs over plain HTTP by design, matching how every
  `localhost` Next.js app runs.
- **At rest**: production Postgres and MinIO/S3 storage should both be configured with
  encryption-at-rest — this is an infrastructure/deployment setting rather than application code
  (see §7, data residency).
- **File access is always via short-lived, signed URLs** (`src/lib/storage.ts`,
  `getDownloadUrl(key, expiresInSeconds, options)`), generated fresh per request through
  `/api/documents/versions/[id]/download` and `.../view`. Documents are never served from a public
  path, and download links expire in 5 minutes.

## 4. Audit logging

- **Append-only `AuditLog`** (`userId`, `entityId`, `action`, `targetType`, `targetId`, `before`/`after`
  JSON, `createdAt` — no update or delete path is exposed anywhere in the app). Logged actions include:
  document view, download, upload (new version), review decisions (approve/return/start review), soft
  delete and restore, and every AI interaction (mocked or real — see §6).
- **Admin viewer**: `/audit-log`, restricted to DSAC Admin (the only role with this nav item at all —
  see `src/lib/nav-items.ts`), with filters by action, entity, and date range.
- IP address capture is best-effort (`x-forwarded-for` in production behind a proxy; not meaningful for
  local dev).

## 5. Retention and deletion

- **Soft delete with a recovery window**: deleting a document sets `Document.deletedAt` rather than
  removing the row. Deleted documents disappear from every normal listing (`deletedAt: null` is part of
  every document query) but remain restorable by a DSAC Admin from the audit log / deleted-documents
  view within the recovery window.
- **Retention period per document type**: `Document.retentionUntil` is set at upload time from a
  per-type default in `src/lib/constants.ts` (`DOCUMENT_RETENTION_YEARS`) — annual reports and
  financials default to a longer retention period than working documents, matching typical public-sector
  record-keeping practice. This is advisory in the prototype (displayed on the document detail page);
  automated purge after the retention window is a production concern, not implemented here.

## 6. AI safeguards

- **Redaction before every model call** — see §1.
- **Every AI interaction is logged**, mocked or real, via the same `AuditLog` as everything else
  (`src/lib/ai/audit.ts`), recording a truncated prompt and response for later review.
- **Human-in-the-loop, always.** The document AI assist (key figures, summary, inconsistency flags) is
  explicitly presented as suggestions on the document detail page — it never approves, returns, or
  changes a document's review status itself. "Ask the data" only ever calls a fixed set of read-only,
  tenant-scoped query tools (`src/lib/ai/ask-the-data.ts`); the model is never given raw SQL access or
  write capability.
- Every AI feature has a deterministic, real-data-backed fallback when `ANTHROPIC_API_KEY` is unset, so
  the demo (and the audit trail) behaves the same shape either way.

## 7. Application security controls

- **Input validation**: request bodies for document upload, task creation and comment creation are
  validated with `zod` schemas (`src/lib/validation/`) rather than ad-hoc type checks, with file-type
  and file-size validation on upload (`ALLOWED_UPLOAD_MIME_TYPES`, `MAX_UPLOAD_SIZE_BYTES` in
  `src/lib/constants.ts`).
- **Rate limiting**: an in-memory, per-user sliding-window limiter (`src/lib/rate-limit.ts`) protects
  the AI endpoints (cost-sensitive) and the credentials login action (brute-force resistance). It's
  process-local, which is adequate for this single-instance demo; a horizontally-scaled production
  deployment would move this to a shared store (Redis) instead.
- **CSRF**: Auth.js's own routes carry built-in CSRF protection. Custom mutating API routes rely on
  `SameSite=Lax` session cookies plus an Origin-header check for state-changing requests
  (`src/lib/origin-check.ts`) as defence-in-depth.
- **Secure headers**: `next.config.ts` sets a Content-Security-Policy, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` on every response.
- **Dependency scanning**: not automated in this prototype. `pnpm audit` should be run before any real
  deployment, and GitHub's Dependabot alerts should be enabled on the repository.
- **Data residency**: production deployment targets **Azure South Africa North**, keeping entity and
  (aggregated) workforce data within South Africa, per typical government data-residency expectations.

## 8. POPIA alignment (Protection of Personal Information Act)

This section describes design intent, not a compliance attestation.

- **Lawful processing**: the only genuinely personal data this platform handles is user account data
  (name, work email, role) for DSAC and entity staff, processed under the employment/contractual
  necessity ground for operating the reporting platform. Workforce demographic data is aggregated
  before it ever reaches the database (see §1), which is the intended way this platform avoids
  processing special personal information about individual employees at all.
- **Information Officer**: POPIA requires every responsible party to designate an Information Officer.
  In a real DSAC deployment, this would be a named DSAC official (typically the CIO or a delegated
  compliance lead), registered with the Information Regulator, responsible for POPIA compliance,
  handling data subject access requests, and approving this document's periodic review. This prototype
  does not implement an Information-Officer workflow in-app.
- **Breach notification**: POPIA section 22 requires notifying the Information Regulator and affected
  data subjects "as soon as reasonably possible" after a security compromise. A real deployment would
  need: a documented incident-response runbook, the audit log (§4) as a primary forensic source, and a
  named contact responsible for regulator notification. Not implemented here beyond the audit trail
  that would feed such a process.
- **Data subject rights**: access/correction/deletion requests would, in production, route through the
  Information Officer and be fulfilled using the same tenant-scoped data-access layer this platform
  already uses for normal operation.

## 9. Alignment with the National Cybersecurity Policy Framework

The platform's design choices — centralised RBAC, tenant isolation enforced at the data layer,
append-only audit logging, encryption in transit/at rest, and a documented incident-relevant audit
trail — are intended to align with the NCPF's broader goals of protecting government information
systems and critical data. This prototype has not undergone a formal NCPF compliance assessment.

## 10. Known gaps (honest list, not exhaustive)

- No formal penetration test or third-party security review has been performed.
- No automated dependency vulnerability scanning is wired into CI (there is no CI pipeline in this
  prototype at all).
- Rate limiting is in-memory and per-process — not suitable for a multi-instance production deployment
  without moving to a shared store.
- Document text extraction only covers `text/plain`/`text/csv` for the AI assist feature; Word/Excel/PDF
  documents are stored and reviewable but not AI-analysed.
- No automated retention-window purge job exists — `retentionUntil` is advisory/display-only.
