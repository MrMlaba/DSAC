import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiskBadge } from "@/components/risk-badge";
import { KpiExplorer } from "@/components/kpi-explorer";
import { FinanceChart } from "@/components/finance-chart";
import { JobCreationChart } from "@/components/job-creation-chart";
import { AuditHistory } from "@/components/audit-history";
import { CategoryBars } from "@/components/category-bars";
import { EntityFinancialYearSelect } from "@/components/entity-financial-year-select";
import { TeamMembersList } from "@/components/team-members-list";
import { CommentsFeed } from "@/components/comments-feed";
import { DeadlineList } from "@/components/deadline-list";
import { requireUser } from "@/lib/current-user";
import { getEntityDetail } from "@/lib/data/entity-detail";
import { listTeamMembers, listComments } from "@/lib/data/comments";
import { listDeadlinesForEntity } from "@/lib/data/deadlines";
import { isReadOnlyRole, SECTOR_LABELS, ENTITY_TYPE_LABELS, GENDER_LABELS, RACE_LABELS, AGE_BAND_LABELS, DISABILITY_LABELS } from "@/lib/constants";
import { KPI_STATUS_LABELS, KPI_STATUS_COLORS } from "@/lib/risk-visuals";

export default async function EntityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const fyParam = typeof resolvedSearchParams.fy === "string" ? resolvedSearchParams.fy : undefined;

  let detail;
  try {
    detail = await getEntityDetail(user, id, fyParam);
  } catch {
    notFound();
  }

  const { entity, risk, financialYears, selectedFinancialYear, kpisForYear, kpiYoY, finance, auditHistory, workforceStats, jobCreationByYear } =
    detail;

  const [teamMembers, comments, deadlines] = await Promise.all([
    listTeamMembers(user, id),
    listComments(user, { entityId: id }),
    listDeadlinesForEntity(user, id),
  ]);

  const genderTotals = new Map<string, number>();
  const raceTotals = new Map<string, number>();
  const ageBandTotals = new Map<string, number>();
  const disabilityTotals = new Map<string, number>();
  for (const w of workforceStats) {
    genderTotals.set(w.gender, (genderTotals.get(w.gender) ?? 0) + w.headcount);
    raceTotals.set(w.raceCategory, (raceTotals.get(w.raceCategory) ?? 0) + w.headcount);
    ageBandTotals.set(w.ageBand, (ageBandTotals.get(w.ageBand) ?? 0) + w.headcount);
    disabilityTotals.set(w.disabilityStatus, (disabilityTotals.get(w.disabilityStatus) ?? 0) + w.headcount);
  }
  const totalHeadcount = [...genderTotals.values()].reduce((a, b) => a + b, 0);
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const toBars = (totals: Map<string, number>, labels: Record<string, string>) =>
    [...totals.entries()].map(([key, value], i) => ({ label: labels[key] ?? key, value, color: palette[i % palette.length] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{entity.name}</h1>
            {risk && <RiskBadge band={risk.band} score={risk.score} />}
          </div>
          <p className="text-muted-foreground text-sm">
            {SECTOR_LABELS[entity.sector]} · {ENTITY_TYPE_LABELS[entity.type]} · Funding allocation R
            {entity.fundingAllocation.toLocaleString()}
          </p>
          {entity.description && <p className="text-muted-foreground max-w-2xl text-sm">{entity.description}</p>}
        </div>
        <EntityFinancialYearSelect financialYears={financialYears} />
      </div>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">KPI progress — FY {selectedFinancialYear.label}</CardTitle>
          <CardDescription>Actual vs. annual target for every KPI tracked this year.</CardDescription>
        </CardHeader>
        <CardContent>
          {kpisForYear.length === 0 ? (
            <p className="text-muted-foreground text-sm">No KPIs recorded for this financial year.</p>
          ) : (
            <div className="divide-y">
              {kpisForYear.map((kpi) => {
                const progress = kpi.annualTarget !== 0 && kpi.latestActual !== null ? (kpi.latestActual / kpi.annualTarget) * 100 : 0;
                return (
                  <div key={kpi.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{kpi.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {kpi.category} · target {kpi.annualTarget.toLocaleString()} {kpi.unit}
                      </p>
                      <Progress value={Math.min(100, Math.max(0, progress))} className="mt-1.5" />
                    </div>
                    <Badge
                      variant="outline"
                      className="w-fit shrink-0 text-xs"
                      style={{ color: KPI_STATUS_COLORS[kpi.status], borderColor: "color-mix(in oklch, currentColor 40%, transparent)" }}
                    >
                      {KPI_STATUS_LABELS[kpi.status]}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">KPI explorer</CardTitle>
          <CardDescription>Quarterly milestones this year, or a 3-year target vs. actual trend.</CardDescription>
        </CardHeader>
        <CardContent>
          <KpiExplorer kpisForYear={kpisForYear} kpiYoY={kpiYoY} selectedFyLabel={selectedFinancialYear.label} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fund utilisation</CardTitle>
            <CardDescription>Allocated vs. spent, by financial year.</CardDescription>
          </CardHeader>
          <CardContent>
            <FinanceChart finance={finance} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jobs created</CardTitle>
            <CardDescription>Permanent, temporary and youth jobs, by financial year.</CardDescription>
          </CardHeader>
          <CardContent>
            <JobCreationChart jobCreationByYear={jobCreationByYear} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit findings & opinion history</CardTitle>
          <CardDescription>Across all financial years on record.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditHistory auditHistory={auditHistory} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff demographics</CardTitle>
          <CardDescription>
            Aggregated headcount only, FY {selectedFinancialYear.label} — {totalHeadcount} staff. No individual employee
            records are stored, per POPIA data-minimisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalHeadcount === 0 ? (
            <p className="text-muted-foreground text-sm">No workforce data recorded for this financial year.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Gender</p>
                <CategoryBars items={toBars(genderTotals, GENDER_LABELS)} />
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Race</p>
                <CategoryBars items={toBars(raceTotals, RACE_LABELS)} />
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Age band</p>
                <CategoryBars items={toBars(ageBandTotals, AGE_BAND_LABELS)} />
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Disability status</p>
                <CategoryBars items={toBars(disabilityTotals, DISABILITY_LABELS)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="workspace" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comments</CardTitle>
                  <CardDescription>Entity-wide discussion — visible to everyone with access to this entity.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CommentsFeed
                    entityId={id}
                    anchor={{}}
                    initialComments={comments.map((c) => ({
                      ...c,
                      createdAt: c.createdAt.toISOString(),
                      replies: c.replies.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), replies: [] })),
                    }))}
                    teamMembers={teamMembers}
                    currentUserId={user.id}
                    canComment={!isReadOnlyRole(user.role)}
                  />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Team</CardTitle>
                </CardHeader>
                <CardContent>
                  <TeamMembersList members={teamMembers} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Deadlines</CardTitle>
                  <CardDescription>
                    See <Link href="/tasks" className="underline underline-offset-2">Tasks</Link> for the kanban board.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DeadlineList deadlines={deadlines} dsacWide={false} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
