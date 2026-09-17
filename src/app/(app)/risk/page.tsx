import { AlertTriangleIcon } from "lucide-react";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function RiskPage() {
  return (
    <PhasePlaceholder
      icon={AlertTriangleIcon}
      title="Early Warning"
      phase="Phase 4"
      description="Explainable risk scores, deadline countdowns, forecast lines and the weekly AI risk briefing."
    />
  );
}
