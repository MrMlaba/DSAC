import { requirePortalUser } from "@/lib/portal";
import { getEntityContext } from "@/lib/data/entity-view";
import { PageHeader } from "@/components/page-header";
import { ComplianceView } from "@/components/compliance-view";

export default async function PortalCompliancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePortalUser();
  const { fy } = await searchParams;
  const ctx = await getEntityContext(user, user.entityId, fy);
  return (
    <div className="space-y-6">
      <PageHeader title="Compliance" description="Every requirement you must meet, when it is due and where it stands." financialYears={ctx.financialYears} selectedFinancialYearId={ctx.selectedFinancialYear.id} />
      <ComplianceView ctx={ctx} />
    </div>
  );
}
