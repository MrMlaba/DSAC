import { quarterBounds } from "@/lib/reporting-calendar";
import type { ReportRow } from "@/lib/data/metrics";
import type { PerfQuarter } from "@/lib/calc/performance";
import type { ReportKind } from "@prisma/client";

/**
 * The quarter an entity should be capturing data for: the earliest one that has started and whose
 * report is still editable (Draft, or Returned for correction). Null when everything that has
 * started has already been submitted.
 */
export function editableQuarter(reports: ReportRow[], kind: ReportKind, fyStart: Date, today: Date): { quarter: PerfQuarter; report: ReportRow } | null {
  const candidates = reports
    .filter((r) => r.kind === kind && r.quarter !== "ANNUAL" && (r.status === "DRAFT" || r.status === "RETURNED"))
    .filter((r) => quarterBounds(fyStart, r.quarter as PerfQuarter).start <= today)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const first = candidates[0];
  return first ? { quarter: first.quarter as PerfQuarter, report: first } : null;
}
