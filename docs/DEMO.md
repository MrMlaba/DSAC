# 5-Minute Demo Script

**Story:** an entity slips into risk, the platform catches it and explains why, the entity fixes the
specific problem, and DSAC closes the loop — all visible on screen, using synthetic data seeded with a
fixed random seed, so **the entity names and numbers below are reproducible on a fresh `pnpm setup`.**

Shared demo password for every account: `Demo@2026`.

## Before you present (2 minutes, off-stage)

1. `pnpm setup && pnpm dev` — or if already running, just confirm `docker ps` shows Postgres/MinIO/Mailpit
   healthy and `pnpm dev`'s two processes (`next`, `worker`) are both up.
2. **Pre-warm the slow pages once**, so you're not staring at a compiling spinner live. In order: `/login`,
   `/dashboard`, click into any entity, click its **Workspace** tab, `/risk`, `/documents`, `/tasks`,
   `/audit-log`. This dev server's heaviest page (entity detail, three charts) has taken 10–25s to compile
   on a cold hit during this project's own testing — the second hit is instant. This step is why: it's a
   dev-server quirk, not something worth explaining to the audience.
3. Open **two browser windows side by side** (or two profiles): Window A stays signed in as **Thandiwe
   Mokoena** (DSAC Admin), Window B as **Lindiwe Dube** (Entity Admin, Frontier History Museum Trust) — the
   one-click demo accounts on the login page do this in two clicks each. This is what makes the "notified →
   resolved" loop visible without narrating it — the audience watches both sides happen.
4. Know your one intentional talking point about mocking: if asked, "AI features fall back to real data
   without an API key — we didn't want the demo to depend on a live credential." You don't need to bring it
   up unless asked; see §"If asked about what's mocked" below.

## The walkthrough (5 minutes on stage)

### 1. Portfolio overview (45s) — Window A, as Thandiwe Mokoena (DSAC Admin)

Land on **`/dashboard`**.

> "DSAC funds 32 entities who currently report by email. This is what DSAC sees instead: every entity,
> risk-banded, in one view — computed from the same data the entities submit, not a manual audit."

Point at the risk distribution card and the entity cards. Find **Frontier History Museum Trust** — it's
flagged **CRITICAL**, the highest score in the portfolio. Don't click in yet.

### 2. Why is it flagged? (60s) — Window A, `/risk`

Navigate to **Early Warning**. Expand Frontier History Museum Trust's row.

> "This isn't a black-box score. Every contributing factor is named and weighted — and there's a small
> trained model alongside it predicting the probability of missing the next target or submitting late
> again, built from this platform's own history, not a black-box API call."

Point out two specific factors as they appear: a **returned document** ("N of M submitted documents are
currently sitting in a returned, not yet fixed, state") and **overdue deadlines**.

> "It's not just a score — it's specific, named problems, not a vibe. Let's see exactly what's wrong."

### 3. The entity felt this too (45s) — Window B, as Lindiwe Dube (Entity Admin)

Switch to Window B. Open the notification bell — it already has an overdue reminder for this exact report,
escalated to DSAC once it passed due. Click into the entity's **Documents**, find **Quarterly Performance
Report Q1 FY 2025/26** — status **Returned**, and open it.

> "This is the same alert, from the entity's side — and it comes with a specific reason, not just a
> rejection."

Point at the reviewer's comment on the page: *"Missing supporting evidence for claimed achievements."*

> "DSAC returned this report over a year ago and it was never fixed — that's exactly what the early-warning
> score on the previous screen was reacting to."

### 4. Resolve it (60s) — Window B

Back on **`/documents`**, click **Upload document**. Pick the same type (Quarterly Performance Report),
financial year (2025/26) and quarter (Q1) as the returned report, add a file and a short change note — e.g.
*"Added supporting evidence per DSAC's comment."* — and submit.

> "The system recognised this as the same report and added a new version — it didn't create a duplicate."

Open the document to show it: v1 (returned) is still there, untouched, alongside the new v2. Point out the
automatic "received" acknowledgement and the fresh checksum on the new version.

### 5. Close the loop (60s) — back to Window A

Refresh the same document. The new version shows **Received**, waiting on DSAC. Click **Approve**.

> "That's the review workflow — DSAC always has the final say, the AI assist on this page only ever
> suggests, it never approves anything itself."

Go to **Early Warning** and click **Recalculate now**.

> "The risk score updates immediately, not just on the next scheduled run. One returned document doesn't
> erase a risk history — but you can see the factor that's now resolved drop out, in front of you, instead
> of on a report DSAC reads a month later."

### 6. One more thing, if time allows (30s) — Window A, `/dashboard`

Use **Ask the data**: *"Which entities are at critical risk?"* Point out the answer names real entities
with real scores and shows which tool supplied the data — never a raw SQL query the model wrote itself.

## Wrap-up line

> "Email and spreadsheets can't do any of this: not the early warning, not the explainability, not the
> real-time loop between DSAC and 32 entities. That's the platform."

## Built but not in this script (mention if there's time, or if asked)

Five minutes is tight — this script deliberately covers one focused story rather than a feature tour.
Real, working, and demoable on request:

- **Tasks** (kanban, `/tasks`) — assignable within an entity, to DSAC, or from DSAC to an entity.
- **Real-time comments** on each entity's Workspace tab — genuine Server-Sent Events + Postgres
  `LISTEN`/`NOTIFY`, with a live presence indicator ("who else is viewing this right now") — open the same
  entity in both windows and comment in one to show it appear in the other with no refresh.
- **Audit log** (`/audit-log`, DSAC Admin only) — every view/download/approve/delete/AI-call from this
  entire walkthrough is already sitting there with a before/after diff.
- **Installable PWA** — `pnpm build && pnpm start` and the browser will offer to install it; disabled in
  dev on purpose (see `docs/SECURITY.md`).

## If asked about what's mocked

Answer directly — the README and `docs/SECURITY.md` are both explicit about this, so there's nothing to
hide:

- **Microsoft Graph** (SharePoint links, calendar sync) is an interface + mock — no real Azure AD app
  registration exists to test a live one against, and the buttons say "(mock)" honestly rather than
  pretending.
- **AI features** (ask-the-data, document assist, weekly briefing) work identically whether or not
  `ANTHROPIC_API_KEY` is set — without it, they answer from the same real data via a keyword router
  instead of an LLM. This demo doesn't depend on having a live key on stage.
- **Document text extraction** for the AI assist only covers plain-text/CSV — Word/Excel/PDF are stored
  and reviewable but not AI-analysed, which the UI says plainly rather than faking a result.
- **Retention/purge** is advisory (a date is set and shown) — there's no automated job deleting expired
  documents.

## If something breaks live

- **A page hangs compiling**: this is the dev-server cold-compile issue from step 2 above, not a crash.
  Wait it out once, or switch to narrating the next step while it finishes in the background tab.
- **Login fails**: the shared password is `Demo@2026` for every account; a mistyped password on a rate-
  limited attempt shows "too many sign-in attempts" — wait a few seconds and retry (the limit is generous
  enough that this shouldn't happen from normal clicking).
- **Data looks different from this script**: someone ran `pnpm db:seed` after a code change that touched
  the seed script's random-number usage. Re-reading this script's entity names against a fresh `pnpm setup`
  should still match — the seed is deterministic (`faker.seed(2026)`) — but if it doesn't, fall back to
  whichever entity is top of the risk list on `/dashboard` and adapt the names as you go; the mechanics of
  the walkthrough don't depend on which entity it is.
