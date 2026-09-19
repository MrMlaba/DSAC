import {
  COMPLIANCE_COLOURS,
  COMPLIANCE_STATE_ICONS,
  ENTITY_COMPLIANCE_VISUALS,
  KPI_STATUS_VISUALS,
  PERFORMANCE_BAND_VISUALS,
  REPORT_STATUS_VISUALS,
  REQUEST_STATUS_VISUALS,
  type Visual,
} from "@/lib/risk-visuals";
import { COMPLIANCE_STATE_LABELS } from "@/lib/constants";
import type { ComplianceState, ComplianceColour, EntityComplianceStatus } from "@/lib/calc/compliance";
import type { KpiStatus, PerformanceBand } from "@/lib/calc/performance";
import type { ReportStatus, RequestStatus } from "@prisma/client";

/** Every status in the app is a coloured pill with an icon AND a label — never colour alone. */
export function StatusBadge({ visual, label, className }: { visual: Pick<Visual, "color" | "icon"> & { label?: string }; label?: string; className?: string }) {
  const Icon = visual.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className ?? ""}`}
      style={{ color: visual.color, backgroundColor: `color-mix(in oklch, ${visual.color} 16%, transparent)` }}
    >
      <Icon className="size-3.5" />
      {label ?? visual.label}
    </span>
  );
}

export function KpiStatusBadge({ status }: { status: KpiStatus | null }) {
  if (!status) return <span className="text-muted-foreground text-xs">Not yet due</span>;
  return <StatusBadge visual={KPI_STATUS_VISUALS[status]} />;
}

export function PerformanceBandBadge({ band }: { band: PerformanceBand }) {
  return <StatusBadge visual={PERFORMANCE_BAND_VISUALS[band]} />;
}

export function EntityComplianceBadge({ status }: { status: EntityComplianceStatus }) {
  return <StatusBadge visual={ENTITY_COMPLIANCE_VISUALS[status]} />;
}

export function ComplianceBadge({ state, colour }: { state: ComplianceState; colour: ComplianceColour }) {
  return <StatusBadge visual={{ color: COMPLIANCE_COLOURS[colour], icon: COMPLIANCE_STATE_ICONS[state] }} label={COMPLIANCE_STATE_LABELS[state]} />;
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <StatusBadge visual={REPORT_STATUS_VISUALS[status]} />;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <StatusBadge visual={REQUEST_STATUS_VISUALS[status]} />;
}
