import { prisma } from "@/lib/prisma";
import { now as clockNow } from "@/lib/clock";
import { calcEntityFinance, type FinanceLine, type FinanceQuarter, type FinanceSummary } from "@/lib/calc/finance";
import {
  PERF_QUARTERS,
  assessmentQuarter,
  calcKpi,
  latestDueQuarter,
  performanceBand,
  summarisePerformance,
  type KpiAggregation,
  type KpiResult,
  type PerfQuarter,
  type PerformanceBand,
  type PerformanceSummary,
} from "@/lib/calc/performance";
import {
  DEFAULT_DUE_SOON_DAYS,
  complianceOf,
  summariseCompliance,
  type ComplianceResult,
  type ComplianceSummary,
  type ReportStatusKey,
} from "@/lib/calc/compliance";
import type { ExpenseCategory, ReportKind } from "@prisma/client";
import { getDeadlineAlertDays } from "@/lib/constants";

/**
 * THE single source of truth for every money figure, percentage and status shown in the app.
 *
 * Every screen — the DSAC portfolio dashboard, the entities list, each entity tab, the entity
 * portal and the risk engine — gets its numbers from computeEntityMetrics(). Nothing else is
 * allowed to add up expenditure, average a percentage or classify a KPI. Portfolio figures are
 * pooled from the same per-entity objects (sum raw amounts, then derive ratios), so a portfolio
 * total can never differ from the sum of the entity pages behind it.
 */

export interface KpiQuarterCell {
  target: number | null;
  actual: number | null;
  varianceExplanation: string | null;
  correctiveAction: string | null;
}

export interface KpiRow {
  id: string;
  programme: string;
  objective: string;
  name: string;
  unit: string;
  aggregation: KpiAggregation;
  annualTarget: number;
  quarters: Record<PerfQuarter, KpiQuarterCell>;
  /** null until any target has fallen due. */
  result: KpiResult | null;
  /** Reason/action recorded for the assessed quarter (the "current reporting period"). */
  reasonForVariance: string | null;
  correctiveAction: string | null;
}

export interface ReportRow {
  id: string;
  kind: ReportKind;
  title: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4" | "ANNUAL";
  dueDate: Date;
  status: ReportStatusKey;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  finalisedAt: Date | null;
  compliance: ComplianceResult;
}

export interface DisbursementRow {
  tranche: number;
  amount: number;
  disbursedAt: Date;
}

export interface EntityFyMetrics {
  entityId: string;
  financialYearId: string;
  /** The quarter performance is assessed at. See assessmentQuarter(). */
  asAt: PerfQuarter | null;
  finance: {
    lines: FinanceLine[];
    summary: FinanceSummary;
    latestQuarter: FinanceQuarter | null;
    disbursements: DisbursementRow[];
  };
  performance: { kpis: KpiRow[]; summary: PerformanceSummary; band: PerformanceBand };
  compliance: { reports: ReportRow[]; summary: ComplianceSummary; nextDue: ReportRow | null };
}

export function dueSoonWindowDays(): number {
  const days = getDeadlineAlertDays();
  return days.length > 0 ? Math.max(...days) : DEFAULT_DUE_SOON_DAYS;
}

const num = (value: { toNumber(): number }) => value.toNumber();

export async function computeEntityMetrics(params: {
  financialYearId: string;
  entityIds?: string[];
  today?: Date;
}): Promise<Map<string, EntityFyMetrics>> {
  const today = params.today ?? clockNow();
  const entityFilter = params.entityIds ? { entityId: { in: params.entityIds } } : {};
  const fyFilter = { financialYearId: params.financialYearId };

  const [entityRows, budgetLines, disbursements, kpis, reports, periods] = await Promise.all([
    params.entityIds
      ? Promise.resolve(params.entityIds.map((id) => ({ id })))
      : prisma.entity.findMany({ select: { id: true } }),
    prisma.budgetLine.findMany({
      where: { ...fyFilter, ...entityFilter },
      include: { expenditures: { select: { quarter: true, amount: true } } },
      orderBy: { category: "asc" },
    }),
    prisma.disbursement.findMany({ where: { ...fyFilter, ...entityFilter }, orderBy: { trancheNumber: "asc" } }),
    prisma.kpi.findMany({
      where: { ...fyFilter, ...entityFilter },
      include: {
        milestones: { select: { targetValue: true, reportingPeriod: { select: { quarter: true } } } },
        performanceReports: {
          select: { actualValue: true, varianceExplanation: true, correctiveAction: true, reportingPeriod: { select: { quarter: true } } },
        },
      },
      orderBy: [{ programme: "asc" }, { name: "asc" }],
    }),
    prisma.report.findMany({
      where: { ...fyFilter, ...entityFilter },
      include: { reportingPeriod: { select: { quarter: true } } },
      orderBy: [{ dueDate: "asc" }, { kind: "asc" }],
    }),
    prisma.reportingPeriod.findMany({ where: { ...fyFilter, quarter: { in: ["Q1", "Q2", "Q3", "Q4"] } }, select: { quarter: true, dueDate: true } }),
  ]);

  const periodDue = Object.fromEntries(periods.map((p) => [p.quarter, p.dueDate])) as Record<PerfQuarter, Date>;
  const dueQuarter = PERF_QUARTERS.every((q) => periodDue[q]) ? latestDueQuarter(periodDue, today) : null;
  const dueSoonDays = dueSoonWindowDays();

  const group = <T extends { entityId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) map.set(row.entityId, [...(map.get(row.entityId) ?? []), row]);
    return map;
  };
  const linesByEntity = group(budgetLines);
  const disbursementsByEntity = group(disbursements);
  const kpisByEntity = group(kpis);
  const reportsByEntity = group(reports);

  const result = new Map<string, EntityFyMetrics>();

  for (const { id: entityId } of entityRows) {
    // ---- Finance ----
    const lines = linesByEntity.get(entityId) ?? [];
    const finance = calcEntityFinance(
      lines.map((line) => ({
        id: line.id,
        category: line.category,
        annualBudget: num(line.annualBudget),
        quarterly: Object.fromEntries(
          line.expenditures.filter((e) => e.quarter !== "ANNUAL").map((e) => [e.quarter, num(e.amount)]),
        ) as Partial<Record<FinanceQuarter, number>>,
      })),
      (disbursementsByEntity.get(entityId) ?? []).map((d) => num(d.amount)),
    );

    // ---- Performance ----
    const entityKpis = kpisByEntity.get(entityId) ?? [];
    let dataQuarter: PerfQuarter | null = null;
    for (const kpi of entityKpis) {
      for (const report of kpi.performanceReports) {
        const q = report.reportingPeriod.quarter as PerfQuarter;
        if (PERF_QUARTERS.includes(q) && (!dataQuarter || PERF_QUARTERS.indexOf(q) > PERF_QUARTERS.indexOf(dataQuarter))) dataQuarter = q;
      }
    }
    const asAt = assessmentQuarter(dueQuarter, dataQuarter);

    const kpiRows: KpiRow[] = entityKpis.map((kpi) => {
      const quarters = Object.fromEntries(
        PERF_QUARTERS.map((q) => {
          const milestone = kpi.milestones.find((m) => m.reportingPeriod.quarter === q);
          const report = kpi.performanceReports.find((r) => r.reportingPeriod.quarter === q);
          return [
            q,
            {
              target: milestone ? num(milestone.targetValue) : null,
              actual: report ? num(report.actualValue) : null,
              varianceExplanation: report?.varianceExplanation ?? null,
              correctiveAction: report?.correctiveAction ?? null,
            } satisfies KpiQuarterCell,
          ];
        }),
      ) as Record<PerfQuarter, KpiQuarterCell>;

      const result = asAt ? calcKpi({ id: kpi.id, annualTarget: num(kpi.annualTarget), aggregation: kpi.aggregation, quarters }, asAt) : null;
      return {
        id: kpi.id,
        programme: kpi.programme,
        objective: kpi.objective,
        name: kpi.name,
        unit: kpi.unit,
        aggregation: kpi.aggregation,
        annualTarget: num(kpi.annualTarget),
        quarters,
        result,
        reasonForVariance: asAt ? quarters[asAt].varianceExplanation : null,
        correctiveAction: asAt ? quarters[asAt].correctiveAction : null,
      };
    });
    const performanceSummary = summarisePerformance(kpiRows.map((k) => ({ status: k.result?.status ?? null })));

    // ---- Compliance ----
    const reportRows: ReportRow[] = (reportsByEntity.get(entityId) ?? []).map((report) => {
      const status = report.status as ReportStatusKey;
      return {
        id: report.id,
        kind: report.kind,
        title: report.title,
        quarter: report.reportingPeriod.quarter,
        dueDate: report.dueDate,
        status,
        submittedAt: report.submittedAt,
        reviewedAt: report.reviewedAt,
        reviewComment: report.reviewComment,
        finalisedAt: report.finalisedAt,
        compliance: complianceOf({ status, dueDate: report.dueDate, submittedAt: report.submittedAt }, today, dueSoonDays),
      };
    });
    const complianceSummary = summariseCompliance(
      reportRows.map((r) => ({ status: r.status, dueDate: r.dueDate, submittedAt: r.submittedAt })),
      today,
      dueSoonDays,
    );
    const nextDue =
      reportRows
        .filter((r) => (r.status === "DRAFT" || r.status === "RETURNED") && r.compliance.daysUntilDue >= 0)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;

    result.set(entityId, {
      entityId,
      financialYearId: params.financialYearId,
      asAt,
      finance: {
        lines: finance.lines,
        summary: finance.summary,
        latestQuarter: finance.latestQuarter,
        disbursements: (disbursementsByEntity.get(entityId) ?? []).map((d) => ({ tranche: d.trancheNumber, amount: num(d.amount), disbursedAt: d.disbursedAt })),
      },
      performance: { kpis: kpiRows, summary: performanceSummary, band: performanceBand(performanceSummary.overall) },
      compliance: { reports: reportRows, summary: complianceSummary, nextDue },
    });
  }

  return result;
}

export type ExpenseCategoryKey = ExpenseCategory;
