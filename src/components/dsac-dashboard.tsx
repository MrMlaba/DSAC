import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { FinanceFlow } from "@/components/finance-flow";
import { ProportionBar, MagnitudeBar } from "@/components/proportion-bar";
import { PageHeader } from "@/components/page-header";
import { ExportButtons } from "@/components/export-buttons";
import { AskTheData } from "@/components/ask-the-data";
import { EntityComplianceBadge, PerformanceBandBadge } from "@/components/status-badge";
import { RiskBadge } from "@/components/risk-badge";
import { ENTITY_COMPLIANCE_VISUALS, KPI_STATUS_ORDER, KPI_STATUS_VISUALS, PERFORMANCE_BAND_VISUALS } from "@/lib/risk-visuals";
import { formatPercent, formatRand, formatRandCompact } from "@/lib/format";
import { getPortfolio, type PortfolioRow } from "@/lib/data/portfolio";
import { toExportRows } from "@/lib/data/export-rows";
import type { CurrentUser } from "@/lib/tenant-scope";

/** Higher = needs DSAC's attention sooner. Built only from figures already shown on the dashboard. */
function attentionScore(row: PortfolioRow): number {
  const compliance = row.metrics.compliance.summary.status;
  const band = row.metrics.performance.band;
  return (compliance === "OVERDUE_REPORTING" ? 200 : compliance === "ATTENTION_REQUIRED" ? 80 : 0) + (band === "UNDER_TARGET" ? 100 : band === "AT_RISK" ? 40 : 0) + (row.riskScore ?? 0);
}

export async function DsacDashboard({
  user,
  financialYears,
  selected,
}: {
  user: CurrentUser;
  financialYears: { id: string; label: string }[];
  selected: { id: string; label: string };
}) {
  const { rows, summary } = await getPortfolio(user, selected.id);
  const { finance, performance, compliance } = summary;

  const needsIntervention = rows
    .filter((r) => r.metrics.compliance.summary.status !== "COMPLIANT" || r.metrics.performance.band === "UNDER_TARGET")
    .sort((a, b) => attentionScore(b) - attentionScore(a));
  const fy = `?fy=${selected.id}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolio overview"
        description={`How every public entity and NPO is performing — financially and operationally — and where DSAC needs to intervene. FY ${selected.label}.`}
        financialYears={financialYears}
        selectedFinancialYearId={selected.id}
        actions={<ExportButtons rows={toExportRows(rows)} financialYearId={selected.id} financialYearLabel={selected.label} />}
      />

      <section aria-labelledby="portfolio-heading" className="space-y-3">
        <h2 id="portfolio-heading" className="text-lg font-semibold tracking-tight">
          Portfolio
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total public entities" value={summary.publicEntityCount} />
          <StatCard label="Total NPOs" value={summary.npoCount} />
          <StatCard label="Total organisations monitored" value={summary.entityCount} />
          <StatCard label="Overall KPI performance" value={formatPercent(performance.overall)} hint={`${performance.achieved + performance.onTrack} of ${performance.assessed} KPIs achieved or on track`}>
            <MagnitudeBar value={performance.overall ?? 0} color="var(--chart-1)" />
          </StatCard>
          <StatCard label="Reports submitted" value={compliance.submitted} hint={`of ${compliance.total} required this year`} />
          <StatCard label="Reports outstanding" value={compliance.outstanding} hint="Past due and still to be submitted or corrected" />
          <StatCard label="Overall compliance rate" value={formatPercent(compliance.rate)} hint={`${compliance.compliant} of ${compliance.assessed} reports assessed were delivered on time`}>
            <MagnitudeBar value={compliance.rate ?? 0} color="var(--status-good)" />
          </StatCard>
          <StatCard label="Reports not yet due" value={compliance.notYetDue} hint="Nothing owed yet" />
        </div>
      </section>

      <section aria-labelledby="finance-heading" className="space-y-3">
        <h2 id="finance-heading" className="text-lg font-semibold tracking-tight">
          Financial position
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total approved budget" value={formatRandCompact(finance.approved)} exact={formatRand(finance.approved)} hint={`Across ${summary.entityCount} organisations`} />
          <StatCard label="Total disbursed to date" value={formatRandCompact(finance.disbursed)} exact={formatRand(finance.disbursed)} hint={`${formatPercent(finance.disbursementRate)} of approved budget`} />
          <StatCard label="Total utilised to date" value={formatRandCompact(finance.utilised)} exact={formatRand(finance.utilised)} hint="Reported expenditure, cumulative" />
          <StatCard label="Overall utilisation" value={formatPercent(finance.fundUtilisation)} hint={`Utilised ÷ disbursed · ${formatPercent(finance.budgetUtilisation)} of approved budget`}>
            <MagnitudeBar value={finance.fundUtilisation ?? 0} color="var(--chart-2)" />
          </StatCard>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approved → Disbursed → Utilised</CardTitle>
            <CardDescription>All three drawn to the same scale. Updates as entities report their quarterly expenditure.</CardDescription>
          </CardHeader>
          <CardContent>
            <FinanceFlow summary={finance} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="intervene-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="intervene-heading" className="text-lg font-semibold tracking-tight">
              Where DSAC needs to intervene
            </h2>
            <p className="text-muted-foreground text-sm">Organisations with overdue or returned reporting, or performance under target — most pressing first.</p>
          </div>
          <Link href={`/entities${fy}`} className="text-primary inline-flex items-center gap-1 text-sm hover:underline">
            All entities &amp; NPOs <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
        <Card>
          <CardContent className="pt-4">
            {needsIntervention.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Every organisation is compliant and on track.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead className="text-right">Budget utilisation</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needsIntervention.slice(0, 8).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <Link href={`/entities/${row.id}${fy}`} className="hover:underline">
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <EntityComplianceBadge status={row.metrics.compliance.summary.status} />
                      </TableCell>
                      <TableCell>
                        <PerformanceBandBadge band={row.metrics.performance.band} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(row.metrics.finance.summary.budgetUtilisation)}</TableCell>
                      <TableCell>{row.riskBand ? <RiskBadge band={row.riskBand} score={row.riskScore} /> : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {needsIntervention.length > 8 && <p className="text-muted-foreground mt-3 text-xs">Showing 8 of {needsIntervention.length}.</p>}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Portfolio distribution" className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KPI status</CardTitle>
            <CardDescription>{performance.assessed} KPIs across the portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <ProportionBar
              segments={KPI_STATUS_ORDER.map((status) => ({
                key: status,
                label: KPI_STATUS_VISUALS[status].label,
                value: status === "ACHIEVED" ? performance.achieved : status === "ON_TRACK" ? performance.onTrack : status === "AT_RISK" ? performance.atRisk : performance.notAchieved,
                color: KPI_STATUS_VISUALS[status].color,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organisations by performance</CardTitle>
            <CardDescription>Overall performance band per organisation</CardDescription>
          </CardHeader>
          <CardContent>
            <ProportionBar
              segments={(["ON_TRACK", "AT_RISK", "UNDER_TARGET", "NO_DATA"] as const).map((band) => ({
                key: band,
                label: PERFORMANCE_BAND_VISUALS[band].label,
                value: summary.performanceBands[band],
                color: PERFORMANCE_BAND_VISUALS[band].color,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organisations by compliance</CardTitle>
            <CardDescription>Green · amber · red across the portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <ProportionBar
              segments={(["COMPLIANT", "ATTENTION_REQUIRED", "OVERDUE_REPORTING"] as const).map((status) => ({
                key: status,
                label: ENTITY_COMPLIANCE_VISUALS[status].label,
                value: summary.complianceStatuses[status],
                color: ENTITY_COMPLIANCE_VISUALS[status].color,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <AskTheData />
    </div>
  );
}
