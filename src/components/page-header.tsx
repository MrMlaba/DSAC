import type { ReactNode } from "react";
import { EntityFinancialYearSelect } from "@/components/entity-financial-year-select";

export function PageHeader({
  title,
  description,
  financialYears,
  selectedFinancialYearId,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  financialYears?: { id: string; label: string }[];
  selectedFinancialYearId?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {financialYears && <EntityFinancialYearSelect financialYears={financialYears} selectedId={selectedFinancialYearId} />}
      </div>
    </div>
  );
}
