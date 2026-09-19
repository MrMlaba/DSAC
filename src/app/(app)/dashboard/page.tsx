import { requireUser } from "@/lib/current-user";
import { isDsacWideRole } from "@/lib/constants";
import { resolveFinancialYear } from "@/lib/data/financial-years";
import { DsacDashboard } from "@/components/dsac-dashboard";
import { EntityDashboard } from "@/components/entity-dashboard";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const { financialYears, selected } = await resolveFinancialYear(params.fy);

  if (isDsacWideRole(user.role)) {
    return <DsacDashboard user={user} financialYears={financialYears} selected={selected} />;
  }
  if (!user.entityId) return <p className="text-muted-foreground text-sm">Your account isn&apos;t linked to an organisation yet.</p>;
  return <EntityDashboard user={user} entityId={user.entityId} financialYears={financialYears} fyParam={selected.id} />;
}
