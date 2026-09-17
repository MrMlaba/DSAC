import { KanbanIcon } from "lucide-react";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export default function TasksPage() {
  return (
    <PhasePlaceholder
      icon={KanbanIcon}
      title="Tasks & Workspaces"
      phase="Phase 5"
      description="Entity workspaces: kanban tasks, real-time comments, deadlines calendar and team members."
    />
  );
}
