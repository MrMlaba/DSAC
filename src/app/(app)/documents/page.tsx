import { FileTextIcon } from "lucide-react";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function DocumentsPage() {
  return (
    <PhasePlaceholder
      icon={FileTextIcon}
      title="Document Repository"
      phase="Phase 3"
      description="Upload, version, review and search strategic plans, APPs, quarterly reports, annual reports and financials."
    />
  );
}
