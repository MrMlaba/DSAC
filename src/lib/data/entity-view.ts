import { prisma } from "@/lib/prisma";
import { assertEntityAccess, type CurrentUser } from "@/lib/tenant-scope";
import { computeEntityMetrics } from "@/lib/data/metrics";
import { resolveFinancialYear } from "@/lib/data/financial-years";
import { buildEntityAlerts } from "@/lib/alerts";

/** Light-weight header data (name, type, risk) — enough for the entity layout without computing metrics. */
export async function getEntityHeader(user: CurrentUser, entityId: string) {
  assertEntityAccess(user, entityId);
  const entity = await prisma.entity.findUniqueOrThrow({
    where: { id: entityId },
    select: { id: true, name: true, type: true, sector: true, description: true, riskScores: { orderBy: { computedAt: "desc" }, take: 1, select: { band: true, score: true } } },
  });
  return { ...entity, risk: entity.riskScores[0] ?? null };
}

/**
 * Everything a tab needs for one entity and one financial year. Every tab — on the DSAC side and in
 * the entity's own portal — loads this same object, which is what keeps their numbers identical.
 */
export async function getEntityContext(user: CurrentUser, entityId: string, fyParam?: string | string[]) {
  assertEntityAccess(user, entityId);
  const { financialYears, selected } = await resolveFinancialYear(fyParam);

  const [entity, metricsMap] = await Promise.all([
    prisma.entity.findUniqueOrThrow({
      where: { id: entityId },
      include: { riskScores: { orderBy: { computedAt: "desc" }, take: 1 } },
    }),
    computeEntityMetrics({ financialYearId: selected.id, entityIds: [entityId] }),
  ]);
  const metrics = metricsMap.get(entityId)!;

  return {
    entity,
    risk: entity.riskScores[0] ?? null,
    financialYears,
    selectedFinancialYear: selected,
    metrics,
    alerts: buildEntityAlerts(metrics),
  };
}

export type EntityContext = Awaited<ReturnType<typeof getEntityContext>>;
