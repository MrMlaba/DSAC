import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { ComplianceBadge, EntityComplianceBadge } from "@/components/status-badge";
import { MagnitudeBar } from "@/components/proportion-bar";
import { COMPLIANCE_COLOURS } from "@/lib/risk-visuals";
import { REPORT_KIND_LABELS } from "@/lib/reporting-calendar";
import { formatDate, formatPercent } from "@/lib/format";
import type { EntityContext } from "@/lib/data/entity-view";

function dueText(days: number, state: string): string {
  if (state === "COMPLIANT" || state === "LATE_SUBMISSION" || state === "RETURNED") return "";
  if (days < 0) return `overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "due today";
  return `due in ${days} day${days === 1 ? "" : "s"}`;
}

/** The Compliance tab: every required submission, its due date, when it was submitted, and a green / amber / red status. */
export function ComplianceView({ ctx }: { ctx: EntityContext }) {
  const { metrics, selectedFinancialYear } = ctx;
  const { reports, summary } = metrics.compliance;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Compliance status" value={<EntityComplianceBadge status={summary.status} />} hint="Worst status across this year's requirements" />
        <StatCard label="Compliance rate" value={formatPercent(summary.rate)} hint={`${summary.compliant} of ${summary.assessed} reports assessed were delivered on time`}>
          <MagnitudeBar value={summary.rate ?? 0} color="var(--status-good)" />
        </StatCard>
        <StatCard label="Overdue" value={summary.overdue} hint="Past due with nothing submitted" />
        <StatCard label="Due soon / returned" value={summary.dueSoon + summary.returned} hint={`${summary.dueSoon} due soon · ${summary.returned} returned for correction`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance requirements — FY {selectedFinancialYear.label}</CardTitle>
          <CardDescription>
            <span className="inline-flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: COMPLIANCE_COLOURS.green }} /> Compliant
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: COMPLIANCE_COLOURS.amber }} /> Due soon / attention required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: COMPLIANCE_COLOURS.red }} /> Overdue
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: COMPLIANCE_COLOURS.neutral }} /> Not due yet
              </span>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compliance requirement</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Submission date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {REPORT_KIND_LABELS[r.kind]}
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">{r.quarter === "ANNUAL" ? `FY ${selectedFinancialYear.label}` : r.quarter}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(r.dueDate)}</TableCell>
                  <TableCell className="tabular-nums">{r.submittedAt ? formatDate(r.submittedAt) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <ComplianceBadge state={r.compliance.state} colour={r.compliance.colour} />
                      <span className="text-muted-foreground text-xs">{dueText(r.compliance.daysUntilDue, r.compliance.state)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-muted-foreground mt-3 text-xs">
            Each requirement is a report. Amber also covers reports submitted late; open the Reports section for the full submission and review history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
