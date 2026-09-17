import { RISK_BAND_VISUALS } from "@/lib/risk-visuals";
import type { RiskBand } from "@prisma/client";

export function RiskBadge({ band, score, className }: { band: RiskBand; score?: number | null; className?: string }) {
  const visual = RISK_BAND_VISUALS[band];
  const Icon = visual.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className ?? ""}`}
      style={{
        color: visual.color,
        backgroundColor: `color-mix(in oklch, ${visual.color} 16%, transparent)`,
      }}
    >
      <Icon className="size-3.5" />
      {visual.label}
      {score !== undefined && score !== null && <span className="tabular-nums opacity-80">· {score}</span>}
    </span>
  );
}
