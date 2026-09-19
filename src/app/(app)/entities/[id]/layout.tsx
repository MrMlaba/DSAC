import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { requireDsacUser } from "@/lib/portal";
import { getEntityHeader } from "@/lib/data/entity-view";
import { listFinancialYears } from "@/lib/data/financial-years";
import { EntityTabNav } from "@/components/entity-tab-nav";
import { EntityFinancialYearSelect } from "@/components/entity-financial-year-select";
import { RiskBadge } from "@/components/risk-badge";
import { ENTITY_TYPE_LABELS, SECTOR_LABELS } from "@/lib/constants";

/** Every organisation gets the same header and the same six tabs. */
export default async function EntityLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const user = await requireDsacUser();
  const { id } = await params;

  let header;
  try {
    header = await getEntityHeader(user, id);
  } catch {
    notFound();
  }
  const years = await listFinancialYears();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/entities" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
          <ChevronLeftIcon className="size-3.5" />
          Entities &amp; NPOs
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{header.name}</h1>
              {header.risk && <RiskBadge band={header.risk.band} score={header.risk.score} />}
            </div>
            <p className="text-muted-foreground text-sm">
              {SECTOR_LABELS[header.sector]} · {ENTITY_TYPE_LABELS[header.type]}
            </p>
          </div>
          <EntityFinancialYearSelect financialYears={years.map((y) => ({ id: y.id, label: y.label }))} />
        </div>
        <EntityTabNav entityId={id} />
      </div>
      {children}
    </div>
  );
}
