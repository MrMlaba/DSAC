import { CheckCircle2Icon, TriangleAlertIcon, OctagonAlertIcon, OctagonXIcon } from "lucide-react";
import type { RiskBand, AuditSeverity, KpiStatus } from "@prisma/client";

/**
 * Status colors (good/warning/serious/critical) are reserved for
 * risk/severity states and never reused as categorical series colors.
 * Always paired with an icon + label — never color alone.
 */
export const RISK_BAND_VISUALS: Record<RiskBand, { label: string; color: string; icon: typeof CheckCircle2Icon }> = {
  LOW: { label: "Low risk", color: "var(--status-good)", icon: CheckCircle2Icon },
  MEDIUM: { label: "Medium risk", color: "var(--status-warning)", icon: TriangleAlertIcon },
  HIGH: { label: "High risk", color: "var(--status-serious)", icon: OctagonAlertIcon },
  CRITICAL: { label: "Critical risk", color: "var(--status-critical)", icon: OctagonXIcon },
};

export const AUDIT_SEVERITY_VISUALS: Record<AuditSeverity, { label: string; color: string; icon: typeof CheckCircle2Icon }> = {
  LOW: { label: "Low", color: "var(--status-good)", icon: CheckCircle2Icon },
  MEDIUM: { label: "Medium", color: "var(--status-warning)", icon: TriangleAlertIcon },
  HIGH: { label: "High", color: "var(--status-serious)", icon: OctagonAlertIcon },
  CRITICAL: { label: "Critical", color: "var(--status-critical)", icon: OctagonXIcon },
};

export const KPI_STATUS_LABELS: Record<KpiStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  ACHIEVED: "Achieved",
  DEADLINE_MISSED: "Deadline missed",
};

/** Fixed order, non-severity (progress state, not risk state) — muted/blue/good/critical. */
export const KPI_STATUS_COLORS: Record<KpiStatus, string> = {
  NOT_STARTED: "var(--muted-foreground)",
  IN_PROGRESS: "var(--chart-1)",
  ACHIEVED: "var(--status-good)",
  DEADLINE_MISSED: "var(--status-critical)",
};

export const RISK_BAND_ORDER: RiskBand[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const KPI_STATUS_ORDER: KpiStatus[] = ["NOT_STARTED", "IN_PROGRESS", "ACHIEVED", "DEADLINE_MISSED"];
