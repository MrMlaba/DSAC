import { requirePortalUser } from "@/lib/portal";
import { getEntityContext } from "@/lib/data/entity-view";
import { PageHeader } from "@/components/page-header";
import { ProfileView } from "@/components/profile-view";

export default async function PortalProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePortalUser();
  const { fy } = await searchParams;
  const ctx = await getEntityContext(user, user.entityId, fy);
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your organisation's details as DSAC holds them." financialYears={ctx.financialYears} selectedFinancialYearId={ctx.selectedFinancialYear.id} />
      <ProfileView ctx={ctx} user={user} />
    </div>
  );
}
