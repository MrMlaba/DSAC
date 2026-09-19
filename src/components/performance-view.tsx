import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiTable } from "@/components/kpi-table";
import { PerformanceCaptureForm, type CaptureKpi } from "@/components/performance-capture-form";
import { StatCard } from "@/components/stat-card";
import { PerformanceBandBadge } from "@/components/status-badge";
import { ProportionBar } from "@/components/proportion-bar";
import { canCaptureReportingData } from "@/lib/constants";
import { formatPercent } from "@/lib/format";
import { KPI_STATUS_ORDER, KPI_STATUS_VISUALS } from "@/lib/risk-visuals";
import { editableQuarter } from "@/lib/capture-quarter";
import { now } from "@/lib/clock";
import { PERF_QUARTERS } from "@/lib/calc/performance";
import { getEvidenceIndex } from "@/lib/data/evidence";
import type { CurrentUser } from "@/lib/tenant-scope";
import type { EntityContext } from "@/lib/data/entity-view";

/** The Performance tab — the same view on the DSAC side and in the entity portal. Only the entity can capture. */
export async function PerformanceView({ ctx, user }: { ctx: EntityContext; user: CurrentUser }) {
  const { metrics, entity, selectedFinancialYear } = ctx;
  const { kpis, summary, band } = metrics.performance;
  const evidence = await getEvidenceIndex(user, entity.id, selectedFinancialYear.id);
  const evidenceByKpi = Object.fromEntries([...evidence.byKpi.entries()].map(([id, items]) => [id, items.map((i) => ({ id: i.id, title: i.title }))]));

  const canCapture = canCaptureReportingData(user.role) && user.entityId === entity.id;
  const open = canCapture ? editableQuarter(metrics.compliance.reports, "QUARTERLY_PERFORMANCE", selectedFinancialYear.startDate, now()) : null;

  let captureKpis: CaptureKpi[] = [];
  if (open) {
    const idx = PERF_QUARTERS.indexOf(open.quarter);
    captureKpis = kpis.map((k) => {
      const earlier = PERF_QUARTERS.slice(0, idx);
      const ytdTarget = k.aggregation === "SUM" ? PERF_QUARTERS.slice(0, idx + 1).reduce((sum, q) => sum + (k.quarters[q].target ?? 0), 0) : (k.quarters[open.quarter].target ?? 0);
      return {
        id: k.id,
        name: k.name,
        programme: k.programme,
        unit: k.unit,
        aggregation: k.aggregation,
        periodTarget: k.quarters[open.quarter].target,
        ytdTarget,
        priorActual: earlier.reduce((sum, q) => sum + (k.quarters[q].actual ?? 0), 0),
        actual: k.quarters[open.quarter].actual,
        reason: k.quarters[open.quarter].varianceExplanation ?? "",
        action: k.quarters[open.quarter].correctiveAction ?? "",
      };
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overall performance" value={formatPercent(summary.overall)} hint={`${summary.achieved + summary.onTrack} of ${summary.assessed} KPIs achieved or on track`}>
          <PerformanceBandBadge band={band} />
        </StatCard>
        <Card className="sm:col-span-2 lg:col-span-3">
          <CardHeader className="pb-2">
            <CardDescription>KPI status</CardDescription>
            <CardTitle className="text-base">
              Assessed at {metrics.asAt ?? "—"} · FY {selectedFinancialYear.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProportionBar
              segments={KPI_STATUS_ORDER.map((status) => ({
                key: status,
                label: KPI_STATUS_VISUALS[status].label,
                value: status === "ACHIEVED" ? summary.achieved : status === "ON_TRACK" ? summary.onTrack : status === "AT_RISK" ? summary.atRisk : summary.notAchieved,
                color: KPI_STATUS_VISUALS[status].color,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {canCapture && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{open ? `Report ${open.quarter} performance` : "Capture performance"}</CardTitle>
            <CardDescription>
              {open
                ? "Enter only this quarter's result for each KPI. The system adds it to earlier quarters and calculates year-to-date, variance and achievement."
                : "Every quarter that has started has been submitted, so its figures are locked. The next quarter opens for capture when it begins."}
            </CardDescription>
          </CardHeader>
          {open && (
            <CardContent>
              <PerformanceCaptureForm entityId={entity.id} financialYearId={selectedFinancialYear.id} quarter={open.quarter} kpis={captureKpis} returnedComment={open.report.status === "RETURNED" ? open.report.reviewComment : null} />
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key performance indicators</CardTitle>
          <CardDescription>
            Target to date is cumulative through {metrics.asAt ?? "the first quarter"}. Achievement = actual to date ÷ target to date. Select a KPI for the period figures, reasons, corrective action, evidence and quarterly history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {kpis.length === 0 ? <p className="text-muted-foreground text-sm">No KPIs have been set for this financial year.</p> : <KpiTable kpis={kpis} evidence={evidenceByKpi} asAt={metrics.asAt} attachHrefBase={canCapture ? "/documents?link=kpi:" : undefined} />}
        </CardContent>
      </Card>
    </div>
  );
}
