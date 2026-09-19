"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function EntityFinancialYearSelect({ financialYears, selectedId }: { financialYears: { id: string; label: string }[]; selectedId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = selectedId ?? searchParams.get("fy") ?? financialYears.at(-1)?.id ?? "";

  function onChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("fy", value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-36">
        <SelectValue placeholder="Financial year">{financialYears.find((y) => y.id === current) ? `FY ${financialYears.find((y) => y.id === current)!.label}` : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {financialYears.map((year) => (
          <SelectItem key={year.id} value={year.id}>
            FY {year.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
