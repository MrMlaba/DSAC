/**
 * Reconciliation check: proves the money and percentages shown on every screen agree.
 *
 * It recomputes the headline totals a second, independent way — straight database aggregates,
 * no calc library — and compares them with what the shared metrics layer (which every dashboard,
 * tab and the risk engine use) produces per entity and for the whole portfolio.
 *
 *   pnpm verify:data
 */
import { PrismaClient } from "@prisma/client";
import { computeEntityMetrics } from "../src/lib/data/metrics";
import { combineFinance } from "../src/lib/calc/finance";
import { combineCompliance } from "../src/lib/calc/compliance";
import { combinePerformance } from "../src/lib/calc/performance";
import { sumMoney, toCents } from "../src/lib/calc/money";
import { formatPercent, formatRand, formatRandCompact } from "../src/lib/format";

const prisma = new PrismaClient();
let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  if (actual !== expected) {
    failures++;
    console.error(`  ✗ ${label}\n      got      ${String(actual)}\n      expected ${String(expected)}`);
  }
}

function near(label: string, actual: number | null, expected: number | null, tolerance = 1e-9) {
  checks++;
  const ok = actual === expected || (actual !== null && expected !== null && Math.abs(actual - expected) <= tolerance);
  if (!ok) {
    failures++;
    console.error(`  ✗ ${label}\n      got      ${String(actual)}\n      expected ${String(expected)}`);
  }
}

async function main() {
  const financialYears = await prisma.financialYear.findMany({ orderBy: { startDate: "asc" } });
  const entities = await prisma.entity.findMany({ select: { id: true, name: true } });

  for (const fy of financialYears) {
    console.log(`\nFY ${fy.label}`);
    const before = failures;
    const metrics = await computeEntityMetrics({ financialYearId: fy.id });
    const all = [...metrics.values()];
    check("every entity has metrics", all.length, entities.length);

    // ---- Independent totals straight from the database ----
    const [approvedAgg, disbursedAgg, expenditureRows, reportCount, kpiCount] = await Promise.all([
      prisma.budgetLine.aggregate({ where: { financialYearId: fy.id }, _sum: { annualBudget: true } }),
      prisma.disbursement.aggregate({ where: { financialYearId: fy.id }, _sum: { amount: true } }),
      prisma.quarterlyExpenditure.findMany({ where: { budgetLine: { financialYearId: fy.id } }, select: { amount: true, budgetLine: { select: { entityId: true, annualBudget: true } } } }),
      prisma.report.count({ where: { financialYearId: fy.id } }),
      prisma.kpi.count({ where: { financialYearId: fy.id } }),
    ]);
    const dbApproved = approvedAgg._sum.annualBudget?.toNumber() ?? 0;
    const dbDisbursed = disbursedAgg._sum.amount?.toNumber() ?? 0;
    const dbUtilised = sumMoney(expenditureRows.map((e) => e.amount.toNumber()));

    // ---- Portfolio = sum of entities = database totals ----
    const portfolio = combineFinance(all.map((m) => m.finance.summary));
    near("portfolio approved budget = Σ budget lines in the database", portfolio.approved, dbApproved);
    near("portfolio disbursed = Σ disbursements in the database", portfolio.disbursed, dbDisbursed);
    near("portfolio utilised = Σ quarterly expenditure in the database", portfolio.utilised, dbUtilised);
    near("portfolio fund utilisation = Σutilised ÷ Σdisbursed", portfolio.fundUtilisation, dbDisbursed === 0 ? null : dbUtilised / dbDisbursed);
    near("portfolio budget utilisation = Σutilised ÷ Σapproved", portfolio.budgetUtilisation, dbApproved === 0 ? null : dbUtilised / dbApproved);

    // ---- Every entity: lines add up to the summary, quarters add up to each line ----
    for (const m of all) {
      const name = entities.find((e) => e.id === m.entityId)?.name ?? m.entityId;
      const lineBudget = sumMoney(m.finance.lines.map((l) => l.annualBudget));
      const lineActual = sumMoney(m.finance.lines.map((l) => l.actualToDate));
      check(`${name}: Σ line budgets = entity approved budget`, lineBudget, m.finance.summary.approved);
      check(`${name}: Σ line actuals = entity utilised`, lineActual, m.finance.summary.utilised);
      check(`${name}: approved − utilised = remaining`, toCents(m.finance.summary.approved) - toCents(m.finance.summary.utilised), toCents(m.finance.summary.remainingBudget));

      const dbEntityUtilised = sumMoney(expenditureRows.filter((e) => e.budgetLine.entityId === m.entityId).map((e) => e.amount.toNumber()));
      check(`${name}: utilised matches the database`, m.finance.summary.utilised, dbEntityUtilised);

      for (const line of m.finance.lines) {
        check(`${name}/${line.category}: Σ quarters = actual to date`, sumMoney(line.quarters.map((q) => q.amount ?? 0)), line.actualToDate);
        check(`${name}/${line.category}: budget − actual = remaining`, toCents(line.annualBudget) - toCents(line.actualToDate), toCents(line.remaining));
        near(`${name}/${line.category}: utilisation = actual ÷ budget`, line.utilisation, line.annualBudget === 0 ? null : line.actualToDate / line.annualBudget);
        const lastQuarter = line.quarters.at(-1);
        check(`${name}/${line.category}: final cumulative = actual to date`, lastQuarter?.cumulative, line.actualToDate);
      }

      // ---- Compliance: the three buckets partition the reports ----
      const c = m.compliance.summary;
      check(`${name}: submitted + outstanding + not yet due = total reports`, c.submitted + c.outstanding + c.notYetDue, c.total);
      check(`${name}: report rows = summary total`, m.compliance.reports.length, c.total);
      near(`${name}: compliance rate = compliant ÷ assessed`, c.rate, c.assessed === 0 ? null : c.compliant / c.assessed);

      // ---- Performance: the four statuses partition the assessed KPIs ----
      const p = m.performance.summary;
      check(`${name}: achieved + on track + at risk + not achieved = assessed`, p.achieved + p.onTrack + p.atRisk + p.notAchieved, p.assessed);
      near(`${name}: overall performance = (achieved + on track) ÷ assessed`, p.overall, p.assessed === 0 ? null : (p.achieved + p.onTrack) / p.assessed);
      for (const kpi of m.performance.kpis) {
        if (!kpi.result) continue;
        near(`${name}/${kpi.name}: variance = YTD actual − YTD target`, kpi.result.variance, kpi.result.ytdActual - kpi.result.ytdTarget, 1e-6);
      }
    }

    // ---- Portfolio compliance and performance pool the entity counts ----
    const pc = combineCompliance(all.map((m) => m.compliance.summary));
    check("portfolio reports = reports in the database", pc.total, reportCount);
    check("portfolio submitted + outstanding + not yet due = total reports", pc.submitted + pc.outstanding + pc.notYetDue, pc.total);
    const pp = combinePerformance(all.map((m) => m.performance.summary));
    check("portfolio KPIs = KPIs in the database (assessed ≤ total)", pp.assessed <= kpiCount, true);
    near("portfolio overall performance = pooled KPI counts", pp.overall, pp.assessed === 0 ? null : (pp.achieved + pp.onTrack) / pp.assessed);

    console.log(
      `  approved ${formatRandCompact(portfolio.approved)} (${formatRand(portfolio.approved)}) · disbursed ${formatRandCompact(portfolio.disbursed)} · utilised ${formatRandCompact(portfolio.utilised)}`,
    );
    console.log(
      `  fund utilisation ${formatPercent(portfolio.fundUtilisation)} · budget utilisation ${formatPercent(portfolio.budgetUtilisation)} · KPI performance ${formatPercent(pp.overall)} (${pp.assessed} KPIs) · compliance ${formatPercent(pc.rate)} · reports ${pc.submitted} submitted / ${pc.outstanding} outstanding / ${pc.notYetDue} not yet due`,
    );
    console.log(failures === before ? "  ✓ all checks passed" : `  ✗ ${failures - before} check(s) failed`);
  }

  console.log(`\n${checks} checks, ${failures} failure(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failures > 0) process.exit(1);
  });
