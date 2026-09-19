import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { ReportsTable, type ReportTableRow } from "@/components/reports-table";
import { canCaptureReportingData, canFinaliseReports, canReviewReports } from "@/lib/constants";
import { getSubmissionProblems } from "@/lib/data/reports";
import type { CurrentUser } from "@/lib/tenant-scope";
import type { EntityContext } from "@/lib/data/entity-view";
import type { ReportRow } from "@/lib/data/metrics";
import type { ReportListRow } from "@/lib/data/reports";

/** Adapts either report shape into what the (client) table needs — dates as ISO strings. */
export function toTableRow(
  r: Pick<ReportListRow, "id" | "entityId" | "entityName" | "title" | "kind" | "dueDate" | "submittedAt" | "status" | "reviewComment"> & { compliance: ReportRow["compliance"] },
  problems: string[] = [],
  attachments = 0,
): ReportTableRow {
  return {
    id: r.id,
    entityId: r.entityId,
    entityName: r.entityName,
    title: r.title,
    kind: r.kind,
    dueDate: r.dueDate.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    status: r.status,
    reviewComment: r.reviewComment,
    complianceState: r.compliance.state,
    complianceColour: r.compliance.colour,
    daysUntilDue: r.compliance.daysUntilDue,
    problems,
    attachments,
  };
}

/** The Reports tab for one entity — current and historical submissions with their workflow status. */
export async function EntityReportsView({ ctx, user }: { ctx: EntityContext; user: CurrentUser }) {
  const { metrics, entity, selectedFinancialYear } = ctx;
  const { reports, summary } = metrics.compliance;
  const isOwnEntity = canCaptureReportingData(user.role) && user.entityId === entity.id;

  const attachmentCounts = await prisma.document.groupBy({ by: ["reportId"], where: { entityId: entity.id, deletedAt: null, reportId: { not: null } }, _count: { _all: true } });
  const attachmentsByReport = new Map(attachmentCounts.map((a) => [a.reportId as string, a._count._all]));

  // Readiness is only worked out for reports the entity could act on soon; later ones simply aren't open yet.
  const problemsByReport = new Map<string, string[]>();
  if (isOwnEntity) {
    await Promise.all(
      reports
        .filter((r) => (r.status === "DRAFT" || r.status === "RETURNED") && r.compliance.daysUntilDue <= 60)
        .map(async (r) => problemsByReport.set(r.id, await getSubmissionProblems(r.id))),
    );
    for (const r of reports) if ((r.status === "DRAFT" || r.status === "RETURNED") && !problemsByReport.has(r.id)) problemsByReport.set(r.id, ["Not open yet — this report opens closer to its due date."]);
  }

  const rows = reports.map((r) => toTableRow({ ...r, entityId: entity.id, entityName: entity.name }, problemsByReport.get(r.id) ?? [], attachmentsByReport.get(r.id) ?? 0));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Reports submitted" value={summary.submitted} hint={`of ${summary.total} required this year`} />
        <StatCard label="Reports outstanding" value={summary.outstanding} hint="Past due and still to be submitted or corrected" />
        <StatCard label="Not yet due" value={summary.notYetDue} hint="Nothing owed yet" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reports — FY {selectedFinancialYear.label}</CardTitle>
          <CardDescription>Draft → Submitted → Under review → Accepted or Returned for correction → Finalised. Attachments are evidence; the figures captured in Performance and Finance are the report.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportsTable rows={rows} mode={isOwnEntity ? "entity" : "dsac"} showEntity={false} canReview={canReviewReports(user.role)} canFinalise={canFinaliseReports(user.role)} />
        </CardContent>
      </Card>
    </div>
  );
}
