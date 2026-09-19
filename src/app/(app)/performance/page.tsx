import { requirePortalUser } from "@/lib/portal";
import { getEntityContext } from "@/lib/data/entity-view";
import { PageHeader } from "@/components/page-header";
import { PerformanceView } from "@/components/performance-view";

export default async function PortalPerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePortalUser();
  const { fy } = await searchParams;
  const ctx = await getEntityContext(user, user.entityId, fy);
  return (
    <div className="space-y-6">
      <PageHeader title="Performance" description="Your KPIs, targets and actual performance. Enter each quarter's result and the system does the rest." financialYears={ctx.financialYears} selectedFinancialYearId={ctx.selectedFinancialYear.id} />
      <PerformanceView ctx={ctx} user={user} />
    </div>
  );
}
