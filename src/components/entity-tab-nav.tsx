"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "performance", label: "Performance" },
  { slug: "finance", label: "Finance" },
  { slug: "compliance", label: "Compliance" },
  { slug: "reports", label: "Reports" },
  { slug: "profile", label: "Profile" },
] as const;

/** The same six tabs on every entity and NPO, so DSAC never learns a different structure per organisation. */
export function EntityTabNav({ entityId }: { entityId: string }) {
  const pathname = usePathname();
  const fy = useSearchParams().get("fy");
  const query = fy ? `?fy=${encodeURIComponent(fy)}` : "";
  const base = `/entities/${entityId}`;

  return (
    <nav aria-label="Entity sections" className="-mb-px flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={tab.label}
            href={`${href}${query}`}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
