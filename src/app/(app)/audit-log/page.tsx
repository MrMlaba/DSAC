import { redirect } from "next/navigation";
import { ShieldIcon } from "lucide-react";
import { PhasePlaceholder } from "@/components/phase-placeholder";
import { requireUser } from "@/lib/current-user";

export default async function AuditLogPage() {
  const user = await requireUser();
  if (user.role !== "DSAC_ADMIN") redirect("/dashboard");

  return (
    <PhasePlaceholder
      icon={ShieldIcon}
      title="Audit Log"
      phase="Phase 7"
      description="Append-only log of every view, download, approve and delete action, with an admin viewer."
    />
  );
}
