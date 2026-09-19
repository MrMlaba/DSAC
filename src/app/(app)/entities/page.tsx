import { requireDsacUser } from "@/lib/portal";
import { resolveFinancialYear } from "@/lib/data/financial-years";
import { getPortfolio } from "@/lib/data/portfolio";
import { PageHeader } from "@/components/page-header";
import { EntitiesTable } from "@/components/entities-table";

export default async function EntitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireDsacUser();
  const params = await searchParams;
  const { financialYears, selected } = await resolveFinancialYear(params.fy);
  const { rows } = await getPortfolio(user, selected.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entities & NPOs"
        description={`Every organisation DSAC monitors, with its compliance and performance status. Select one to open its oversight page. FY ${selected.label}.`}
        financialYears={financialYears}
        selectedFinancialYearId={selected.id}
      />
      <EntitiesTable
        financialYearId={selected.id}
        rows={rows.map((r) => ({ id: r.id, name: r.name, type: r.type, compliance: r.metrics.compliance.summary.status, performance: r.metrics.performance.band }))}
      />
    </div>
  );
}
