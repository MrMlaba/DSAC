import { prisma } from "@/lib/prisma";
import { now } from "@/lib/clock";
import { assertEntityAccess, type CurrentUser } from "@/lib/tenant-scope";
import { canCaptureReportingData } from "@/lib/constants";
import { logAudit } from "@/lib/data/audit";
import { quarterBounds } from "@/lib/reporting-calendar";
import { toRandCents } from "@/lib/validation/reporting";
import type { ReportKind } from "@prisma/client";

type CaptureQuarter = "Q1" | "Q2" | "Q3" | "Q4";

/**
 * Data can only be captured against a quarter that has started and whose report is still editable
 * (Draft, or Returned for correction). Once a report is submitted its figures are locked — DSAC
 * reviews exactly what was submitted, and history stays intact for drill-down and audit.
 */
async function requireEditableReport(user: CurrentUser, entityId: string, financialYearId: string, quarter: CaptureQuarter, kind: ReportKind) {
  if (!canCaptureReportingData(user.role)) throw new Error("Forbidden: this role cannot capture reporting data.");
  assertEntityAccess(user, entityId);

  const report = await prisma.report.findFirst({
    where: { entityId, financialYearId, kind, reportingPeriod: { quarter } },
    include: { financialYear: { select: { startDate: true } }, reportingPeriod: { select: { id: true } } },
  });
  if (!report) throw new Error(`No ${quarter} report exists for this entity and year.`);
  if (report.status !== "DRAFT" && report.status !== "RETURNED") throw new Error(`${quarter} has already been submitted, so its figures are locked.`);
  if (quarterBounds(report.financialYear.startDate, quarter).start > now()) throw new Error(`${quarter} has not started yet.`);
  return report;
}

export async function savePerformanceEntries(
  user: CurrentUser,
  input: { entityId: string; financialYearId: string; quarter: CaptureQuarter; entries: { kpiId: string; actual: number; varianceExplanation?: string; correctiveAction?: string }[] },
  ipAddress?: string | null,
) {
  const report = await requireEditableReport(user, input.entityId, input.financialYearId, input.quarter, "QUARTERLY_PERFORMANCE");

  const kpis = await prisma.kpi.findMany({ where: { entityId: input.entityId, financialYearId: input.financialYearId }, select: { id: true, unit: true } });
  const known = new Map(kpis.map((k) => [k.id, k]));
  for (const entry of input.entries) {
    const kpi = known.get(entry.kpiId);
    if (!kpi) throw new Error("One of the KPIs does not belong to this entity and year.");
    if (kpi.unit === "%" && entry.actual > 100) throw new Error("A percentage result cannot be more than 100.");
  }

  await prisma.$transaction(
    input.entries.map((entry) =>
      prisma.performanceReport.upsert({
        where: { kpiId_reportingPeriodId: { kpiId: entry.kpiId, reportingPeriodId: report.reportingPeriod.id } },
        create: {
          kpiId: entry.kpiId,
          reportingPeriodId: report.reportingPeriod.id,
          actualValue: entry.actual,
          varianceExplanation: entry.varianceExplanation || null,
          correctiveAction: entry.correctiveAction || null,
          submittedById: user.id,
        },
        update: {
          actualValue: entry.actual,
          varianceExplanation: entry.varianceExplanation || null,
          correctiveAction: entry.correctiveAction || null,
          submittedById: user.id,
          submittedAt: now(),
        },
      }),
    ),
  );

  await logAudit({ userId: user.id, entityId: input.entityId, action: "PERFORMANCE_CAPTURED", targetType: "report", targetId: report.id, ipAddress, after: { quarter: input.quarter, kpisUpdated: input.entries.length } });
  return { saved: input.entries.length };
}

export async function saveExpenditureEntries(
  user: CurrentUser,
  input: { entityId: string; financialYearId: string; quarter: CaptureQuarter; entries: { budgetLineId: string; amount: number; note?: string }[] },
  ipAddress?: string | null,
) {
  const report = await requireEditableReport(user, input.entityId, input.financialYearId, input.quarter, "QUARTERLY_FINANCIAL");

  const lines = await prisma.budgetLine.findMany({ where: { entityId: input.entityId, financialYearId: input.financialYearId }, select: { id: true } });
  const known = new Set(lines.map((l) => l.id));
  if (input.entries.some((e) => !known.has(e.budgetLineId))) throw new Error("One of the budget lines does not belong to this entity and year.");

  await prisma.$transaction(
    input.entries.map((entry) =>
      prisma.quarterlyExpenditure.upsert({
        where: { budgetLineId_quarter: { budgetLineId: entry.budgetLineId, quarter: input.quarter } },
        create: { budgetLineId: entry.budgetLineId, quarter: input.quarter, amount: toRandCents(entry.amount), note: entry.note || null },
        update: { amount: toRandCents(entry.amount), note: entry.note || null, recordedAt: now() },
      }),
    ),
  );

  await logAudit({ userId: user.id, entityId: input.entityId, action: "EXPENDITURE_CAPTURED", targetType: "report", targetId: report.id, ipAddress, after: { quarter: input.quarter, linesUpdated: input.entries.length } });
  return { saved: input.entries.length };
}
