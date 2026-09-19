import { prisma } from "@/lib/prisma";
import { entityIdScopeWhere, type CurrentUser } from "@/lib/tenant-scope";
import { computeEntityMetrics, type EntityFyMetrics } from "@/lib/data/metrics";
import { combineFinance, type FinanceSummary } from "@/lib/calc/finance";
import { combinePerformance, type PerformanceBand, type PerformanceSummary } from "@/lib/calc/performance";
import { combineCompliance, type ComplianceSummary, type EntityComplianceStatus } from "@/lib/calc/compliance";
import type { EntityType, RiskBand, Sector } from "@prisma/client";

export interface PortfolioRow {
  id: string;
  name: string;
  type: EntityType;
  sector: Sector;
  riskBand: RiskBand | null;
  riskScore: number | null;
  metrics: EntityFyMetrics;
}

export interface PortfolioSummary {
  entityCount: number;
  publicEntityCount: number;
  npoCount: number;
  finance: FinanceSummary;
  performance: PerformanceSummary;
  compliance: ComplianceSummary;
  performanceBands: Record<PerformanceBand, number>;
  complianceStatuses: Record<EntityComplianceStatus, number>;
  riskBands: Record<RiskBand, number>;
}

/**
 * The portfolio is nothing more than the entity metrics pooled together: raw amounts and KPI/report
 * counts are summed across entities first and ratios derived last, so every portfolio figure equals
 * the sum of the entity pages behind it.
 */
export async function getPortfolio(user: CurrentUser, financialYearId: string): Promise<{ rows: PortfolioRow[]; summary: PortfolioSummary }> {
  const entities = await prisma.entity.findMany({
    where: entityIdScopeWhere(user),
    select: { id: true, name: true, type: true, sector: true, riskScores: { orderBy: { computedAt: "desc" }, take: 1, select: { band: true, score: true } } },
    orderBy: { name: "asc" },
  });

  const metrics = await computeEntityMetrics({ financialYearId, entityIds: entities.map((e) => e.id) });

  const rows: PortfolioRow[] = entities.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    sector: e.sector,
    riskBand: e.riskScores[0]?.band ?? null,
    riskScore: e.riskScores[0]?.score ?? null,
    metrics: metrics.get(e.id)!,
  }));

  const performanceBands: Record<PerformanceBand, number> = { ON_TRACK: 0, AT_RISK: 0, UNDER_TARGET: 0, NO_DATA: 0 };
  const complianceStatuses: Record<EntityComplianceStatus, number> = { COMPLIANT: 0, ATTENTION_REQUIRED: 0, OVERDUE_REPORTING: 0 };
  const riskBands: Record<RiskBand, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const row of rows) {
    performanceBands[row.metrics.performance.band]++;
    complianceStatuses[row.metrics.compliance.summary.status]++;
    if (row.riskBand) riskBands[row.riskBand]++;
  }

  return {
    rows,
    summary: {
      entityCount: rows.length,
      publicEntityCount: rows.filter((r) => r.type === "PUBLIC_ENTITY").length,
      npoCount: rows.filter((r) => r.type === "NPO").length,
      finance: combineFinance(rows.map((r) => r.metrics.finance.summary)),
      performance: combinePerformance(rows.map((r) => r.metrics.performance.summary)),
      compliance: combineCompliance(rows.map((r) => r.metrics.compliance.summary)),
      performanceBands,
      complianceStatuses,
      riskBands,
    },
  };
}
