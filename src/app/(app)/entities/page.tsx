import { Building2Icon } from "lucide-react";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function EntitiesPage() {
  return (
    <PhasePlaceholder
      icon={Building2Icon}
      title="Entities"
      phase="Phase 2"
      description="Entity drill-down: KPI progress, year-on-year trends, audit history, fund utilisation and staff demographics."
    />
  );
}
