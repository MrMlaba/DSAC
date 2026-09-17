"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_ORDER } from "@/lib/constants";
import { REVIEW_STATUS_ORDER, REVIEW_STATUS_VISUALS } from "@/lib/risk-visuals";
import type { DocumentType, ReviewStatus } from "@prisma/client";

const ALL = "all";

export function DocumentFilters({ entities }: { entities?: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const type = searchParams.get("type") ?? ALL;
  const status = searchParams.get("status") ?? ALL;
  const entity = searchParams.get("entity") ?? ALL;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", search);
        }}
        className="relative"
      >
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title…"
          className="h-8 w-48 pl-8"
        />
      </form>

      {entities && entities.length > 0 && (
        <Select value={entity} onValueChange={(v) => setParam("entity", v)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={type} onValueChange={(v) => setParam("type", v)}>
        <SelectTrigger size="sm" className="w-44">
          <SelectValue placeholder="Document type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {DOCUMENT_TYPE_ORDER.map((t: DocumentType) => (
            <SelectItem key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder="Review status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {REVIEW_STATUS_ORDER.map((s: ReviewStatus) => (
            <SelectItem key={s} value={s}>
              {REVIEW_STATUS_VISUALS[s].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
