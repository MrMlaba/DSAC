import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/current-user";
import { canFinaliseReports, canReviewReports, isDsacWideRole } from "@/lib/constants";
import { now } from "@/lib/clock";
import { resolveFinancialYear } from "@/lib/data/financial-years";
import { listReports } from "@/lib/data/reports";
import { dueSoonWindowDays } from "@/lib/data/metrics";
import { getEntityContext } from "@/lib/data/entity-view";
import { summariseCompliance, type ReportStatusKey } from "@/lib/calc/compliance";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportsTable } from "@/components/reports-table";
import { EntityReportsView, toTableRow } from "@/components/reports-view";
import { redirect } from "next/navigation";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const { financialYears, selected } = await resolveFinancialYear(params.fy);

  // Entity portal: the entity's own reports, with submit actions.
  if (!isDsacWideRole(user.role)) {
    if (!user.entityId) redirect("/dashboard");
    const ctx = await getEntityContext(user, user.entityId, selected.id);
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Your current and historical submissions and their review status." financialYears={financialYears} selectedFinancialYearId={selected.id} />
        <EntityReportsView ctx={ctx} user={user} />
      </div>
    );
  }

  // DSAC: every required submission across the portfolio, with review actions.
  const [reports, attachmentGroups] = await Promise.all([
    listReports(user, { financialYearId: selected.id }),
    prisma.document.groupBy({ by: ["reportId"], where: { deletedAt: null, reportId: { not: null }, report: { financialYearId: selected.id } }, _count: { _all: true } }),
  ]);
  const attachments = new Map(attachmentGroups.map((a) => [a.reportId as string, a._count._all]));
  const summary = summariseCompliance(reports.map((r) => ({ status: r.status as ReportStatusKey, dueDate: r.dueDate, submittedAt: r.submittedAt })), now(), dueSoonWindowDays());
  const awaitingReview = reports.filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={`Every required submission from every organisation, with its status. Review and decide here. FY ${selected.label}.`} financialYears={financialYears} selectedFinancialYearId={selected.id} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Reports submitted" value={summary.submitted} hint={`of ${summary.total} required this year`} />
        <StatCard label="Awaiting DSAC review" value={awaitingReview} hint="Submitted or under review" />
        <StatCard label="Outstanding" value={summary.outstanding} hint="Past due and still to be submitted or corrected" />
        <StatCard label="Not yet due" value={summary.notYetDue} hint="Nothing owed yet" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All reports</CardTitle>
          <CardDescription>Draft → Submitted → Under review → Accepted or Returned for correction → Finalised.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportsTable
            rows={reports.map((r) => toTableRow(r, [], attachments.get(r.id) ?? 0))}
            mode="dsac"
            showEntity
            canReview={canReviewReports(user.role)}
            canFinalise={canFinaliseReports(user.role)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
