import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isDsacWideRole, ROLE_LABELS } from "@/lib/constants";
import { entityIdScopeWhere, requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import type { RiskBand } from "@prisma/client";

const RISK_BAND_STYLES: Record<RiskBand, string> = {
  LOW: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const RISK_BANDS: RiskBand[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default async function DashboardPage() {
  const user = await requireUser();
  const where = entityIdScopeWhere(user);
  const dsacWide = isDsacWideRole(user.role);

  const entities = await prisma.entity.findMany({
    where,
    include: { riskScores: { orderBy: { computedAt: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  const peCount = entities.filter((e) => e.type === "PUBLIC_ENTITY").length;
  const npoCount = entities.filter((e) => e.type === "NPO").length;
  const bandCounts = entities.reduce<Record<string, number>>((acc, e) => {
    const band = e.riskScores[0]?.band ?? "LOW";
    acc[band] = (acc[band] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dsacWide ? "DSAC Portfolio Overview" : "Entity Overview"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {user.name} — {ROLE_LABELS[user.role]}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{dsacWide ? "Entities tracked" : "Your entity"}</CardDescription>
            <CardTitle className="text-3xl">{entities.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">
            {peCount} public entities · {npoCount} NPOs
          </CardContent>
        </Card>
        {RISK_BANDS.map((band) => (
          <Card key={band}>
            <CardHeader className="pb-2">
              <CardDescription>{band[0]}{band.slice(1).toLowerCase()} risk</CardDescription>
              <CardTitle className="text-3xl">{bandCounts[band] ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={RISK_BAND_STYLES[band]} variant="secondary">
                {band === "LOW" || band === "MEDIUM" ? "On track" : "Needs attention"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entities</CardTitle>
          <CardDescription>
            The full Analytics Module (trends, KPI drill-down, exports) lands in Phase 2 — this list is
            a data-pipeline smoke test confirming auth, tenant scoping and seed data all work together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {entities.map((entity) => {
              const risk = entity.riskScores[0];
              return (
                <div key={entity.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entity.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {entity.sector.replaceAll("_", " ")} · {entity.type === "PUBLIC_ENTITY" ? "Public Entity" : "NPO"}
                    </p>
                  </div>
                  {risk && (
                    <Badge className={`${RISK_BAND_STYLES[risk.band]} shrink-0`} variant="secondary">
                      {risk.band} · {risk.score}
                    </Badge>
                  )}
                </div>
              );
            })}
            {entities.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">No entities in scope yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
