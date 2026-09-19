"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EntityComplianceBadge, PerformanceBandBadge } from "@/components/status-badge";
import { ENTITY_COMPLIANCE_LABELS, PERFORMANCE_BAND_LABELS } from "@/lib/constants";
import type { EntityComplianceStatus } from "@/lib/calc/compliance";
import type { PerformanceBand } from "@/lib/calc/performance";

export interface EntityListRow {
  id: string;
  name: string;
  type: "PUBLIC_ENTITY" | "NPO";
  compliance: EntityComplianceStatus;
  performance: PerformanceBand;
}

const selectClass = "border-input bg-background h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** The searchable list of every organisation, with the two status columns DSAC scans first. */
export function EntitiesTable({ rows, financialYearId }: { rows: EntityListRow[]; financialYearId: string }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [compliance, setCompliance] = useState("");
  const [performance, setPerformance] = useState("");

  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase())) &&
          (!type || r.type === type) &&
          (!compliance || r.compliance === compliance) &&
          (!performance || r.performance === performance),
      ),
    [rows, query, type, compliance, performance],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="text-muted-foreground absolute top-2 left-2.5 size-4" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search organisations" className="pl-8" aria-label="Search organisations" />
        </div>
        <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          <option value="PUBLIC_ENTITY">Public Entity</option>
          <option value="NPO">NPO</option>
        </select>
        <select className={selectClass} value={compliance} onChange={(e) => setCompliance(e.target.value)} aria-label="Filter by compliance">
          <option value="">All compliance</option>
          {(Object.keys(ENTITY_COMPLIANCE_LABELS) as EntityComplianceStatus[]).map((s) => (
            <option key={s} value={s}>
              {ENTITY_COMPLIANCE_LABELS[s]}
            </option>
          ))}
        </select>
        <select className={selectClass} value={performance} onChange={(e) => setPerformance(e.target.value)} aria-label="Filter by performance">
          <option value="">All performance</option>
          {(["ON_TRACK", "AT_RISK", "UNDER_TARGET"] as const).map((b) => (
            <option key={b} value={b}>
              {PERFORMANCE_BAND_LABELS[b]}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground ml-auto text-sm tabular-nums">
          {visible.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organisation</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Performance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                  No organisations match.
                </TableCell>
              </TableRow>
            )}
            {visible.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/entities/${row.id}?fy=${financialYearId}`} className="hover:underline">
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{row.type === "NPO" ? "NPO" : "Public Entity"}</TableCell>
                <TableCell>
                  <EntityComplianceBadge status={row.compliance} />
                </TableCell>
                <TableCell>
                  <PerformanceBandBadge band={row.performance} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
