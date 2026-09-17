"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ENTITY_TYPE_LABELS, SECTOR_LABELS, QUARTER_LABELS, PORTFOLIO_QUARTERS } from "@/lib/constants";
import { RISK_BAND_VISUALS } from "@/lib/risk-visuals";
import type { EntityType, Sector, RiskBand } from "@prisma/client";

const ALL = "all";

export function PortfolioFilters({
  financialYears,
}: {
  financialYears: { id: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const fy = searchParams.get("fy") ?? financialYears.at(-1)?.id ?? "";
  const quarter = searchParams.get("quarter") ?? ALL;
  const sector = searchParams.get("sector") ?? ALL;
  const type = searchParams.get("type") ?? ALL;
  const risk = searchParams.get("risk") ?? ALL;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={fy} onValueChange={(v) => setParam("fy", v)}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Financial year" />
        </SelectTrigger>
        <SelectContent>
          {financialYears.map((year) => (
            <SelectItem key={year.id} value={year.id}>
              FY {year.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={quarter} onValueChange={(v) => setParam("quarter", v)}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Quarter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Full year</SelectItem>
          {PORTFOLIO_QUARTERS.map((q) => (
            <SelectItem key={q} value={q}>
              {QUARTER_LABELS[q]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sector} onValueChange={(v) => setParam("sector", v)}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Sector" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All sectors</SelectItem>
          {(Object.keys(SECTOR_LABELS) as Sector[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SECTOR_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={type} onValueChange={(v) => setParam("type", v)}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder="Entity type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All entity types</SelectItem>
          {(Object.keys(ENTITY_TYPE_LABELS) as EntityType[]).map((t) => (
            <SelectItem key={t} value={t}>
              {ENTITY_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={risk} onValueChange={(v) => setParam("risk", v)}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Risk band" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All risk bands</SelectItem>
          {(Object.keys(RISK_BAND_VISUALS) as RiskBand[]).map((b) => (
            <SelectItem key={b} value={b}>
              {RISK_BAND_VISUALS[b].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
