"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComplianceBadge, ReportStatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import type { ComplianceColour, ComplianceState } from "@/lib/calc/compliance";
import type { ReportStatus, ReportKind } from "@prisma/client";

export interface ReportTableRow {
  id: string;
  entityId: string;
  entityName: string;
  title: string;
  kind: ReportKind;
  dueDate: string;
  submittedAt: string | null;
  status: ReportStatus;
  reviewComment: string | null;
  complianceState: ComplianceState;
  complianceColour: ComplianceColour;
  daysUntilDue: number;
  /** Entity view: what is still missing before this can be submitted. Empty = ready. */
  problems: string[];
  attachments: number;
}

const PAGE_SIZE = 40;

type Filter = "all" | "review" | "returned" | "outstanding" | "delivered";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "review", label: "Awaiting review" },
  { key: "returned", label: "Returned" },
  { key: "outstanding", label: "Outstanding" },
  { key: "delivered", label: "Accepted / finalised" },
];

function matches(row: ReportTableRow, filter: Filter): boolean {
  switch (filter) {
    case "review":
      return row.status === "SUBMITTED" || row.status === "UNDER_REVIEW";
    case "returned":
      return row.status === "RETURNED";
    case "outstanding":
      return (row.status === "DRAFT" || row.status === "RETURNED") && row.daysUntilDue < 0;
    case "delivered":
      return row.status === "ACCEPTED" || row.status === "FINALISED";
    default:
      return true;
  }
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export function ReportsTable({
  rows,
  mode,
  showEntity,
  canFinalise = false,
  canReview = false,
}: {
  rows: ReportTableRow[];
  mode: "entity" | "dsac";
  showEntity: boolean;
  canFinalise?: boolean;
  canReview?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(() => (mode === "dsac" && rows.some((r) => matches(r, "review")) ? "review" : "all"));
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [returning, setReturning] = useState<ReportTableRow | null>(null);
  const [returnComment, setReturnComment] = useState("");

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matches(r, f.key)).length])) as Record<Filter, number>, [rows]);
  const visible = rows.filter((r) => matches(r, filter) && (query.trim() === "" || `${r.entityName} ${r.title}`.toLowerCase().includes(query.trim().toLowerCase())));

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setBusy(id);
    try {
      await action();
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const review = (row: ReportTableRow, action: "START_REVIEW" | "ACCEPT" | "FINALISE", success: string) => run(row.id, () => post(`/api/reports/${row.id}/review`, { action }), success);

  return (
    <div className="space-y-3">
      {(rows.length > 20 || mode === "dsac") && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => { setFilter(f.key); setLimit(PAGE_SIZE); }}>
                {f.label}
                <span className="tabular-nums opacity-70">{counts[f.key]}</span>
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <SearchIcon className="text-muted-foreground absolute top-2 left-2.5 size-4" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE_SIZE); }} placeholder={showEntity ? "Search entity or report" : "Search reports"} className="pl-8" aria-label="Search reports" />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {showEntity && <TableHead>Entity</TableHead>}
              <TableHead>Report</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={showEntity ? 7 : 6} className="text-muted-foreground py-8 text-center">
                  No reports match.
                </TableCell>
              </TableRow>
            )}
            {visible.slice(0, limit).map((row) => {
              const isBusy = busy === row.id;
              const editable = row.status === "DRAFT" || row.status === "RETURNED";
              return (
                <TableRow key={row.id} className="align-top">
                  {showEntity && (
                    <TableCell className="max-w-48 whitespace-normal">
                      <Link href={`/entities/${row.entityId}/reports`} className="hover:underline">
                        {row.entityName}
                      </Link>
                    </TableCell>
                  )}
                  <TableCell className="max-w-64 whitespace-normal">
                    <p className="font-medium">{row.title}</p>
                    {row.reviewComment && (row.status === "RETURNED" || mode === "entity") && <p className="text-muted-foreground mt-0.5 text-xs">DSAC: {row.reviewComment}</p>}
                    {row.attachments > 0 && <p className="text-muted-foreground mt-0.5 text-xs">{row.attachments} supporting document(s)</p>}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(row.dueDate)}</TableCell>
                  <TableCell className="tabular-nums">{row.submittedAt ? formatDate(row.submittedAt) : "—"}</TableCell>
                  <TableCell>
                    <ReportStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <ComplianceBadge state={row.complianceState} colour={row.complianceColour} />
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {mode === "entity" && editable && (
                      <div className="space-y-1.5">
                        {row.problems.length === 0 ? (
                          <Button size="sm" disabled={isBusy} onClick={() => run(row.id, () => post(`/api/reports/${row.id}/submit`), `${row.title} submitted to DSAC.`)}>
                            {isBusy && <Loader2Icon className="animate-spin" />}
                            Submit to DSAC
                          </Button>
                        ) : (
                          <details className="text-xs">
                            <summary className="text-muted-foreground hover:text-foreground cursor-pointer">Not ready — {row.problems.length} item(s) to complete</summary>
                            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                              {row.problems.slice(0, 8).map((p) => (
                                <li key={p}>{p}</li>
                              ))}
                              {row.problems.length > 8 && <li>…and {row.problems.length - 8} more</li>}
                            </ul>
                            <p className="mt-1.5">
                              {row.kind === "QUARTERLY_PERFORMANCE" ? (
                                <Link href="/performance" className="text-primary hover:underline">
                                  Go to Performance
                                </Link>
                              ) : row.kind === "QUARTERLY_FINANCIAL" ? (
                                <Link href="/finance" className="text-primary hover:underline">
                                  Go to Finance
                                </Link>
                              ) : (
                                <Link href={`/documents?link=report:${row.id}`} className="text-primary hover:underline">
                                  Attach a document
                                </Link>
                              )}
                            </p>
                          </details>
                        )}
                      </div>
                    )}
                    {mode === "dsac" && canReview && (
                      <div className="flex flex-wrap gap-1.5">
                        {row.status === "SUBMITTED" && (
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => review(row, "START_REVIEW", "Review started.")}>
                            Start review
                          </Button>
                        )}
                        {(row.status === "SUBMITTED" || row.status === "UNDER_REVIEW") && (
                          <>
                            <Button size="sm" disabled={isBusy} onClick={() => review(row, "ACCEPT", `${row.title} accepted.`)}>
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => {
                                setReturning(row);
                                setReturnComment("");
                              }}
                            >
                              Return
                            </Button>
                          </>
                        )}
                        {row.status === "ACCEPTED" && canFinalise && (
                          <Button size="sm" disabled={isBusy} onClick={() => review(row, "FINALISE", `${row.title} finalised.`)}>
                            Finalise
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {visible.length > limit && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <span className="text-muted-foreground text-xs tabular-nums">Showing {limit} of {visible.length}</span>
          <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, visible.length - limit)} more
          </Button>
        </div>
      )}

      <Dialog open={returning !== null} onOpenChange={(open) => !open && setReturning(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return for correction</DialogTitle>
            <DialogDescription>{returning?.entityName} — {returning?.title}. The entity is notified and can edit and resubmit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="return-comment">What needs correcting?</Label>
            <Textarea id="return-comment" rows={4} value={returnComment} onChange={(e) => setReturnComment(e.target.value)} placeholder="e.g. Variance explanations are missing for the KPIs below target." />
          </div>
          <DialogFooter>
            <Button
              disabled={!returnComment.trim() || busy !== null}
              onClick={async () => {
                if (!returning) return;
                await run(returning.id, () => post(`/api/reports/${returning.id}/review`, { action: "RETURN", comment: returnComment }), "Report returned to the entity.");
                setReturning(null);
              }}
            >
              Return report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
