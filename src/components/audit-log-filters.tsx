"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

export function AuditLogFilters({ actions, entities }: { actions: string[]; entities: { id: string; name: string }[] }) {
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

  const action = searchParams.get("action") ?? ALL;
  const entity = searchParams.get("entity") ?? ALL;
  const days = searchParams.get("days") ?? ALL;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={action} onValueChange={(v) => setParam("action", v)}>
        <SelectTrigger size="sm" className="w-48">
          <SelectValue placeholder="Action" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All actions</SelectItem>
          {actions.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {entities.length > 1 && (
        <Select value={entity} onValueChange={(v) => setParam("entity", v)}>
          <SelectTrigger size="sm" className="w-48">
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

      <Select value={days} onValueChange={(v) => setParam("days", v)}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder="Time range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All time</SelectItem>
          <SelectItem value="1">Last 24 hours</SelectItem>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
