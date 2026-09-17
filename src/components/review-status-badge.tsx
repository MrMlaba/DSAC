import { REVIEW_STATUS_VISUALS } from "@/lib/risk-visuals";
import type { ReviewStatus } from "@prisma/client";

export function ReviewStatusBadge({ status, className }: { status: ReviewStatus; className?: string }) {
  const visual = REVIEW_STATUS_VISUALS[status];
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
    </span>
  );
}
