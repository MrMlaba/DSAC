import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/current-user";
import { canViewAuditLog } from "@/lib/constants";
import { listAuditLogs, listDistinctAuditActions } from "@/lib/data/audit";
import { listDeletedDocuments, listEntityOptions } from "@/lib/data/documents";
import { AuditLogFilters } from "@/components/audit-log-filters";
import { AuditLogRow } from "@/components/audit-log-row";
import { DeletedDocumentsList } from "@/components/deleted-documents-list";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!canViewAuditLog(user.role)) redirect("/dashboard");

  const resolved = await searchParams;
  const action = typeof resolved.action === "string" ? resolved.action : undefined;
  const entityId = typeof resolved.entity === "string" ? resolved.entity : undefined;
  const days = typeof resolved.days === "string" ? parseInt(resolved.days, 10) : undefined;
  const from = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;

  const [logs, actions, entities, deletedDocuments] = await Promise.all([
    listAuditLogs({ action, entityId, from }),
    listDistinctAuditActions(),
    listEntityOptions(user),
    listDeletedDocuments(user),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          Append-only record of document views, downloads, review decisions, deletions, and every AI interaction. DSAC Admin only.
        </p>
      </div>

      {deletedDocuments.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <DeletedDocumentsList documents={deletedDocuments} />
          </CardContent>
        </Card>
      )}

      <AuditLogFilters actions={actions} entities={entities} />

      <Card>
        <CardContent className="pt-4">
          {logs.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No audit log entries match the current filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <AuditLogRow
                    key={log.id}
                    log={{
                      ...log,
                      createdAt: log.createdAt.toISOString(),
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
