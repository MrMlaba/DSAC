import { prisma } from "@/lib/prisma";
import { entityIdScopeWhere, type CurrentUser } from "@/lib/tenant-scope";
import type { RiskBand } from "@prisma/client";

export interface RiskFactorView {
  key: string;
  label: string;
  contribution: number;
  detail: string;
}

export interface EntityRiskView {
  entityId: string;
  entityName: string;
  score: number;
  band: RiskBand;
  computedAt: Date;
  factors: RiskFactorView[];
  probabilityMissTarget: number;
  probabilityLateSubmission: number;
}

/** The JSON shape src/lib/risk-engine.ts writes into RiskScore.factors — self-controlled, so this cast is safe. */
interface StoredRiskFactors {
  factors: RiskFactorView[];
  probabilityMissTarget: number;
  probabilityLateSubmission: number;
}

export async function listEntityRisk(user: CurrentUser): Promise<EntityRiskView[]> {
  const entities = await prisma.entity.findMany({
    where: entityIdScopeWhere(user),
    select: {
      id: true,
      name: true,
      riskScores: { orderBy: { computedAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  return entities
    .filter((e) => e.riskScores.length > 0)
    .map((e) => {
      const rs = e.riskScores[0];
      const stored = rs.factors as unknown as StoredRiskFactors;
      return {
        entityId: e.id,
        entityName: e.name,
        score: rs.score,
        band: rs.band,
        computedAt: rs.computedAt,
        factors: stored?.factors ?? [],
        probabilityMissTarget: stored?.probabilityMissTarget ?? 0,
        probabilityLateSubmission: stored?.probabilityLateSubmission ?? 0,
      };
    })
    .sort((a, b) => b.score - a.score);
}
