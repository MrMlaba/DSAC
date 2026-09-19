import { ENTITY_COMPLIANCE_LABELS, ENTITY_TYPE_LABELS, PERFORMANCE_BAND_LABELS, SECTOR_LABELS } from "@/lib/constants";
import type { PortfolioRow } from "@/lib/data/portfolio";

/** Plain, serialisable rows for the Excel and PDF exports — built from the same portfolio figures as the dashboard. */
export interface ExportRow {
  name: string;
  type: string;
  sector: string;
  compliance: string;
  complianceRate: number | null;
  performance: string;
  overallPerformance: number | null;
  approved: number;
  disbursed: number;
  utilised: number;
  budgetUtilisation: number | null;
  fundUtilisation: number | null;
  reportsSubmitted: number;
  reportsOutstanding: number;
}

export function toExportRows(rows: PortfolioRow[]): ExportRow[] {
  return rows.map((r) => ({
    name: r.name,
    type: ENTITY_TYPE_LABELS[r.type],
    sector: SECTOR_LABELS[r.sector],
    compliance: ENTITY_COMPLIANCE_LABELS[r.metrics.compliance.summary.status],
    complianceRate: r.metrics.compliance.summary.rate,
    performance: PERFORMANCE_BAND_LABELS[r.metrics.performance.band],
    overallPerformance: r.metrics.performance.summary.overall,
    approved: r.metrics.finance.summary.approved,
    disbursed: r.metrics.finance.summary.disbursed,
    utilised: r.metrics.finance.summary.utilised,
    budgetUtilisation: r.metrics.finance.summary.budgetUtilisation,
    fundUtilisation: r.metrics.finance.summary.fundUtilisation,
    reportsSubmitted: r.metrics.compliance.summary.submitted,
    reportsOutstanding: r.metrics.compliance.summary.outstanding,
  }));
}
