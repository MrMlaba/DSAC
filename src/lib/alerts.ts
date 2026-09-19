import { REPORT_KIND_LABELS } from "@/lib/reporting-calendar";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { formatPercent, formatRand } from "@/lib/format";
import type { EntityFyMetrics, ReportRow } from "@/lib/data/metrics";

export type AlertSeverity = "critical" | "warning" | "info";

export interface EntityAlert {
  severity: AlertSeverity;
  message: string;
  /** Where to act on it, relative to the viewer's own navigation. */
  area: "compliance" | "performance" | "finance" | "reports";
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function reportLabel(report: ReportRow): string {
  const base = REPORT_KIND_LABELS[report.kind];
  return report.quarter === "ANNUAL" ? base : `${base} ${report.quarter}`;
}

/**
 * Turns an entity's metrics into plain-language alerts (the wording follows the spec's examples).
 * Derived on demand from the same figures shown in the tabs, so an alert can never contradict them.
 */
export function buildEntityAlerts(metrics: EntityFyMetrics): EntityAlert[] {
  const alerts: EntityAlert[] = [];

  for (const report of metrics.compliance.reports) {
    const { state, daysUntilDue } = report.compliance;
    if (state === "OVERDUE") {
      alerts.push({ severity: "critical", area: "compliance", message: `${reportLabel(report)} is overdue by ${plural(-daysUntilDue, "day")}.` });
    } else if (state === "RETURNED") {
      alerts.push({ severity: "warning", area: "reports", message: `DSAC has returned your ${reportLabel(report)} for correction.` });
    } else if (state === "DUE_SOON") {
      alerts.push({ severity: "warning", area: "compliance", message: daysUntilDue === 0 ? `${reportLabel(report)} is due today.` : `${reportLabel(report)} due in ${plural(daysUntilDue, "day")}.` });
    }
  }

  for (const line of metrics.finance.lines) {
    if (line.overspent) {
      alerts.push({
        severity: "critical",
        area: "finance",
        message: `${EXPENSE_CATEGORY_LABELS[line.category as keyof typeof EXPENSE_CATEGORY_LABELS]} is overspent by ${formatRand(-line.remaining)} (${formatPercent(line.utilisation)} of its approved budget).`,
      });
    }
  }

  const perf = metrics.performance.summary;
  if (perf.notAchieved > 0) alerts.push({ severity: "critical", area: "performance", message: `${plural(perf.notAchieved, "KPI")} not achieved against year-to-date targets.` });
  if (perf.atRisk > 0) alerts.push({ severity: "warning", area: "performance", message: `${plural(perf.atRisk, "KPI")} at risk of missing target.` });

  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
