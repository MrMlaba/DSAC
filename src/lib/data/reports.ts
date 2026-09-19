import { prisma } from "@/lib/prisma";
import { now } from "@/lib/clock";
import { assertEntityAccess, entityScopeWhere, type CurrentUser } from "@/lib/tenant-scope";
import { EXPENSE_CATEGORY_LABELS, canCaptureReportingData, canFinaliseReports, canReviewReports } from "@/lib/constants";
import { logAudit } from "@/lib/data/audit";
import { notifyUser } from "@/lib/data/notifications";
import { dueSoonWindowDays } from "@/lib/data/metrics";
import { complianceOf, type ComplianceResult, type ReportStatusKey } from "@/lib/calc/compliance";
import { calcKpi, PERF_QUARTERS, type PerfQuarter } from "@/lib/calc/performance";
import { formatPercent } from "@/lib/format";
import { quarterBounds } from "@/lib/reporting-calendar";
import type { ReportKind, ReportStatus } from "@prisma/client";

export interface ReportListRow {
  id: string;
  entityId: string;
  entityName: string;
  title: string;
  kind: ReportKind;
  quarter: "Q1" | "Q2" | "Q3" | "Q4" | "ANNUAL";
  financialYearLabel: string;
  dueDate: Date;
  status: ReportStatus;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewComment: string | null;
  compliance: ComplianceResult;
}

export interface ReportFilters {
  financialYearId: string;
  entityId?: string;
  status?: ReportStatus;
  /** Past due and still owed (draft or returned) — the "Outstanding" figure on the dashboards. */
  outstandingOnly?: boolean;
}

/** Reports in scope for the viewer: every entity's for DSAC roles, only their own for entity roles. */
export async function listReports(user: CurrentUser, filters: ReportFilters): Promise<ReportListRow[]> {
  const today = now();
  const dueSoonDays = dueSoonWindowDays();
  const tenant = entityScopeWhere(user);

  const reports = await prisma.report.findMany({
    where: {
      financialYearId: filters.financialYearId,
      ...tenant,
      ...(!tenant.entityId && filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      entity: { select: { name: true } },
      financialYear: { select: { label: true } },
      reportingPeriod: { select: { quarter: true } },
    },
    orderBy: [{ dueDate: "asc" }, { entity: { name: "asc" } }],
  });

  const rows = reports.map((r) => ({
    id: r.id,
    entityId: r.entityId,
    entityName: r.entity.name,
    title: r.title,
    kind: r.kind,
    quarter: r.reportingPeriod.quarter,
    financialYearLabel: r.financialYear.label,
    dueDate: r.dueDate,
    status: r.status,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    reviewComment: r.reviewComment,
    compliance: complianceOf({ status: r.status as ReportStatusKey, dueDate: r.dueDate, submittedAt: r.submittedAt }, today, dueSoonDays),
  }));

  return filters.outstandingOnly ? rows.filter((r) => (r.status === "DRAFT" || r.status === "RETURNED") && r.compliance.daysUntilDue < 0) : rows;
}

// ---------------------------------------------------------------------------
// Submission readiness
// ---------------------------------------------------------------------------

/** What is still missing before a report can be submitted. Used by the Reports tab and enforced on submit. */
export async function getSubmissionProblems(reportId: string): Promise<string[]> {
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: { reportingPeriod: { select: { id: true, quarter: true } }, financialYear: { select: { id: true, startDate: true } } },
  });
  const problems: string[] = [];
  const quarter = report.reportingPeriod.quarter;
  const isQuarterly = quarter !== "ANNUAL";

  if (isQuarterly) {
    const { start } = quarterBounds(report.financialYear.startDate, quarter);
    if (start > now()) problems.push(`${quarter} has not started yet.`);

    const earlier = await prisma.report.findMany({
      where: { entityId: report.entityId, financialYearId: report.financialYearId, kind: report.kind, status: "DRAFT", reportingPeriod: { quarter: { in: PERF_QUARTERS.slice(0, PERF_QUARTERS.indexOf(quarter as PerfQuarter)) } } },
      select: { reportingPeriod: { select: { quarter: true } } },
    });
    for (const e of earlier) problems.push(`Submit ${e.reportingPeriod.quarter} first — year-to-date figures build on earlier quarters.`);
  }

  if (report.kind === "QUARTERLY_PERFORMANCE" && isQuarterly) {
    const kpis = await prisma.kpi.findMany({
      where: { entityId: report.entityId, financialYearId: report.financialYearId },
      include: {
        milestones: { select: { targetValue: true, reportingPeriod: { select: { quarter: true } } } },
        performanceReports: { select: { actualValue: true, varianceExplanation: true, reportingPeriod: { select: { quarter: true } } } },
      },
      orderBy: { name: "asc" },
    });
    for (const kpi of kpis) {
      const cells = Object.fromEntries(
        PERF_QUARTERS.map((q) => {
          const m = kpi.milestones.find((x) => x.reportingPeriod.quarter === q);
          const r = kpi.performanceReports.find((x) => x.reportingPeriod.quarter === q);
          return [q, { target: m ? m.targetValue.toNumber() : null, actual: r ? r.actualValue.toNumber() : null }];
        }),
      ) as Record<PerfQuarter, { target: number | null; actual: number | null }>;
      const thisQuarter = kpi.performanceReports.find((r) => r.reportingPeriod.quarter === quarter);
      if (!thisQuarter) {
        problems.push(`${kpi.name}: enter the ${quarter} result.`);
        continue;
      }
      const result = calcKpi({ id: kpi.id, annualTarget: kpi.annualTarget.toNumber(), aggregation: kpi.aggregation, quarters: cells }, quarter as PerfQuarter);
      if ((result.status === "AT_RISK" || result.status === "NOT_ACHIEVED") && !thisQuarter.varianceExplanation?.trim()) {
        problems.push(`${kpi.name}: at ${formatPercent(result.achievement)} of the year-to-date target — give a reason for the variance.`);
      }
    }
  }

  if (report.kind === "QUARTERLY_FINANCIAL" && isQuarterly) {
    const lines = await prisma.budgetLine.findMany({
      where: { entityId: report.entityId, financialYearId: report.financialYearId },
      include: { expenditures: { where: { quarter }, select: { id: true } } },
    });
    for (const line of lines) {
      if (line.expenditures.length === 0) problems.push(`${EXPENSE_CATEGORY_LABELS[line.category]}: enter the ${quarter} expenditure (enter 0 if nothing was spent).`);
    }
  }

  if (report.kind === "GOVERNANCE_RETURN" || report.kind === "ANNUAL_REPORT") {
    const attachments = await prisma.document.count({ where: { reportId: report.id, deletedAt: null } });
    if (attachments === 0) problems.push(report.kind === "ANNUAL_REPORT" ? "Attach the annual report as a supporting document." : "Attach the signed governance return as a supporting document.");
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Entity: submit
// ---------------------------------------------------------------------------

export async function submitReport(user: CurrentUser, reportId: string, ipAddress?: string | null) {
  if (!canCaptureReportingData(user.role)) throw new Error("Forbidden: this role cannot submit reports.");
  const report = await prisma.report.findUniqueOrThrow({ where: { id: reportId }, include: { entity: { select: { name: true } } } });
  assertEntityAccess(user, report.entityId);

  if (report.status !== "DRAFT" && report.status !== "RETURNED") throw new Error(`This report is already ${report.status.toLowerCase().replace("_", " ")}.`);

  const problems = await getSubmissionProblems(reportId);
  if (problems.length > 0) throw new SubmissionBlockedError(problems);

  const submittedAt = now();
  const updated = await prisma.report.update({
    where: { id: reportId },
    data: { status: "SUBMITTED", submittedAt, submittedById: user.id, reviewedAt: null, reviewedById: null, reviewComment: null },
  });

  await logAudit({
    userId: user.id,
    entityId: report.entityId,
    action: "REPORT_SUBMITTED",
    targetType: "report",
    targetId: reportId,
    ipAddress,
    before: { status: report.status },
    after: { status: updated.status, title: report.title },
  });

  const dsacUsers = await prisma.user.findMany({ where: { role: { in: ["DSAC_ADMIN", "DSAC_ANALYST"] } } });
  await Promise.all(
    dsacUsers.map((dsac) =>
      notifyUser({
        userId: dsac.id,
        userEmail: dsac.email,
        entityId: report.entityId,
        type: "REPORT_SUBMITTED",
        title: `${report.entity.name} submitted ${report.title}`,
        body: `${report.title} is ready for review.`,
        link: "/reports",
        channels: ["IN_APP"],
      }),
    ),
  );

  return updated;
}

export class SubmissionBlockedError extends Error {
  constructor(public problems: string[]) {
    super(`This report is not ready to submit: ${problems[0]}`);
  }
}

// ---------------------------------------------------------------------------
// DSAC: review
// ---------------------------------------------------------------------------

export type ReportReviewAction = "START_REVIEW" | "ACCEPT" | "RETURN" | "FINALISE";

export async function reviewReport(user: CurrentUser, reportId: string, action: ReportReviewAction, comment: string | undefined, ipAddress?: string | null) {
  if (!canReviewReports(user.role)) throw new Error("Forbidden: this role cannot review reports.");
  if (action === "FINALISE" && !canFinaliseReports(user.role)) throw new Error("Forbidden: only a DSAC Admin can finalise a report.");

  const report = await prisma.report.findUniqueOrThrow({ where: { id: reportId }, include: { entity: { select: { name: true } } } });
  const inReview: ReportStatus[] = ["SUBMITTED", "UNDER_REVIEW"];

  let next: ReportStatus;
  switch (action) {
    case "START_REVIEW":
      if (report.status !== "SUBMITTED") throw new Error("Only a submitted report can be taken into review.");
      next = "UNDER_REVIEW";
      break;
    case "ACCEPT":
      if (!inReview.includes(report.status)) throw new Error("Only a submitted report can be accepted.");
      next = "ACCEPTED";
      break;
    case "RETURN":
      if (!inReview.includes(report.status)) throw new Error("Only a submitted report can be returned.");
      if (!comment?.trim()) throw new Error("Say what needs correcting when returning a report.");
      next = "RETURNED";
      break;
    case "FINALISE":
      if (report.status !== "ACCEPTED") throw new Error("Only an accepted report can be finalised.");
      next = "FINALISED";
      break;
  }

  const reviewedAt = now();
  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: next,
      reviewedAt,
      reviewedById: user.id,
      ...(action === "RETURN" ? { reviewComment: comment!.trim() } : action === "ACCEPT" || action === "FINALISE" ? { reviewComment: comment?.trim() || report.reviewComment } : {}),
      ...(action === "FINALISE" ? { finalisedAt: reviewedAt } : {}),
    },
  });

  await logAudit({
    userId: user.id,
    entityId: report.entityId,
    action: `REPORT_${action}`,
    targetType: "report",
    targetId: reportId,
    ipAddress,
    before: { status: report.status },
    after: { status: updated.status, ...(comment ? { comment } : {}) },
  });

  if (action !== "START_REVIEW") {
    const entityUsers = await prisma.user.findMany({ where: { entityId: report.entityId, role: { in: ["ENTITY_ADMIN", "ENTITY_CONTRIBUTOR"] } } });
    const returned = action === "RETURN";
    await Promise.all(
      entityUsers.map((u) =>
        notifyUser({
          userId: u.id,
          userEmail: u.email,
          entityId: report.entityId,
          type: returned ? "REVIEW_RETURNED" : "REVIEW_APPROVED",
          title: returned ? `DSAC has returned your report for correction: ${report.title}` : `${report.title} was ${action === "FINALISE" ? "finalised" : "accepted"}`,
          body: returned ? comment!.trim() : `DSAC has ${action === "FINALISE" ? "finalised" : "accepted"} ${report.title}.`,
          link: "/reports",
          channels: returned ? ["IN_APP", "EMAIL"] : ["IN_APP"],
        }),
      ),
    );
  }

  return updated;
}
