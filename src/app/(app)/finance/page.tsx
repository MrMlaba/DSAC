import { requirePortalUser } from "@/lib/portal";
import { getEntityContext } from "@/lib/data/entity-view";
import { PageHeader } from "@/components/page-header";
import { FinanceView } from "@/components/finance-view";

export default async function PortalFinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePortalUser();
  const { fy } = await searchParams;
  const ctx = await getEntityContext(user, user.entityId, fy);
  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="Your approved annual budget against cumulative actual expenditure. Each quarter you enter only what was spent that quarter." financialYears={ctx.financialYears} selectedFinancialYearId={ctx.selectedFinancialYear.id} />
      <FinanceView ctx={ctx} user={user} />
    </div>
  );
}
