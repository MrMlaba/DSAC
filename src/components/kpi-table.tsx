"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, PaperclipIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiStatusBadge } from "@/components/status-badge";
import { formatKpiValue, formatPercent, formatSigned } from "@/lib/format";
import { PERF_QUARTERS } from "@/lib/calc/performance";
import type { KpiRow } from "@/lib/data/metrics";

export interface KpiEvidenceLink {
  id: string;
  title: string;
}

/**
 * The standard KPI reporting structure: Programme → Objective → KPI, then annual target, target to
 * date, actual to date, variance, achievement and status. The remaining standard fields — period
 * target/actual, reason for variance, corrective action, evidence — sit one click deeper.
 */
export function KpiTable({ kpis, evidence, asAt, attachHrefBase }: { kpis: KpiRow[]; evidence: Record<string, KpiEvidenceLink[]>; asAt: string | null; attachHrefBase?: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const programmes = [...new Set(kpis.map((k) => k.programme))];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>KPI</TableHead>
          <TableHead className="text-right">Annual target</TableHead>
          <TableHead className="text-right">Target to date{asAt ? ` (${asAt})` : ""}</TableHead>
          <TableHead className="text-right">Actual to date</TableHead>
          <TableHead className="text-right">Variance</TableHead>
          <TableHead className="text-right">Achievement</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {programmes.map((programme) => {
          const rows = kpis.filter((k) => k.programme === programme);
          return (
            <Fragment key={programme}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={8} className="py-2">
                  <span className="text-sm font-semibold">{programme}</span>
                  <span className="text-muted-foreground ml-2 text-xs">Objective: {rows[0].objective}</span>
                </TableCell>
              </TableRow>
              {rows.map((kpi) => {
                const r = kpi.result;
                const isOpen = open.has(kpi.id);
                const files = evidence[kpi.id] ?? [];
                return (
                  <Fragment key={kpi.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(kpi.id)} aria-expanded={isOpen}>
                      <TableCell>
                        <ChevronRightIcon className={`text-muted-foreground size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
                        <p className="text-sm font-medium">{kpi.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {kpi.unit === "%" ? "Rate (%)" : kpi.unit} · {kpi.aggregation === "SUM" ? "cumulative" : "latest value"}
                          {files.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-0.5">
                              <PaperclipIcon className="size-3" />
                              {files.length}
                            </span>
                          )}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatKpiValue(kpi.annualTarget, kpi.unit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r ? formatKpiValue(r.ytdTarget, kpi.unit) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r ? formatKpiValue(r.ytdActual, kpi.unit) : "—"}</TableCell>
                      <TableCell className={`text-right tabular-nums ${r && r.variance < 0 ? "text-[var(--status-critical)]" : ""}`}>{r ? formatSigned(r.variance) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(r?.achievement)}</TableCell>
                      <TableCell>
                        <KpiStatusBadge status={r?.status ?? null} />
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell />
                        <TableCell colSpan={7} className="whitespace-normal">
                          <div className="grid gap-4 py-2 md:grid-cols-2">
                            <div className="space-y-3 text-sm">
                              <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
                                <dt className="text-muted-foreground">Period target ({asAt ?? "—"})</dt>
                                <dd className="tabular-nums">{formatKpiValue(r?.periodTarget, kpi.unit)}</dd>
                                <dt className="text-muted-foreground">Period actual ({asAt ?? "—"})</dt>
                                <dd className="tabular-nums">{formatKpiValue(r?.periodActual, kpi.unit)}</dd>
                                <dt className="text-muted-foreground">Annual progress</dt>
                                <dd className="tabular-nums">{formatPercent(r?.annualProgress)} of annual target</dd>
                                <dt className="text-muted-foreground">Reason for variance</dt>
                                <dd>{kpi.reasonForVariance ?? <span className="text-muted-foreground">Not required / none given</span>}</dd>
                                <dt className="text-muted-foreground">Corrective action</dt>
                                <dd>{kpi.correctiveAction ?? <span className="text-muted-foreground">None recorded</span>}</dd>
                                <dt className="text-muted-foreground">Evidence</dt>
                                <dd>
                                  {files.length === 0 ? (
                                    <span className="text-muted-foreground">No supporting documents linked</span>
                                  ) : (
                                    <ul className="space-y-0.5">
                                      {files.map((f) => (
                                        <li key={f.id}>
                                          <Link href={`/documents/${f.id}`} className="text-primary hover:underline">
                                            {f.title}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  {attachHrefBase && (
                                    <Link href={`${attachHrefBase}${kpi.id}`} className="text-primary mt-1 inline-block text-xs hover:underline">
                                      Attach evidence
                                    </Link>
                                  )}
                                </dd>
                              </dl>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Quarter by quarter</p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground text-left">
                                    <th className="py-1 font-medium">Quarter</th>
                                    <th className="py-1 text-right font-medium">Target</th>
                                    <th className="py-1 text-right font-medium">Actual</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {PERF_QUARTERS.map((q) => (
                                    <tr key={q} className="border-t">
                                      <td className="py-1">{q}</td>
                                      <td className="py-1 text-right tabular-nums">{formatKpiValue(kpi.quarters[q].target, kpi.unit)}</td>
                                      <td className="py-1 text-right tabular-nums">{formatKpiValue(kpi.quarters[q].actual, kpi.unit)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
