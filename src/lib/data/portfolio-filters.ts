import type { EntityType, RiskBand, Sector, Quarter } from "@prisma/client";
import { getDefaultFinancialYear, listFinancialYears } from "@/lib/data/financial-years";
import type { PortfolioFilters } from "@/lib/data/portfolio";
import { PORTFOLIO_QUARTERS } from "@/lib/constants";

const SECTORS: Sector[] = ["SPORT", "ARTS", "CULTURE", "HERITAGE", "MUSEUMS", "LIBRARIES", "ARCHIVES", "OTHER"];
const ENTITY_TYPES: EntityType[] = ["PUBLIC_ENTITY", "NPO"];
const RISK_BANDS: RiskBand[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const QUARTERS: Quarter[] = PORTFOLIO_QUARTERS;

export interface ResolvedPortfolioFilters {
  filters: PortfolioFilters;
  financialYears: { id: string; label: string }[];
  financialYearLabel: string;
}

/** Shared between the dashboard page and the export API route, so both filter identically. */
export async function resolvePortfolioFilters(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ResolvedPortfolioFilters> {
  const financialYears = await listFinancialYears();

  const fyParam = typeof searchParams.fy === "string" ? searchParams.fy : undefined;
  const fy = financialYears.find((y) => y.id === fyParam) ?? (await getDefaultFinancialYear()) ?? financialYears.at(-1);

  const sectorParam = typeof searchParams.sector === "string" ? searchParams.sector : undefined;
  const sector = SECTORS.find((s) => s === sectorParam);

  const typeParam = typeof searchParams.type === "string" ? searchParams.type : undefined;
  const entityType = ENTITY_TYPES.find((t) => t === typeParam);

  const riskParam = typeof searchParams.risk === "string" ? searchParams.risk : undefined;
  const riskBand = RISK_BANDS.find((r) => r === riskParam);

  const quarterParam = typeof searchParams.quarter === "string" ? searchParams.quarter : undefined;
  const quarter = QUARTERS.find((q) => q === quarterParam);

  if (!fy) {
    throw new Error("No financial years seeded — run `pnpm db:seed`.");
  }

  return {
    filters: { financialYearId: fy.id, quarter, sector, entityType, riskBand },
    financialYears: financialYears.map((y) => ({ id: y.id, label: y.label })),
    financialYearLabel: fy.label,
  };
}
