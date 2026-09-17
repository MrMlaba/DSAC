import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/current-user";
import { getPortfolioData } from "@/lib/data/portfolio";
import { resolvePortfolioFilters } from "@/lib/data/portfolio-filters";
import { PortfolioFilters } from "@/components/portfolio-filters";
import { EntityCard } from "@/components/entity-card";

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = await searchParams;
  const { filters, financialYears, financialYearLabel } = await resolvePortfolioFilters(resolvedSearchParams);
  const { rows } = await getPortfolioData(user, filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entities</h1>
          <p className="text-muted-foreground text-sm">
            {rows.length} entit{rows.length === 1 ? "y" : "ies"} · FY {financialYearLabel}
          </p>
        </div>
      </div>

      <PortfolioFilters financialYears={financialYears} />

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No entities match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
      )}

      <Badge variant="outline" className="text-[10px]">
        Trend charts, audit history and demographics live on each entity&apos;s detail page.
      </Badge>
    </div>
  );
}
