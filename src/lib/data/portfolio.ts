import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/current-user";
import { entityIdScopeWhere } from "@/lib/current-user";
import type { EntityType, Sector, RiskBand, KpiStatus, Quarter } from "@prisma/client";
import { KPI_STATUS_ORDER, RISK_BAND_ORDER } from "@/lib/risk-visuals";

export interface PortfolioFilters {
  financialYearId: string;
  quarter?: Quarter;
  sector?: Sector;
  entityType?: EntityType;
  riskBand?: RiskBand;
}

export interface PortfolioEntityRow {
  id: string;
  name: string;
  type: EntityType;
  sector: Sector;
  fundingAllocation: number;
  riskBand: RiskBand;
  riskScore: number | null;
  kpiStatusCounts: Record<KpiStatus, number>;
  totalKpis: number;
  fundAllocated: number;
  fundSpent: number;
  utilisationRate: number | null;
  complianceRate: number | null;
}

export interface PortfolioSummary {
  entityCount: number;
  publicEntityCount: number;
  npoCount: number;
  riskBandCounts: Record<RiskBand, number>;
  kpiStatusCounts: Record<KpiStatus, number>;
  totalKpis: number;
  avgUtilisationRate: number | null;
  avgComplianceRate: number | null;
  totalAllocated: number;
  totalSpent: number;
}

function emptyKpiStatusCounts(): Record<KpiStatus, number> {
  return { NOT_STARTED: 0, IN_PROGRESS: 0, ACHIEVED: 0, DEADLINE_MISSED: 0 };
}

function emptyRiskBandCounts(): Record<RiskBand, number> {
  return { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
}

export async function getPortfolioData(user: CurrentUser, filters: PortfolioFilters) {
  const tenantWhere = entityIdScopeWhere(user);

  const entities = await prisma.entity.findMany({
    where: {
      ...tenantWhere,
      ...(filters.sector ? { sector: filters.sector } : {}),
      ...(filters.entityType ? { type: filters.entityType } : {}),
    },
    include: {
      riskScores: { orderBy: { computedAt: "desc" }, take: 1 },
      kpis: {
        where: { financialYearId: filters.financialYearId },
        select: {
          status: true,
          // Only fetched when a specific quarter is selected, to derive
          // "status as of that reporting period" instead of the KPI's
          // annual rolled-up status.
          performanceReports: filters.quarter
            ? { where: { reportingPeriod: { quarter: filters.quarter } }, select: { status: true } }
            : false,
        },
      },
      fundAllocations: {
        where: { financialYearId: filters.financialYearId },
        include: { expenditures: { select: { amountSpent: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const entityIds = entities.map((e) => e.id);
  const reports = await prisma.performanceReport.findMany({
    where: {
      kpi: { financialYearId: filters.financialYearId, entityId: { in: entityIds } },
      ...(filters.quarter ? { reportingPeriod: { quarter: filters.quarter } } : {}),
    },
    select: { isLate: true, kpi: { select: { entityId: true } } },
  });
  const reportsByEntity = new Map<string, { total: number; onTime: number }>();
  for (const report of reports) {
    const entry = reportsByEntity.get(report.kpi.entityId) ?? { total: 0, onTime: 0 };
    entry.total += 1;
    if (!report.isLate) entry.onTime += 1;
    reportsByEntity.set(report.kpi.entityId, entry);
  }

  let rows: PortfolioEntityRow[] = entities.map((entity) => {
    const risk = entity.riskScores[0];
    const kpiStatusCounts = emptyKpiStatusCounts();
    for (const kpi of entity.kpis) {
      const statusAsOfQuarter = filters.quarter
        ? (kpi.performanceReports || [])[0]?.status ?? "NOT_STARTED"
        : kpi.status;
      kpiStatusCounts[statusAsOfQuarter]++;
    }

    const fundAllocated = entity.fundAllocations.reduce((sum, fa) => sum + fa.amountAllocated.toNumber(), 0);
    const fundSpent = entity.fundAllocations.reduce(
      (sum, fa) => sum + fa.expenditures.reduce((s, e) => s + e.amountSpent.toNumber(), 0),
      0,
    );
    const compliance = reportsByEntity.get(entity.id);

    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      sector: entity.sector,
      fundingAllocation: entity.fundingAllocation.toNumber(),
      riskBand: risk?.band ?? "LOW",
      riskScore: risk?.score ?? null,
      kpiStatusCounts,
      totalKpis: entity.kpis.length,
      fundAllocated,
      fundSpent,
      utilisationRate: fundAllocated > 0 ? fundSpent / fundAllocated : null,
      complianceRate: compliance && compliance.total > 0 ? compliance.onTime / compliance.total : null,
    };
  });

  if (filters.riskBand) {
    rows = rows.filter((r) => r.riskBand === filters.riskBand);
  }

  const summary: PortfolioSummary = {
    entityCount: rows.length,
    publicEntityCount: rows.filter((r) => r.type === "PUBLIC_ENTITY").length,
    npoCount: rows.filter((r) => r.type === "NPO").length,
    riskBandCounts: emptyRiskBandCounts(),
    kpiStatusCounts: emptyKpiStatusCounts(),
    totalKpis: 0,
    avgUtilisationRate: null,
    avgComplianceRate: null,
    totalAllocated: 0,
    totalSpent: 0,
  };

  const utilisationRates: number[] = [];
  const complianceRates: number[] = [];
  for (const row of rows) {
    summary.riskBandCounts[row.riskBand]++;
    for (const status of KPI_STATUS_ORDER) summary.kpiStatusCounts[status] += row.kpiStatusCounts[status];
    summary.totalKpis += row.totalKpis;
    summary.totalAllocated += row.fundAllocated;
    summary.totalSpent += row.fundSpent;
    if (row.utilisationRate !== null) utilisationRates.push(row.utilisationRate);
    if (row.complianceRate !== null) complianceRates.push(row.complianceRate);
  }
  summary.avgUtilisationRate = utilisationRates.length
    ? utilisationRates.reduce((a, b) => a + b, 0) / utilisationRates.length
    : null;
  summary.avgComplianceRate = complianceRates.length
    ? complianceRates.reduce((a, b) => a + b, 0) / complianceRates.length
    : null;

  return { rows, summary };
}

export { RISK_BAND_ORDER };
