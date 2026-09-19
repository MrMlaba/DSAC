import {
  CheckCircle2Icon,
  TriangleAlertIcon,
  OctagonAlertIcon,
  OctagonXIcon,
  ClockIcon,
  InboxIcon,
  SearchIcon,
  UndoIcon,
  PencilLineIcon,
  BadgeCheckIcon,
  CircleDashedIcon,
  CircleHelpIcon,
  BanIcon,
  FlagIcon,
} from "lucide-react";
import type { RiskBand, AuditSeverity, ReviewStatus, ReportStatus, RequestStatus } from "@prisma/client";
import type { ComplianceColour, ComplianceState, EntityComplianceStatus } from "@/lib/calc/compliance";
import type { KpiStatus, PerformanceBand } from "@/lib/calc/performance";

export type Visual = { label: string; color: string; icon: typeof CheckCircle2Icon };

/**
 * Status colors (good/warning/serious/critical) are reserved for
 * risk/severity states and never reused as categorical series colors.
 * Always paired with an icon + label — never color alone.
 */
export const RISK_BAND_VISUALS: Record<RiskBand, Visual> = {
  LOW: { label: "Low risk", color: "var(--status-good)", icon: CheckCircle2Icon },
  MEDIUM: { label: "Medium risk", color: "var(--status-warning)", icon: TriangleAlertIcon },
  HIGH: { label: "High risk", color: "var(--status-serious)", icon: OctagonAlertIcon },
  CRITICAL: { label: "Critical risk", color: "var(--status-critical)", icon: OctagonXIcon },
};

export const AUDIT_SEVERITY_VISUALS: Record<AuditSeverity, Visual> = {
  LOW: { label: "Low", color: "var(--status-good)", icon: CheckCircle2Icon },
  MEDIUM: { label: "Medium", color: "var(--status-warning)", icon: TriangleAlertIcon },
  HIGH: { label: "High", color: "var(--status-serious)", icon: OctagonAlertIcon },
  CRITICAL: { label: "Critical", color: "var(--status-critical)", icon: OctagonXIcon },
};

export const RISK_BAND_ORDER: RiskBand[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/** Achieved = green, On track = blue, At risk = amber, Not achieved = red. */
export const KPI_STATUS_VISUALS: Record<KpiStatus, Visual> = {
  ACHIEVED: { label: "Achieved", color: "var(--status-good)", icon: CheckCircle2Icon },
  ON_TRACK: { label: "On Track", color: "var(--chart-1)", icon: BadgeCheckIcon },
  AT_RISK: { label: "At Risk", color: "var(--status-warning)", icon: TriangleAlertIcon },
  NOT_ACHIEVED: { label: "Not Achieved", color: "var(--status-critical)", icon: OctagonXIcon },
};
export const KPI_STATUS_ORDER: KpiStatus[] = ["ACHIEVED", "ON_TRACK", "AT_RISK", "NOT_ACHIEVED"];

export const PERFORMANCE_BAND_VISUALS: Record<PerformanceBand, Visual> = {
  ON_TRACK: { label: "On Track", color: "var(--status-good)", icon: CheckCircle2Icon },
  AT_RISK: { label: "At Risk", color: "var(--status-warning)", icon: TriangleAlertIcon },
  UNDER_TARGET: { label: "Under Target", color: "var(--status-critical)", icon: OctagonXIcon },
  NO_DATA: { label: "No data yet", color: "var(--muted-foreground)", icon: CircleHelpIcon },
};

/** Green = Compliant · Amber = Due soon / Attention required · Red = Overdue · Grey = not due yet. */
export const COMPLIANCE_COLOURS: Record<ComplianceColour, string> = {
  green: "var(--status-good)",
  amber: "var(--status-warning)",
  red: "var(--status-critical)",
  neutral: "var(--muted-foreground)",
};

export const COMPLIANCE_STATE_ICONS: Record<ComplianceState, typeof CheckCircle2Icon> = {
  COMPLIANT: CheckCircle2Icon,
  LATE_SUBMISSION: ClockIcon,
  RETURNED: UndoIcon,
  DUE_SOON: TriangleAlertIcon,
  UPCOMING: CircleDashedIcon,
  OVERDUE: OctagonXIcon,
};

export const ENTITY_COMPLIANCE_VISUALS: Record<EntityComplianceStatus, Visual> = {
  COMPLIANT: { label: "Compliant", color: "var(--status-good)", icon: CheckCircle2Icon },
  ATTENTION_REQUIRED: { label: "Attention Required", color: "var(--status-warning)", icon: TriangleAlertIcon },
  OVERDUE_REPORTING: { label: "Overdue Reporting", color: "var(--status-critical)", icon: OctagonXIcon },
};

export const REPORT_STATUS_VISUALS: Record<ReportStatus, Visual> = {
  DRAFT: { label: "Draft", color: "var(--muted-foreground)", icon: PencilLineIcon },
  SUBMITTED: { label: "Submitted", color: "var(--chart-1)", icon: InboxIcon },
  UNDER_REVIEW: { label: "Under review", color: "var(--status-warning)", icon: SearchIcon },
  ACCEPTED: { label: "Accepted", color: "var(--status-good)", icon: CheckCircle2Icon },
  RETURNED: { label: "Returned for correction", color: "var(--status-serious)", icon: UndoIcon },
  FINALISED: { label: "Finalised", color: "var(--status-good)", icon: BadgeCheckIcon },
};

export const REQUEST_STATUS_VISUALS: Record<RequestStatus, Visual> = {
  SUBMITTED: { label: "Submitted", color: "var(--chart-1)", icon: InboxIcon },
  UNDER_REVIEW: { label: "Under review", color: "var(--status-warning)", icon: SearchIcon },
  APPROVED: { label: "Approved", color: "var(--status-good)", icon: CheckCircle2Icon },
  DECLINED: { label: "Declined", color: "var(--status-critical)", icon: BanIcon },
  MORE_INFO_REQUIRED: { label: "More information required", color: "var(--status-serious)", icon: FlagIcon },
  COMPLETED: { label: "Completed", color: "var(--muted-foreground)", icon: BadgeCheckIcon },
};

export const REVIEW_STATUS_VISUALS: Record<ReviewStatus, Visual> = {
  SUBMITTED: { label: "Submitted", color: "var(--muted-foreground)", icon: ClockIcon },
  RECEIVED: { label: "Received", color: "var(--chart-1)", icon: InboxIcon },
  UNDER_REVIEW: { label: "Under review", color: "var(--status-warning)", icon: SearchIcon },
  APPROVED: { label: "Approved", color: "var(--status-good)", icon: CheckCircle2Icon },
  RETURNED: { label: "Returned", color: "var(--status-serious)", icon: UndoIcon },
};

export const REVIEW_STATUS_ORDER: ReviewStatus[] = ["SUBMITTED", "RECEIVED", "UNDER_REVIEW", "APPROVED", "RETURNED"];
