import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isDsacWideRole, ROLE_LABELS } from "@/lib/constants";
import { requireUser } from "@/lib/current-user";
import { getPortfolioData } from "@/lib/data/portfolio";
import { resolvePortfolioFilters } from "@/lib/data/portfolio-filters";
import { KPI_STATUS_COLORS, KPI_STATUS_LABELS, KPI_STATUS_ORDER, RISK_BAND_ORDER, RISK_BAND_VISUALS } from "@/lib/risk-visuals";
import { ProportionBar, MagnitudeBar } from "@/components/proportion-bar";
import { PortfolioFilters } from "@/components/portfolio-filters";
import { EntityCard } from "@/components/entity-card";
import { ExportButtons } from "@/components/export-buttons";
import { AskTheData } from "@/components/ask-the-data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const dsacWide = isDsacWideRole(user.role);
  const resolvedSearchParams = await searchParams;
  const { filters, financialYears, financialYearLabel } = await resolvePortfolioFilters(resolvedSearchParams);
  const { rows, summary } = await getPortfolioData(user, filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dsacWide ? "DSAC Portfolio Overview" : "Entity Overview"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {user.name} — {ROLE_LABELS[user.role]} · FY {financialYearLabel}
          </p>
        </div>
        <ExportButtons rows={rows} financialYearLabel={financialYearLabel} />
      </div>

      <PortfolioFilters financialYears={financialYears} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{dsacWide ? "Entities in scope" : "Your entity"}</CardDescription>
            <CardTitle className="text-3xl">{summary.entityCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {summary.publicEntityCount} public entities · {summary.npoCount} NPOs
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fund utilisation</CardDescription>
            <CardTitle className="text-3xl">
              {summary.avgUtilisationRate !== null ? `${Math.round(summary.avgUtilisationRate * 100)}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MagnitudeBar value={summary.avgUtilisationRate ?? 0} color="var(--chart-1)" />
            <p className="text-muted-foreground mt-1.5 text-xs">Average across entities in scope</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Submission compliance</CardDescription>
            <CardTitle className="text-3xl">
              {summary.avgComplianceRate !== null ? `${Math.round(summary.avgComplianceRate * 100)}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MagnitudeBar value={summary.avgComplianceRate ?? 0} color="var(--status-good)" />
            <p className="text-muted-foreground mt-1.5 text-xs">Reports submitted on time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>KPIs tracked</CardDescription>
            <CardTitle className="text-3xl">{summary.totalKpis}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {summary.kpiStatusCounts.ACHIEVED} achieved · {summary.kpiStatusCounts.DEADLINE_MISSED} deadline missed
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Target status</CardTitle>
            <CardDescription>All KPIs across entities in scope, FY {financialYearLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProportionBar
              segments={KPI_STATUS_ORDER.map((status) => ({
                key: status,
                label: KPI_STATUS_LABELS[status],
                value: summary.kpiStatusCounts[status],
                color: KPI_STATUS_COLORS[status],
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk distribution</CardTitle>
            <CardDescription>Entities in scope by early-warning risk band</CardDescription>
          </CardHeader>
          <CardContent>
            <ProportionBar
              segments={RISK_BAND_ORDER.map((band) => ({
                key: band,
                label: RISK_BAND_VISUALS[band].label,
                value: summary.riskBandCounts[band],
                color: RISK_BAND_VISUALS[band].color,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <AskTheData />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Entities</h2>
          <Badge variant="outline" className="text-xs">
            {rows.length} shown
          </Badge>
        </div>
        {rows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              No entities match the current filters.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((entity) => (
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
