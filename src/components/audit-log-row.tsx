"use client";

import { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  user: { name: string; email: string } | null;
  entity: { name: string } | null;
}

export function AuditLogRow({ log }: { log: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasDetails = log.before !== null || log.after !== null || !!log.ipAddress;

  return (
    <>
      <TableRow>
        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString("en-ZA")}</TableCell>
        <TableCell className="text-xs">{log.user ? log.user.name : "System"}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[10px]">
            {log.action}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">{log.entity?.name ?? "—"}</TableCell>
        <TableCell className="text-muted-foreground max-w-40 truncate text-xs">
          {log.targetType}
          {log.targetId ? `:${log.targetId.slice(0, 8)}…` : ""}
        </TableCell>
        <TableCell className="text-right">
          {hasDetails && (
            <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
              View
            </Button>
          )}
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{log.action}</DialogTitle>
            <DialogDescription>
              {new Date(log.createdAt).toLocaleString("en-ZA")} · {log.user?.name ?? "System"}
              {log.ipAddress ? ` · ${log.ipAddress}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {log.before !== null && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Before</p>
                <pre className="bg-muted max-h-48 overflow-auto rounded-lg p-2 text-xs whitespace-pre-wrap">
                  {JSON.stringify(log.before, null, 2)}
                </pre>
              </div>
            )}
            {log.after !== null && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">After</p>
                <pre className="bg-muted max-h-48 overflow-auto rounded-lg p-2 text-xs whitespace-pre-wrap">
                  {JSON.stringify(log.after, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
