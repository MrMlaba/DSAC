/**
 * End-to-end verification against a RUNNING app (pnpm start or pnpm dev on :3000).
 *
 * Logs in as DSAC staff and as an entity, walks every screen and role guard, then changes real
 * numbers the way a user would — entity captures expenditure and KPI results, submits reports,
 * DSAC reviews them, a request goes through its workflow — and checks that every figure moves
 * by exactly the right amount on every dashboard and tab.
 *
 * It WRITES to the database. Run it on freshly seeded data and reseed afterwards:
 *
 *   pnpm db:seed && pnpm verify:flows && pnpm db:seed
 */
import { PrismaClient } from "@prisma/client";
import { computeEntityMetrics } from "../src/lib/data/metrics";
import { combineFinance } from "../src/lib/calc/finance";
import { combineCompliance } from "../src/lib/calc/compliance";
import { sumMoney } from "../src/lib/calc/money";
import { formatKpiValue, formatPercent, formatRand, formatRandCompact } from "../src/lib/format";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();
let pass = 0;
const failures: string[] = [];

function ok(label: string, condition: boolean, detail = "") {
  if (condition) pass++;
  else failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
}
const has = (label: string, html: string, needle: string) => ok(label, html.includes(needle), `missing "${needle}"`);

async function login(email: string) {
  const jar: Record<string, string> = {};
  const store = (res: Response) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar[pair.slice(0, i)] = pair.slice(i + 1);
    }
  };
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  store(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie() },
    body: new URLSearchParams({ email, password: "Demo@2026", csrfToken, callbackUrl: "/dashboard", json: "true" }),
    redirect: "manual",
  });
  store(res);
  if (res.status !== 302) throw new Error(`login failed for ${email}: ${res.status}`);
  return {
    async get(path: string) {
      const start = Date.now();
      const r = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie() }, redirect: "manual" });
      return { status: r.status, location: r.headers.get("location"), html: await r.text(), ms: Date.now() - start };
    },
    async upload(path: string, form: FormData) {
      const r = await fetch(`${BASE}${path}`, { method: "POST", headers: { Cookie: cookie(), Origin: BASE }, body: form });
      return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
    },
    async post(path: string, body?: unknown, origin = BASE) {
      const r = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie(), Origin: origin },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
    },
  };
}

async function main() {
  const fy = (await prisma.financialYear.findMany({ orderBy: { startDate: "desc" }, take: 1 }))[0];
  const frontier = await prisma.entity.findFirstOrThrow({ where: { name: "Frontier History Museum Trust" } });
  const nsea = await prisma.entity.findFirstOrThrow({ where: { name: "National Sports Excellence Agency" } });

  const dsac = await login("thandiwe.mokoena@dsac.demo.gov.za");
  const entity = await login("lindiwe.dube@frontierheritage.demo.org");

  // ---------------- DSAC pages ----------------
  console.log("DSAC pages");
  const slow: string[] = [];
  const page = async (path: string, markers: string[]) => {
    const r = await dsac.get(path);
    ok(`DSAC ${path} responds 200`, r.status === 200, `got ${r.status}`);
    for (const m of markers) has(`DSAC ${path} shows "${m}"`, r.html, m);
    if (r.ms > 4000) slow.push(`${path} ${r.ms}ms`);
    return r.html;
  };

  await page("/dashboard", ["Total public entities", "Total NPOs", "Total organisations monitored", "Reports submitted", "Reports outstanding", "Overall compliance rate", "Overall KPI performance", "Total approved budget", "Total disbursed to date", "Total utilised to date", "Overall utilisation", "Where DSAC needs to intervene"]);
  await page("/entities", ["Organisation", "Compliance", "Performance", "Frontier History Museum Trust"]);
  const base = `/entities/${frontier.id}`;
  await page(base, ["Overall performance", "Compliance status", "Approved annual budget", "Amount disbursed", "Amount utilised", "Budget utilisation", "Reports outstanding", "Next reporting due date", "Recent alerts", "Upcoming deadlines", "Latest report status", "Major performance concerns"]);
  await page(`${base}/performance`, ["Key performance indicators", "Target to date", "Achievement"]);
  await page(`${base}/finance`, ["Annual budget vs actual expenditure to date", "Annual approved budget", "Actual expenditure to date", "Remaining budget", "Utilisation", "Disbursements"]);
  await page(`${base}/compliance`, ["Compliance requirements", "Due date", "Submission date"]);
  await page(`${base}/reports`, ["Draft → Submitted"]);
  await page(`${base}/profile`, ["Organisation", "Audit findings"]);
  await page("/reports", ["All reports", "Awaiting DSAC review"]);
  await page("/requests", ["All requests"]);
  await page("/alerts", ["Needs attention", "Early warning"]);
  await page("/administration", ["Reporting standards", "Audit log"]);
  await page("/administration/standards", ["Standard KPI reporting structure", "How every figure is calculated"]);
  await page("/administration/audit-log", ["Audit Log"]);
  ok("old /risk route is gone", (await dsac.get("/risk")).status === 404);
  ok("old /audit-log route is gone", (await dsac.get("/audit-log")).status === 404);
  ok("DSAC pages all under 4s", slow.length === 0, slow.join(", "));

  // ---------------- Entity portal + guards ----------------
  console.log("Entity portal and access control");
  for (const [path, markers] of [
    ["/dashboard", ["Upcoming deadlines", "Recent submissions", "Latest DSAC feedback", "Performance", "Finance", "Compliance", "Reports", "Requests"]],
    ["/performance", ["Key performance indicators"]],
    ["/finance", ["Annual budget vs actual expenditure to date"]],
    ["/compliance", ["Compliance requirements"]],
    ["/reports", ["Reports —"]],
    ["/requests", ["Your requests"]],
    ["/profile", ["Organisation"]],
    ["/documents", ["Documents"]],
  ] as [string, string[]][]) {
    const r = await entity.get(path);
    ok(`entity ${path} responds 200`, r.status === 200, `got ${r.status}`);
    for (const m of markers) has(`entity ${path} shows "${m}"`, r.html, m);
  }
  for (const path of ["/entities", "/alerts", "/administration", "/administration/standards", `/entities/${nsea.id}`]) {
    const r = await entity.get(path);
    ok(`entity is kept out of ${path}`, r.status >= 300 && r.status < 400, `got ${r.status}`);
  }
  const dsacOnPortal = await dsac.get("/finance");
  ok("DSAC user is sent away from the entity-only /finance", dsacOnPortal.status >= 300 && dsacOnPortal.status < 400, `got ${dsacOnPortal.status}`);
  const cross = await entity.post("/api/finance/expenditure", { entityId: nsea.id, financialYearId: fy.id, quarter: "Q1", entries: [{ budgetLineId: "x", amount: 1 }] });
  ok("entity cannot capture data for another entity (403)", cross.status === 403, `got ${cross.status}`);
  const dsacCapture = await dsac.post("/api/performance", { entityId: frontier.id, financialYearId: fy.id, quarter: "Q1", entries: [{ kpiId: "x", actual: 1 }] });
  ok("DSAC cannot capture entity data (403)", dsacCapture.status === 403, `got ${dsacCapture.status}`);
  const badOrigin = await dsac.post("/api/requests", {}, "https://evil.example");
  ok("cross-origin write from a signed-in session is rejected (403)", badOrigin.status === 403, `got ${badOrigin.status}`);

  // ---------------- Amounts agree on every surface ----------------
  console.log("Amounts and percentages agree everywhere");
  const before = await computeEntityMetrics({ financialYearId: fy.id });
  const f0 = before.get(frontier.id)!.finance.summary;
  const surfaces: [string, string][] = [
    ["DSAC overview", (await dsac.get(base)).html],
    ["DSAC finance tab", (await dsac.get(`${base}/finance`)).html],
    ["entity portal finance", (await entity.get("/finance")).html],
    ["entity portal dashboard", (await entity.get("/dashboard")).html],
  ];
  for (const [name, html] of surfaces) {
    has(`${name}: approved budget ${formatRandCompact(f0.approved)}`, html, formatRandCompact(f0.approved));
    has(`${name}: budget utilisation ${formatPercent(f0.budgetUtilisation)}`, html, formatPercent(f0.budgetUtilisation));
  }
  const portfolio0 = combineFinance([...before.values()].map((m) => m.finance.summary));
  const dash0 = (await dsac.get("/dashboard")).html;
  has("DSAC dashboard: portfolio approved", dash0, formatRandCompact(portfolio0.approved));
  has("DSAC dashboard: portfolio disbursed", dash0, formatRandCompact(portfolio0.disbursed));
  has("DSAC dashboard: portfolio utilised", dash0, formatRandCompact(portfolio0.utilised));
  has("DSAC dashboard: overall utilisation", dash0, formatPercent(portfolio0.fundUtilisation));
  const compliance0 = combineCompliance([...before.values()].map((m) => m.compliance.summary));

  // ---------------- Data flow: entity captures → DSAC entity page → DSAC portfolio ----------------
  console.log("Data flow: entity captures expenditure");
  const finReport = await prisma.report.findFirstOrThrow({ where: { entityId: frontier.id, financialYearId: fy.id, kind: "QUARTERLY_FINANCIAL", reportingPeriod: { quarter: "Q1" } } });
  ok("Frontier's Q1 financial report starts as an overdue draft", finReport.status === "DRAFT");
  const lines = await prisma.budgetLine.findMany({ where: { entityId: frontier.id, financialYearId: fy.id } });
  const entries = lines.map((l) => ({ budgetLineId: l.id, amount: Math.round(l.annualBudget.toNumber() * 0.2) }));
  const captured = sumMoney(entries.map((e) => e.amount));

  const tooEarly = await entity.post("/api/finance/expenditure", { entityId: frontier.id, financialYearId: fy.id, quarter: "Q4", entries });
  ok("cannot capture a quarter that has not started", tooEarly.status === 400, `got ${tooEarly.status}: ${tooEarly.json.error}`);
  const negative = await entity.post("/api/finance/expenditure", { entityId: frontier.id, financialYearId: fy.id, quarter: "Q1", entries: [{ budgetLineId: lines[0].id, amount: -5 }] });
  ok("negative expenditure is rejected", negative.status === 400, `got ${negative.status}`);

  const saved = await entity.post("/api/finance/expenditure", { entityId: frontier.id, financialYearId: fy.id, quarter: "Q1", entries });
  ok("entity saves Q1 expenditure", saved.status === 200, `got ${saved.status}: ${saved.json.error}`);

  const after = await computeEntityMetrics({ financialYearId: fy.id });
  const f1 = after.get(frontier.id)!.finance.summary;
  ok("entity utilised = what was entered, to the cent", f1.utilised === captured, `${f1.utilised} vs ${captured}`);
  ok("each line's utilisation is 20%", after.get(frontier.id)!.finance.lines.every((l) => Math.abs((l.utilisation ?? 0) - 0.2) < 0.001));
  const portfolio1 = combineFinance([...after.values()].map((m) => m.finance.summary));
  ok("portfolio utilised rose by exactly the amount entered", portfolio1.utilised === sumMoney([portfolio0.utilised, captured]), `${portfolio1.utilised} vs ${portfolio0.utilised} + ${captured}`);

  const dsacFinance = (await dsac.get(`${base}/finance`)).html;
  const entityFinance = (await entity.get("/finance")).html;
  has("DSAC entity finance shows the new actual to date", dsacFinance, formatRand(captured));
  has("entity finance shows the same actual to date", entityFinance, formatRand(captured));
  has("DSAC entity finance shows utilisation of disbursed", dsacFinance, formatPercent(f1.fundUtilisation));
  has("DSAC entity finance shows budget utilisation", dsacFinance, formatPercent(f1.budgetUtilisation));
  const dash1 = (await dsac.get("/dashboard")).html;
  has("DSAC dashboard shows the new portfolio utilised", dash1, formatRandCompact(portfolio1.utilised));
  has("DSAC dashboard shows the new overall utilisation", dash1, formatPercent(portfolio1.fundUtilisation));

  console.log("Report workflow: submit → review → accept → finalise");
  const govReport = await prisma.report.findFirstOrThrow({ where: { entityId: frontier.id, financialYearId: fy.id, kind: "GOVERNANCE_RETURN", reportingPeriod: { quarter: "Q1" } } });
  const blocked = await entity.post(`/api/reports/${govReport.id}/submit`);
  ok("governance return cannot be submitted without an attachment (422)", blocked.status === 422 && Array.isArray(blocked.json.problems), `got ${blocked.status}`);

  // Evidence: attach a document to the governance return, then it can be submitted.
  const evidenceForm = (extra: Record<string, string>) => {
    const form = new FormData();
    form.set("file", new Blob(["Signed governance return (synthetic)."], { type: "text/plain" }), "governance-return.txt");
    form.set("entityId", frontier.id);
    form.set("type", "OTHER");
    form.set("title", "Signed governance return");
    form.set("financialYearId", fy.id);
    for (const [k, v] of Object.entries(extra)) form.set(k, v);
    return form;
  };
  const otherReport = await prisma.report.findFirstOrThrow({ where: { entityId: nsea.id, financialYearId: fy.id, kind: "GOVERNANCE_RETURN" } });
  const foreign = await entity.upload("/api/documents", evidenceForm({ reportId: otherReport.id }));
  ok("evidence cannot be linked to another organisation's report", foreign.status === 400, `got ${foreign.status}: ${foreign.json.error}`);
  const attached = await entity.upload("/api/documents", evidenceForm({ reportId: govReport.id }));
  ok("entity attaches evidence to a report", attached.status === 200, `got ${attached.status}: ${attached.json.error}`);
  const linked = await prisma.document.findFirst({ where: { id: attached.json.documentId as string } });
  ok("the document is linked to that report", linked?.reportId === govReport.id);
  const govSubmit = await entity.post(`/api/reports/${govReport.id}/submit`);
  ok("governance return now submits", govSubmit.status === 200 && govSubmit.json.status === "SUBMITTED", `got ${govSubmit.status}: ${govSubmit.json.error}`);
  const govRow = (await entity.get("/reports")).html;
  has("the report row shows its supporting document", govRow, "supporting document(s)");

  const submit = await entity.post(`/api/reports/${finReport.id}/submit`);
  ok("complete financial report submits", submit.status === 200 && submit.json.status === "SUBMITTED", `got ${submit.status}: ${submit.json.error}`);
  const locked = await entity.post("/api/finance/expenditure", { entityId: frontier.id, financialYearId: fy.id, quarter: "Q1", entries });
  ok("submitted figures are locked", locked.status === 400, `got ${locked.status}`);
  const entityCannotReview = await entity.post(`/api/reports/${finReport.id}/review`, { action: "ACCEPT" });
  ok("entity cannot review its own report (403)", entityCannotReview.status === 403, `got ${entityCannotReview.status}`);
  const noComment = await dsac.post(`/api/reports/${finReport.id}/review`, { action: "RETURN" });
  ok("returning a report needs a comment", noComment.status === 400, `got ${noComment.status}`);
  ok("start review", (await dsac.post(`/api/reports/${finReport.id}/review`, { action: "START_REVIEW" })).json.status === "UNDER_REVIEW");
  ok("accept", (await dsac.post(`/api/reports/${finReport.id}/review`, { action: "ACCEPT" })).json.status === "ACCEPTED");
  ok("finalise", (await dsac.post(`/api/reports/${finReport.id}/review`, { action: "FINALISE" })).json.status === "FINALISED");

  const after2 = await computeEntityMetrics({ financialYearId: fy.id });
  const compliance1 = combineCompliance([...after2.values()].map((m) => m.compliance.summary));
  ok("portfolio reports submitted +2 (financial report and governance return)", compliance1.submitted === compliance0.submitted + 2, `${compliance0.submitted} → ${compliance1.submitted}`);
  ok("portfolio reports outstanding −2", compliance1.outstanding === compliance0.outstanding - 2, `${compliance0.outstanding} → ${compliance1.outstanding}`);
  const dash2 = (await dsac.get("/dashboard")).html;
  has("DSAC dashboard shows the new compliance rate", dash2, formatPercent(compliance1.rate));

  console.log("Performance capture");
  const perfReport = await prisma.report.findFirstOrThrow({ where: { entityId: frontier.id, financialYearId: fy.id, kind: "QUARTERLY_PERFORMANCE", reportingPeriod: { quarter: "Q1" } } });
  ok("Frontier's Q1 performance report starts returned", perfReport.status === "RETURNED");
  const kpi = after2.get(frontier.id)!.performance.kpis.find((k) => k.aggregation === "SUM")!;
  const newActual = kpi.quarters.Q1.target!; // exactly on target
  const savedPerf = await entity.post("/api/performance", { entityId: frontier.id, financialYearId: fy.id, quarter: "Q1", entries: [{ kpiId: kpi.id, actual: newActual }] });
  ok("entity saves a KPI result", savedPerf.status === 200, `got ${savedPerf.status}: ${savedPerf.json.error}`);
  const after3 = await computeEntityMetrics({ financialYearId: fy.id });
  const kpiAfter = after3.get(frontier.id)!.performance.kpis.find((k) => k.id === kpi.id)!;
  ok("KPI is now exactly on target: achievement 100%, status Achieved", kpiAfter.result?.achievement === 1 && kpiAfter.result.status === "ACHIEVED", JSON.stringify(kpiAfter.result));
  const dsacPerf = (await dsac.get(`${base}/performance`)).html;
  has("DSAC performance tab shows the new YTD actual", dsacPerf, formatKpiValue(newActual, kpi.unit));
  has("DSAC performance tab shows 100%", dsacPerf, "100%");
  const overview = (await dsac.get(base)).html;
  has("DSAC overview shows the recalculated overall performance", overview, formatPercent(after3.get(frontier.id)!.performance.summary.overall));

  console.log("Requests workflow");
  const created = await entity.post("/api/requests", { title: "Smoke test request", category: "ADDITIONAL_FUNDING", amountRequested: 250000, motivation: "Verifying the request workflow end to end.", expectedOutcome: "A working workflow." });
  ok("entity submits a request", created.status === 200 && typeof created.json.requestId === "string", `got ${created.status}: ${created.json.error}`);
  const rid = created.json.requestId as string;
  ok("DSAC starts review", (await dsac.post(`/api/requests/${rid}/decision`, { action: "START_REVIEW" })).json.status === "UNDER_REVIEW");
  ok("declining needs a reason", (await dsac.post(`/api/requests/${rid}/decision`, { action: "DECLINE" })).status === 400);
  ok("DSAC asks for more information", (await dsac.post(`/api/requests/${rid}/decision`, { action: "REQUEST_INFO", note: "Please attach quotations." })).json.status === "MORE_INFO_REQUIRED");
  ok("entity responds", (await entity.post(`/api/requests/${rid}/respond`, { note: "Quotations attached." })).json.status === "SUBMITTED");
  ok("DSAC approves", (await dsac.post(`/api/requests/${rid}/decision`, { action: "APPROVE" })).json.status === "APPROVED");
  ok("DSAC completes", (await dsac.post(`/api/requests/${rid}/decision`, { action: "COMPLETE" })).json.status === "COMPLETED");
  const entityCannotDecide = await entity.post(`/api/requests/${rid}/decision`, { action: "APPROVE" });
  ok("entity cannot decide requests (403)", entityCannotDecide.status === 403, `got ${entityCannotDecide.status}`);

  console.log(`\n${pass} checks passed, ${failures.length} failed.`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  await prisma.$disconnect();
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
