"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RequestStatusBadge } from "@/components/status-badge";
import { REQUEST_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatRand } from "@/lib/format";
import type { RequestCategory, RequestStatus } from "@prisma/client";

export interface RequestTableRow {
  id: string;
  entityId: string;
  entityName: string;
  title: string;
  category: RequestCategory;
  amountRequested: number | null;
  motivation: string;
  linkedProgramme: string | null;
  expectedOutcome: string;
  status: RequestStatus;
  decisionNote: string | null;
  createdByName: string;
  createdAt: string;
  attachmentCount: number;
}

type NoteAction = { kind: "decision"; action: "DECLINE" | "REQUEST_INFO" } | { kind: "respond" };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

export function RequestsTable({ rows, mode, showEntity }: { rows: RequestTableRow[]; mode: "dsac" | "dsac-readonly" | "entity"; showEntity: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<{ row: RequestTableRow; action: NoteAction } | null>(null);
  const [note, setNote] = useState("");

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
  const decide = (row: RequestTableRow, action: string, success: string) => run(row.id, () => post(`/api/requests/${row.id}/decision`, { action }), success);

  if (rows.length === 0) return <p className="text-muted-foreground py-8 text-center text-sm">No requests yet.</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              {showEntity && <TableHead>Entity</TableHead>}
              <TableHead>Request</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isOpen = open.has(row.id);
              const isBusy = busy === row.id;
              const openForDecision = row.status === "SUBMITTED" || row.status === "UNDER_REVIEW";
              return (
                <Fragment key={row.id}>
                  <TableRow className="cursor-pointer align-top" onClick={() => toggle(row.id)} aria-expanded={isOpen}>
                    <TableCell>
                      <ChevronRightIcon className={`text-muted-foreground size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </TableCell>
                    {showEntity && <TableCell className="max-w-44 whitespace-normal">{row.entityName}</TableCell>}
                    <TableCell className="max-w-64 font-medium whitespace-normal">{row.title}</TableCell>
                    <TableCell>{REQUEST_CATEGORY_LABELS[row.category]}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.amountRequested !== null ? formatRand(row.amountRequested) : "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatDate(row.createdAt)}</TableCell>
                    <TableCell>
                      <RequestStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="whitespace-normal">
                      {mode === "dsac" && (
                        <div className="flex flex-wrap gap-1.5">
                          {row.status === "SUBMITTED" && (
                            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => decide(row, "START_REVIEW", "Review started.")}>
                              Start review
                            </Button>
                          )}
                          {openForDecision && (
                            <>
                              <Button size="sm" disabled={isBusy} onClick={() => decide(row, "APPROVE", "Request approved.")}>
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => { setNoteFor({ row, action: { kind: "decision", action: "REQUEST_INFO" } }); setNote(""); }}>
                                Ask for info
                              </Button>
                              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => { setNoteFor({ row, action: { kind: "decision", action: "DECLINE" } }); setNote(""); }}>
                                Decline
                              </Button>
                            </>
                          )}
                          {row.status === "APPROVED" && (
                            <Button size="sm" disabled={isBusy} onClick={() => decide(row, "COMPLETE", "Request marked completed.")}>
                              Mark completed
                            </Button>
                          )}
                        </div>
                      )}
                      {mode === "entity" && row.status === "MORE_INFO_REQUIRED" && (
                        <Button size="sm" disabled={isBusy} onClick={() => { setNoteFor({ row, action: { kind: "respond" } }); setNote(""); }}>
                          Provide information
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell />
                      <TableCell colSpan={showEntity ? 7 : 6} className="whitespace-normal">
                        <dl className="grid max-w-3xl grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 py-2 text-sm">
                          <dt className="text-muted-foreground">Motivation</dt>
                          <dd className="whitespace-pre-line">{row.motivation}</dd>
                          <dt className="text-muted-foreground">Expected outcome</dt>
                          <dd>{row.expectedOutcome}</dd>
                          <dt className="text-muted-foreground">Linked programme</dt>
                          <dd>{row.linkedProgramme ?? "—"}</dd>
                          <dt className="text-muted-foreground">Submitted by</dt>
                          <dd>{row.createdByName}</dd>
                          <dt className="text-muted-foreground">Supporting documents</dt>
                          <dd>{row.attachmentCount}</dd>
                          <dt className="text-muted-foreground">DSAC response</dt>
                          <dd>{row.decisionNote ?? <span className="text-muted-foreground">No response yet</span>}</dd>
                        </dl>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={noteFor !== null} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{noteFor?.action.kind === "respond" ? "Provide the information DSAC asked for" : noteFor?.action.kind === "decision" && noteFor.action.action === "DECLINE" ? "Decline this request" : "Ask for more information"}</DialogTitle>
            <DialogDescription>{noteFor?.row.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="request-note">{noteFor?.action.kind === "respond" ? "Your response" : "Note to the entity"}</Label>
            <Textarea id="request-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              disabled={!note.trim() || busy !== null}
              onClick={async () => {
                if (!noteFor) return;
                const { row, action } = noteFor;
                await run(
                  row.id,
                  () => (action.kind === "respond" ? post(`/api/requests/${row.id}/respond`, { note }) : post(`/api/requests/${row.id}/decision`, { action: action.action, note })),
                  action.kind === "respond" ? "Sent back to DSAC." : action.action === "DECLINE" ? "Request declined." : "More information requested.",
                );
                setNoteFor(null);
              }}
            >
              {busy !== null && <Loader2Icon className="animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
