import type { FinanceQuarter } from "@/lib/calc/finance";

export type ReportKindKey = "QUARTERLY_PERFORMANCE" | "QUARTERLY_FINANCIAL" | "GOVERNANCE_RETURN" | "ANNUAL_REPORT";

const QUARTER_INDEX: Record<FinanceQuarter, number> = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

export function quarterBounds(fyStart: Date, quarter: FinanceQuarter): { start: Date; end: Date } {
  const startMonth = fyStart.getUTCMonth() + QUARTER_INDEX[quarter] * 3;
  const year = fyStart.getUTCFullYear();
  return { start: utcDate(year, startMonth, 1), end: utcDate(year, startMonth + 3, 0) };
}

/**
 * The standard reporting calendar (South African financial year, April–March):
 *  - quarterly performance & financial reports: last day of the month after quarter-end
 *    (Q1 → 31 Jul, Q2 → 31 Oct, Q3 → 31 Jan, Q4 → 30 Apr)
 *  - governance return: the 15th of the second month after quarter-end (Q1 → 15 Aug)
 *  - annual report: 31 Aug after year-end
 */
export function quarterlyReportDueDate(kind: Exclude<ReportKindKey, "ANNUAL_REPORT">, fyStart: Date, quarter: FinanceQuarter): Date {
  const { end } = quarterBounds(fyStart, quarter);
  const year = end.getUTCFullYear();
  const month = end.getUTCMonth();
  if (kind === "GOVERNANCE_RETURN") return utcDate(year, month + 2, 15);
  return utcDate(year, month + 2, 0);
}

export function annualReportDueDate(fyEnd: Date): Date {
  return utcDate(fyEnd.getUTCFullYear(), fyEnd.getUTCMonth() + 6, 0);
}

export const REPORT_KIND_LABELS: Record<ReportKindKey, string> = {
  QUARTERLY_PERFORMANCE: "Quarterly Performance Report",
  QUARTERLY_FINANCIAL: "Quarterly Financial Report",
  GOVERNANCE_RETURN: "Governance Return",
  ANNUAL_REPORT: "Annual Report",
};

export function reportTitle(kind: ReportKindKey, fyLabel: string, quarter?: FinanceQuarter): string {
  return kind === "ANNUAL_REPORT" ? `${REPORT_KIND_LABELS[kind]} FY ${fyLabel}` : `${REPORT_KIND_LABELS[kind]} ${quarter} FY ${fyLabel}`;
}
