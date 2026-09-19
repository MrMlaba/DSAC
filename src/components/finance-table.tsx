"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, PaperclipIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MagnitudeBar } from "@/components/proportion-bar";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { formatPercent, formatRand } from "@/lib/format";
import type { FinanceLine, FinanceSummary } from "@/lib/calc/finance";

export interface LineEvidenceLink {
  id: string;
  title: string;
}

/**
 * Annual approved budget vs the latest cumulative actual, per expense line. The quarterly entries
 * behind each figure stay stored, but they live in the drill-down — never as Q1–Q4 columns.
 */
export function FinanceTable({ lines, summary, evidence, attachHrefBase }: { lines: FinanceLine[]; summary: FinanceSummary; evidence: Record<string, LineEvidenceLink[]>; attachHrefBase?: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Expense / budget line</TableHead>
          <TableHead className="text-right">Annual approved budget</TableHead>
          <TableHead className="text-right">Actual expenditure to date</TableHead>
          <TableHead className="text-right">Remaining budget</TableHead>
          <TableHead className="w-44">Utilisation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => {
          const isOpen = open.has(line.id);
          const files = evidence[line.id] ?? [];
          const label = EXPENSE_CATEGORY_LABELS[line.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? line.category;
          return (
            <Fragment key={line.id}>
              <TableRow className="cursor-pointer" onClick={() => toggle(line.id)} aria-expanded={isOpen}>
                <TableCell>
                  <ChevronRightIcon className={`text-muted-foreground size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </TableCell>
                <TableCell className="font-medium">
                  {label}
                  {files.length > 0 && (
                    <span className="text-muted-foreground ml-2 inline-flex items-center gap-0.5 text-xs font-normal">
                      <PaperclipIcon className="size-3" />
                      {files.length}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatRand(line.annualBudget)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRand(line.actualToDate)}</TableCell>
                <TableCell className={`text-right tabular-nums ${line.remaining < 0 ? "font-medium text-[var(--status-critical)]" : ""}`}>{formatRand(line.remaining)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MagnitudeBar value={line.utilisation ?? 0} color={line.overspent ? "var(--status-critical)" : "var(--chart-2)"} className="flex-1" />
                    <span className={`w-14 text-right text-sm tabular-nums ${line.overspent ? "font-medium text-[var(--status-critical)]" : ""}`}>{formatPercent(line.utilisation)}</span>
                  </div>
                </TableCell>
              </TableRow>
              {isOpen && (
                <TableRow className="hover:bg-transparent">
                  <TableCell />
                  <TableCell colSpan={5} className="whitespace-normal">
                    <div className="grid gap-4 py-2 md:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Quarterly entries (history)</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground text-left">
                              <th className="py-1 font-medium">Quarter</th>
                              <th className="py-1 text-right font-medium">Spent in quarter</th>
                              <th className="py-1 text-right font-medium">Cumulative</th>
                              <th className="py-1 text-right font-medium">Utilisation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {line.quarters.map((q) => (
                              <tr key={q.quarter} className="border-t">
                                <td className="py-1">{q.quarter}</td>
                                <td className="py-1 text-right tabular-nums">{q.amount === null ? <span className="text-muted-foreground">not reported</span> : formatRand(q.amount)}</td>
                                <td className="py-1 text-right tabular-nums">{q.amount === null ? "—" : formatRand(q.cumulative)}</td>
                                <td className="py-1 text-right tabular-nums">{q.amount === null ? "—" : formatPercent(q.cumulativeUtilisation)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Supporting evidence</p>
                        {files.length === 0 ? (
                          <p className="text-muted-foreground">No documents linked to this line.</p>
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
                          <Link href={`${attachHrefBase}${line.id}`} className="text-primary mt-1 inline-block text-xs hover:underline">
                            Attach evidence
                          </Link>
                        )}
                        {line.overspent && <p className="mt-3 text-[var(--status-critical)]">Overspent by {formatRand(-line.remaining)} against the approved budget for this line.</p>}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow className="font-semibold">
          <TableCell />
          <TableCell>Total</TableCell>
          <TableCell className="text-right tabular-nums">{formatRand(summary.approved)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatRand(summary.utilised)}</TableCell>
          <TableCell className={`text-right tabular-nums ${summary.remainingBudget < 0 ? "text-[var(--status-critical)]" : ""}`}>{formatRand(summary.remainingBudget)}</TableCell>
          <TableCell className="text-sm tabular-nums">{formatPercent(summary.budgetUtilisation)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
