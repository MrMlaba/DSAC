import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { requireDsacUser } from "@/lib/portal";
import { canReviewReports } from "@/lib/constants";
import { resolveFinancialYear } from "@/lib/data/financial-years";
import { getPortfolio } from "@/lib/data/portfolio";
import { listEntityRisk } from "@/lib/data/risk";
import { listInAppNotifications } from "@/lib/data/notifications";
import { buildEntityAlerts } from "@/lib/alerts";
import { COMPLIANCE_COLOURS } from "@/lib/risk-visuals";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { RiskExplainCard } from "@/components/risk-explain-card";
import { RecalculateRiskButton } from "@/components/recalculate-risk-button";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireDsacUser();
  const params = await searchParams;
  const { financialYears, selected } = await resolveFinancialYear(params.fy);
  const [{ rows }, riskList, notifications] = await Promise.all([getPortfolio(user, selected.id), listEntityRisk(user), listInAppNotifications(user)]);

  const flagged = rows
    .map((row) => ({ row, alerts: buildEntityAlerts(row.metrics).filter((a) => a.severity !== "info") }))
    .filter((x) => x.alerts.length > 0)
    .sort((a, b) => b.alerts.filter((x) => x.severity === "critical").length - a.alerts.filter((x) => x.severity === "critical").length || b.alerts.length - a.alerts.length);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description={`Which organisations need intervention, and why — raised automatically from their own submitted figures. FY ${selected.label}.`}
        financialYears={financialYears}
        selectedFinancialYearId={selected.id}
        actions={canReviewReports(user.role) ? <RecalculateRiskButton /> : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Needs attention</h2>
          {flagged.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="text-muted-foreground py-8 text-center text-sm">No organisation has an open alert.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="divide-y py-1">
                {flagged.slice(0, 12).map(({ row, alerts }) => (
                  <div key={row.id} className="space-y-1.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/entities/${row.id}?fy=${selected.id}`} className="text-sm font-medium hover:underline">
                        {row.name}
                      </Link>
                      <Link href={`/entities/${row.id}/compliance?fy=${selected.id}`} className="text-primary inline-flex items-center gap-1 text-xs hover:underline">
                        Open <ArrowRightIcon className="size-3" />
                      </Link>
                    </div>
                    <ul className="space-y-1">
                      {alerts.slice(0, 3).map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: a.severity === "critical" ? COMPLIANCE_COLOURS.red : COMPLIANCE_COLOURS.amber }} />
                          {a.message}
                        </li>
                      ))}
                      {alerts.length > 3 && <li className="text-muted-foreground pl-4 text-xs">+{alerts.length - 3} more</li>}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {flagged.length > 12 && <p className="text-muted-foreground text-xs">Showing 12 of {flagged.length} organisations with alerts.</p>}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Early warning</h2>
          {riskList.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="text-muted-foreground py-8 text-center text-sm">No risk score computed yet.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-1">
                <Accordion defaultValue={[riskList[0]?.entityId]}>
                  {riskList.slice(0, 10).map((risk) => (
                    <RiskExplainCard key={risk.entityId} risk={risk} showName />
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
          <p className="text-muted-foreground text-xs">Scores are explainable: every point comes from a named factor, and they are built from the same figures as the dashboards.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent notifications</CardTitle>
          <CardDescription>What was sent to you — submissions received, deadlines missed, requests raised.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-muted-foreground text-sm">No notifications yet.</p>
          ) : (
            <ul className="divide-y">
              {notifications.slice(0, 10).map((n) => (
                <li key={n.id} className="py-2 text-sm first:pt-0">
                  <p className="flex items-start justify-between gap-3">
                    <span className={n.read ? "text-muted-foreground" : "font-medium"}>{n.title}</span>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(n.createdAt)}</span>
                  </p>
                  <p className="text-muted-foreground text-xs">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
