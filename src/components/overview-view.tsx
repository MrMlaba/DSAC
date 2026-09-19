import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { EntityComplianceBadge, KpiStatusBadge, PerformanceBandBadge, ReportStatusBadge } from "@/components/status-badge";
import { MagnitudeBar } from "@/components/proportion-bar";
import { COMPLIANCE_COLOURS } from "@/lib/risk-visuals";
import { REPORT_KIND_LABELS } from "@/lib/reporting-calendar";
import { formatDate, formatPercent, formatRand, formatRandCompact, formatSigned, formatKpiValue } from "@/lib/format";
import type { EntityContext } from "@/lib/data/entity-view";
import type { ReportRow } from "@/lib/data/metrics";

const reportLabel = (r: ReportRow) => `${REPORT_KIND_LABELS[r.kind]}${r.quarter === "ANNUAL" ? "" : ` ${r.quarter}`}`;

function daysText(days: number): string {
  if (days < 0) return `overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "due today";
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** Upcoming/owed reports, soonest first. */
export function upcomingDeadlines(reports: ReportRow[], limit = 5): ReportRow[] {
  return reports
    .filter((r) => (r.status === "DRAFT" || r.status === "RETURNED") && r.compliance.daysUntilDue >= -90)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .filter((r) => r.compliance.daysUntilDue >= 0 || r.compliance.state === "OVERDUE" || r.compliance.state === "RETURNED")
    .slice(0, limit);
}

function AlertList({ alerts }: { alerts: EntityContext["alerts"] }) {
  if (alerts.length === 0) return <p className="text-muted-foreground text-sm">No alerts — everything is on track.</p>;
  return (
    <ul className="space-y-2">
      {alerts.slice(0, 5).map((a, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{ backgroundColor: a.severity === "critical" ? COMPLIANCE_COLOURS.red : a.severity === "warning" ? COMPLIANCE_COLOURS.amber : COMPLIANCE_COLOURS.neutral }}
          />
          {a.message}
        </li>
      ))}
    </ul>
  );
}

function SectionCard({ title, description, href, hrefLabel, children }: { title: string; description?: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {href && (
          <Link href={href} className="text-primary inline-flex items-center gap-1 text-xs hover:underline">
            {hrefLabel ?? "View all"} <ArrowRightIcon className="size-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/** The DSAC entity Overview: the eight headline figures, then four short lists. Everything deeper lives in the other tabs. */
export function OverviewView({ ctx, basePath }: { ctx: EntityContext; basePath: string }) {
  const { metrics, alerts, selectedFinancialYear } = ctx;
  const { finance, performance, compliance } = metrics;
  const fy = `?fy=${selectedFinancialYear.id}`;

  const concerns = performance.kpis
    .filter((k) => k.result?.status === "NOT_ACHIEVED" || k.result?.status === "AT_RISK")
    .sort((a, b) => (a.result?.achievement ?? 0) - (b.result?.achievement ?? 0))
    .slice(0, 5);
  const latestReports = [...compliance.reports]
    .filter((r) => r.submittedAt || r.reviewedAt)
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
    .slice(0, 5);
  const deadlines = upcomingDeadlines(compliance.reports);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overall performance" value={formatPercent(performance.summary.overall)} hint={`${performance.summary.achieved + performance.summary.onTrack} of ${performance.summary.assessed} KPIs achieved or on track`}>
          <PerformanceBandBadge band={performance.band} />
        </StatCard>
        <StatCard label="Compliance status" value={<EntityComplianceBadge status={compliance.summary.status} />} hint={`${formatPercent(compliance.summary.rate)} compliance rate`} />
        <StatCard label="Approved annual budget" value={formatRandCompact(finance.summary.approved)} exact={formatRand(finance.summary.approved)} hint={`FY ${selectedFinancialYear.label}`} />
        <StatCard label="Amount disbursed" value={formatRandCompact(finance.summary.disbursed)} exact={formatRand(finance.summary.disbursed)} hint={`${formatPercent(finance.summary.disbursementRate)} of approved budget`} />
        <StatCard label="Amount utilised" value={formatRandCompact(finance.summary.utilised)} exact={formatRand(finance.summary.utilised)} hint={`${formatPercent(finance.summary.fundUtilisation)} of disbursed funds`} />
        <StatCard label="Budget utilisation" value={formatPercent(finance.summary.budgetUtilisation)} hint="Utilised ÷ approved annual budget">
          <MagnitudeBar value={finance.summary.budgetUtilisation ?? 0} color="var(--chart-2)" />
        </StatCard>
        <StatCard label="Reports outstanding" value={compliance.summary.outstanding} hint={`${compliance.summary.submitted} submitted · ${compliance.summary.notYetDue} not yet due`} />
        <StatCard
          label="Next reporting due date"
          value={compliance.nextDue ? formatDate(compliance.nextDue.dueDate) : "—"}
          hint={compliance.nextDue ? `${reportLabel(compliance.nextDue)} · ${daysText(compliance.nextDue.compliance.daysUntilDue)}` : "Nothing due"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Recent alerts" description="Raised automatically from this organisation's own figures." href={`${basePath}/compliance${fy}`} hrefLabel="Open compliance">
          <AlertList alerts={alerts} />
        </SectionCard>

        <SectionCard title="Upcoming deadlines" href={`${basePath}/compliance${fy}`} hrefLabel="Open compliance">
          {deadlines.length === 0 ? (
            <p className="text-muted-foreground text-sm">No reports are owed right now.</p>
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
        </SectionCard>

        <SectionCard title="Latest report status" href={`${basePath}/reports${fy}`} hrefLabel="Open reports">
          {latestReports.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing has been submitted yet.</p>
          ) : (
            <ul className="divide-y">
              {latestReports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0">
                  <span>
                    {reportLabel(r)}
                    <span className="text-muted-foreground ml-1.5 text-xs">{r.submittedAt ? formatDate(r.submittedAt) : ""}</span>
                  </span>
                  <ReportStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Major performance concerns" description={`KPIs furthest behind their target to date${metrics.asAt ? ` (${metrics.asAt})` : ""}.`} href={`${basePath}/performance${fy}`} hrefLabel="Open performance">
          {concerns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No KPIs are at risk or below target.</p>
          ) : (
            <ul className="divide-y">
              {concerns.map((k) => (
                <li key={k.id} className="space-y-0.5 py-2 text-sm first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">{k.name}</span>
                    <KpiStatusBadge status={k.result?.status ?? null} />
                  </div>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatKpiValue(k.result?.ytdActual, k.unit)} of {formatKpiValue(k.result?.ytdTarget, k.unit)} to date ({formatPercent(k.result?.achievement)}) · variance {k.result ? formatSigned(k.result.variance) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
