# 5-Minute Demo Script

**Story:** DSAC opens the platform and instantly sees where money and performance stand across all 32
organisations — and which one needs intervention. The organisation fixes it in its own portal, DSAC reviews it,
and **every figure moves by exactly the right amount on every screen** — with no spreadsheets, PDFs or emails.

The numbers below are exact for the seeded data **as at 19 September 2026**. Statuses ("overdue", "due soon")
depend on today's date, so to keep the demo identical on the day, freeze the date first:

```bash
# .env
APP_TODAY="2026-09-19"
```
```bash
pnpm db:seed        # reseed under the frozen date (also resets anything you changed in a rehearsal)
```

Shared demo password for every account: `Demo@2026`.

## Before you present (2 minutes, off-stage)

1. Run the **production build** — it serves every page in about a second; the dev server recompiles pages on
   first visit and is much slower on a low-memory laptop:
   ```bash
   pnpm docker:up && pnpm build && pnpm start
   ```
2. Open **two browser windows side by side** (or two profiles):
   - **Window A** — signed in as **Thandiwe Mokoena** (DSAC Admin).
   - **Window B** — signed in as **Lindiwe Dube** (Entity Admin, Frontier History Museum Trust).
   Both are one-click accounts on the login page.
3. Reseed if you rehearsed: `pnpm db:seed`.

## The walkthrough

### 1. The portfolio at a glance (60s) — Window A, `/dashboard`

> "This is the first screen a DSAC official sees. Everything here comes live from what entities submit."

- **Portfolio:** 26 public entities + 6 NPOs = 32 monitored. **Overall KPI performance 68.8%** (159 of 231 KPIs
  achieved or on track). **82 reports submitted, 14 outstanding**, 320 not yet due. **Compliance rate 66.7%**.
- **Financial position:** **R4.42bn approved → R2.10bn disbursed → R803m utilised**. Overall utilisation
  **38.3%** (of the funds released), which is **18.2% of the approved budget**.

> "Two questions, two clearly labelled figures: how much of what we *released* has been spent, and how much of
> the *whole approved budget*. Both come from the same three numbers."

Point at **Where DSAC needs to intervene**: **Frontier History Museum Trust** is **Overdue Reporting** and
**Under Target**. Click it.

### 2. Why is it flagged? (60s) — Window A, Frontier's page

**Overview** — eight headline cards: Overall performance **14.3%** (1 of 7 KPIs), Compliance **Overdue
Reporting**, **R51m** approved, **R12.8m** disbursed, **R0** utilised, **3 reports outstanding**… and below them
the plain-language alerts: *"Quarterly Financial Report Q1 is overdue by 50 days"*, *"DSAC has returned your
Quarterly Performance Report Q1 for correction"*.

> "R12.75 million has been released to this museum and not a rand of expenditure has been reported."

Click **Finance**: R51,000,000 approved against R0 — one line per expense category, no quarterly clutter. Click
**Compliance**: the overdue items in red. (Every organisation has the same six tabs.)

### 3. The organisation fixes it (90s) — Window B, as Lindiwe Dube

Sign-in lands on the entity portal — a different, simpler sidebar. The dashboard shows the same alerts and
**DSAC's latest feedback** (*"Variance explanations required for underperforming targets."*).

1. **Finance** → "Report Q1 expenditure". Enter *only this quarter's* spend on each line — suggested figures:

   | Line | Enter |
   |---|---|
   | Employee Costs | 3,000,000 |
   | Programme Costs | 3,800,000 |
   | Travel | 200,000 |
   | Administration | 900,000 |
   | Professional Fees | 500,000 |
   | Capital Expenditure | 800,000 |
   | Other | 400,000 |

   As you type, cumulative actual and utilisation per line update. Total **R9,600,000**. Click **Save Q1
   expenditure**.

   > "The entity never re-enters its budget or earlier quarters — next quarter it adds Q2 and the system
   > accumulates it against the same annual budget."

2. The Finance page now shows **Budget utilisation 18.8%** and **Utilisation of disbursed funds 75.3%**,
   **R41.4m** remaining.
3. **Reports** → the Q1 financial report now says it's ready → **Submit to DSAC**.
4. **Performance** → the returned report shows DSAC's comment. Add to a variance reason, **Save Q1 results**,
   then back on **Reports** → **Submit to DSAC**. (The **Governance Return** shows a checklist instead: it can't
   be submitted until a signed document is attached — the platform won't accept an incomplete report.)

### 4. DSAC closes the loop (60s) — Window A

**Reports** opens on **Awaiting review** (everything DSAC still has to act on). Search **Frontier** to find its two
submissions. Click **Start review** on one, then **Accept** both. As DSAC Admin, **Finalise** the accepted one. (Try **Return** to show the required comment.)

Go back to **Dashboard** and refresh:

- **Utilised R803m → R812.6m** (exactly +R9.6m), overall utilisation **38.3% → 38.8%**, budget utilisation
  **18.2% → 18.4%**.
- **Reports submitted 82 → 84, outstanding 14 → 12.**

> "One entity's quarterly return flowed into its own dashboard, DSAC's entity page, and the portfolio total —
> from one set of numbers. And the compliance rate stays at 66.7%: a late submission clears the backlog but
> doesn't erase the fact it was late."

### 5. One more thing, if time allows (30s) — Window A, `/dashboard`

Use **Ask the data**: *"What is our overall utilisation?"* — the answer quotes the same figures and says which
of the two utilisation measures it means; it never runs raw SQL.

## Wrap-up line

> "Standardised reporting on the entity side; automatic consolidation on the DSAC side. Every number DSAC sees is
> traceable to something an entity entered — down to the budget line or the KPI."

## Built but not in this script

- **Entities & NPOs** — searchable list with compliance and performance status (filter by type/status).
- **KPI structure** — Performance tab: Programme → Objective → KPI, target to date, actual, variance, achievement,
  status; select a KPI for reason, corrective action, evidence and quarter-by-quarter history.
- **Requests / Support** — entities raise budget and support requests; DSAC reviews, approves, declines or asks
  for more information (Submitted → Under review → Approved / Declined / More info → Completed).
- **Alerts** — which organisations need intervention and why, plus the explainable early-warning risk score
  (weighted factors plus a small logistic-regression model).
- **Administration → Reporting standards** — the standard KPI fields, expense lines, reporting calendar, status
  thresholds and the exact formula behind every figure and percentage. **Audit log** sits beside it.
- **Excel / PDF export** of the portfolio, from the dashboard.
- **Evidence** — attach documents to a report, KPI or budget line ("Attach evidence" in the row).

## If asked about what's mocked

Answer directly — the README and `docs/SECURITY.md` are explicit about this.

- **Microsoft Graph** (SharePoint links) is an interface + mock — no Azure AD app to test a live one against.
- **AI features** (ask-the-data, document assist, weekly briefing) work the same with or without
  `ANTHROPIC_API_KEY`; without it they answer from the same real data via a keyword router.
- **Document text extraction** for AI assist only covers plain-text/CSV.
- **Retention/purge** is advisory — a date is set and shown; no job deletes expired documents.
- **Tasks and threaded comments** from an earlier iteration still exist in the codebase but are deliberately
  not part of the navigation, to keep the product as simple as the brief asks.

## If something breaks live

- **Login fails**: password is `Demo@2026` for every account; repeated wrong attempts trigger a short lockout.
- **A number differs from this script**: the date moved (unset `APP_TODAY`) or the data was changed in a
  rehearsal — set `APP_TODAY="2026-09-19"` and run `pnpm db:seed`.
- **Something looks stale after a rebuild**: stop the server, `rm -rf .next`, `pnpm build && pnpm start`.
