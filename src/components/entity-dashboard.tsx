import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { MagnitudeBar } from "@/components/proportion-bar";
import { PageHeader } from "@/components/page-header";
import { PerformanceBandBadge, ReportStatusBadge, RequestStatusBadge } from "@/components/status-badge";
import { COMPLIANCE_COLOURS } from "@/lib/risk-visuals";
import { REPORT_KIND_LABELS } from "@/lib/reporting-calendar";
import { formatDate, formatPercent, formatRand, formatRandCompact } from "@/lib/format";
import { getEntityContext } from "@/lib/data/entity-view";
import { listRequests } from "@/lib/data/requests";
import { upcomingDeadlines } from "@/components/overview-view";
import type { CurrentUser } from "@/lib/tenant-scope";
import type { ReportRow } from "@/lib/data/metrics";

const reportLabel = (r: ReportRow) => `${REPORT_KIND_LABELS[r.kind]}${r.quarter === "ANNUAL" ? "" : ` ${r.quarter}`}`;

function daysText(days: number): string {
  if (days < 0) return `overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "due today";
  return `due in ${days} day${days === 1 ? "" : "s"}`;
}

/** The entity / NPO home: five essential cards, then deadlines, recent submissions, alerts and DSAC's latest feedback. */
export async function EntityDashboard({
  user,
  entityId,
  financialYears,
  fyParam,
}: {
  user: CurrentUser;
  entityId: string;
  financialYears: { id: string; label: string }[];
  fyParam?: string;
}) {
  const [ctx, requests] = await Promise.all([getEntityContext(user, entityId, fyParam), listRequests(user)]);
  const { metrics, alerts, entity, selectedFinancialYear } = ctx;
  const { finance, performance, compliance } = metrics;

  const underReview = requests.filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length;
  const needInfo = requests.filter((r) => r.status === "MORE_INFO_REQUIRED").length;
  const deadlines = upcomingDeadlines(compliance.reports);
  const recent = [...compliance.reports].filter((r) => r.submittedAt).sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0)).slice(0, 5);

  const feedback = [
    ...compliance.reports.filter((r) => r.reviewComment && r.reviewedAt && (r.status === "RETURNED" || r.status === "ACCEPTED" || r.status === "FINALISED")).map((r) => ({ at: r.reviewedAt as Date, title: reportLabel(r), text: r.reviewComment as string, returned: r.status === "RETURNED" })),
    ...requests.filter((r) => r.decisionNote && r.decidedAt).map((r) => ({ at: r.decidedAt as Date, title: r.title, text: r.decisionNote as string, returned: r.status === "MORE_INFO_REQUIRED" || r.status === "DECLINED" })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader title={entity.name} description={`Your reporting at a glance · FY ${selectedFinancialYear.label}`} financialYears={financialYears} selectedFinancialYearId={selectedFinancialYear.id} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Performance" value={formatPercent(performance.summary.overall)} hint="of targets achieved / on track">
          <PerformanceBandBadge band={performance.band} />
        </StatCard>
        <StatCard label="Finance" value={formatPercent(finance.summary.budgetUtilisation)} hint={`Approved ${formatRandCompact(finance.summary.approved)} · Utilised ${formatRandCompact(finance.summary.utilised)}`}>
          <MagnitudeBar value={finance.summary.budgetUtilisation ?? 0} color="var(--chart-2)" />
          <p className="text-muted-foreground text-xs">Budget utilisation</p>
        </StatCard>
        <StatCard label="Compliance" value={compliance.summary.dueSoon + compliance.summary.returned} hint={`due soon or returned · ${compliance.summary.overdue} overdue`} />
        <StatCard
          label="Reports"
          value={compliance.nextDue ? formatDate(compliance.nextDue.dueDate) : "—"}
          hint={compliance.nextDue ? `${reportLabel(compliance.nextDue)} · ${daysText(compliance.nextDue.compliance.daysUntilDue)}` : "Nothing due"}
        />
        <StatCard label="Requests" value={underReview} hint={needInfo > 0 ? `under review · ${needInfo} need more information` : "under review"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing is due right now.</p>
            ) : (
              <ul className="divide-y">
                {deadlines.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0">
                    <span>{reportLabel(r)}</span>
                    <span className={`text-xs whitespace-nowrap ${r.compliance.state === "OVERDUE" ? "font-medium text-[var(--status-critical)]" : "text-muted-foreground"}`}>
                      {formatDate(r.dueDate)} · {daysText(r.compliance.daysUntilDue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/compliance" className="text-primary mt-3 inline-block text-xs hover:underline">
              Open compliance
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">You haven&apos;t submitted anything this year yet.</p>
            ) : (
              <ul className="divide-y">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0">
                    <span>
                      {reportLabel(r)}
                      <span className="text-muted-foreground ml-1.5 text-xs">{formatDate(r.submittedAt)}</span>
                    </span>
                    <ReportStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
            <Link href="/reports" className="text-primary mt-3 inline-block text-xs hover:underline">
              Open reports
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alerts</CardTitle>
            <CardDescription>Raised automatically from your own figures.</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No alerts — everything is on track.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 6).map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: a.severity === "critical" ? COMPLIANCE_COLOURS.red : a.severity === "warning" ? COMPLIANCE_COLOURS.amber : COMPLIANCE_COLOURS.neutral }}
                    />
                    {a.message}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest DSAC feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {feedback.length === 0 ? (
              <p className="text-muted-foreground text-sm">No feedback from DSAC yet.</p>
            ) : (
              <ul className="space-y-3">
                {feedback.map((f, i) => (
                  <li key={i} className="text-sm">
                    <p className="flex items-center justify-between gap-2 font-medium">
                      <span>{f.title}</span>
                      <span className="text-muted-foreground text-xs font-normal">{formatDate(f.at)}</span>
                    </p>
                    <p className={f.returned ? "text-[var(--status-serious)]" : "text-muted-foreground"}>{f.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {requests.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0">
                  <span>
                    {r.title}
                    {r.amountRequested !== null && <span className="text-muted-foreground ml-1.5 text-xs">{formatRand(r.amountRequested)}</span>}
                  </span>
                  <RequestStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
            <Link href="/requests" className="text-primary mt-3 inline-block text-xs hover:underline">
              Open requests
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
