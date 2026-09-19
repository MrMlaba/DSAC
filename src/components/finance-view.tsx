import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { FinanceTable } from "@/components/finance-table";
import { FinanceFlow } from "@/components/finance-flow";
import { ExpenditureCaptureForm, type CaptureLine } from "@/components/expenditure-capture-form";
import { MagnitudeBar } from "@/components/proportion-bar";
import { canCaptureReportingData } from "@/lib/constants";
import { formatDate, formatPercent, formatRand, formatRandCompact } from "@/lib/format";
import { editableQuarter } from "@/lib/capture-quarter";
import { now } from "@/lib/clock";
import { FINANCE_QUARTERS } from "@/lib/calc/finance";
import { sumMoney } from "@/lib/calc/money";
import { getEvidenceIndex } from "@/lib/data/evidence";
import type { CurrentUser } from "@/lib/tenant-scope";
import type { EntityContext } from "@/lib/data/entity-view";

/** The Finance tab — identical on the DSAC side and in the entity portal. Only the entity can capture. */
export async function FinanceView({ ctx, user }: { ctx: EntityContext; user: CurrentUser }) {
  const { metrics, entity, selectedFinancialYear } = ctx;
  const { lines, summary, latestQuarter, disbursements } = metrics.finance;
  const evidence = await getEvidenceIndex(user, entity.id, selectedFinancialYear.id);
  const evidenceByLine = Object.fromEntries([...evidence.byBudgetLine.entries()].map(([id, items]) => [id, items.map((i) => ({ id: i.id, title: i.title }))]));

  const canCapture = canCaptureReportingData(user.role) && user.entityId === entity.id;
  const open = canCapture ? editableQuarter(metrics.compliance.reports, "QUARTERLY_FINANCIAL", selectedFinancialYear.startDate, now()) : null;
  let captureLines: CaptureLine[] = [];
  if (open) {
    const earlier = FINANCE_QUARTERS.slice(0, FINANCE_QUARTERS.indexOf(open.quarter));
    captureLines = lines.map((line) => ({
      id: line.id,
      category: line.category,
      annualBudget: line.annualBudget,
      priorActual: sumMoney(earlier.map((q) => line.quarters.find((b) => b.quarter === q)?.amount ?? 0)),
      amount: line.quarters.find((b) => b.quarter === open.quarter)?.amount ?? null,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Approved annual budget" value={formatRandCompact(summary.approved)} exact={formatRand(summary.approved)} hint={`FY ${selectedFinancialYear.label} · sum of ${lines.length} budget lines`} />
        <StatCard label="Amount disbursed" value={formatRandCompact(summary.disbursed)} exact={formatRand(summary.disbursed)} hint={`${formatPercent(summary.disbursementRate)} of approved · ${formatRandCompact(summary.undisbursed)} not yet released`} />
        <StatCard label="Actual expenditure to date" value={formatRandCompact(summary.utilised)} exact={formatRand(summary.utilised)} hint={latestQuarter ? `Cumulative to ${latestQuarter}` : "Nothing reported yet"} />
        <StatCard label="Budget utilisation" value={formatPercent(summary.budgetUtilisation)} hint="Actual ÷ approved budget">
          <MagnitudeBar value={summary.budgetUtilisation ?? 0} color="var(--chart-2)" />
        </StatCard>
        <StatCard label="Utilisation of disbursed funds" value={formatPercent(summary.fundUtilisation)} hint="Actual ÷ amount disbursed">
          <MagnitudeBar value={summary.fundUtilisation ?? 0} color="var(--chart-3)" />
        </StatCard>
      </div>

      {canCapture && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{open ? `Report ${open.quarter} expenditure` : "Capture expenditure"}</CardTitle>
            <CardDescription>
              {open
                ? "Enter only what was spent this quarter on each line. The system adds it to earlier quarters against the same annual budget."
                : "Every quarter that has started has been submitted, so its figures are locked. The next quarter opens for capture when it begins."}
            </CardDescription>
          </CardHeader>
          {open && (
            <CardContent>
              <ExpenditureCaptureForm entityId={entity.id} financialYearId={selectedFinancialYear.id} quarter={open.quarter} lines={captureLines} returnedComment={open.report.status === "RETURNED" ? open.report.reviewComment : null} />
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Annual budget vs actual expenditure to date</CardTitle>
          <CardDescription>By expense line, FY {selectedFinancialYear.label}. Select a line to see the quarterly entries behind its figure.</CardDescription>
        </CardHeader>
        <CardContent>{lines.length === 0 ? <p className="text-muted-foreground text-sm">No approved budget has been loaded for this financial year.</p> : <FinanceTable lines={lines} summary={summary} evidence={evidenceByLine} attachHrefBase={canCapture ? "/documents?link=line:" : undefined} />}</CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approved → Disbursed → Utilised</CardTitle>
            </CardHeader>
            <CardContent>
              <FinanceFlow summary={summary} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disbursements</CardTitle>
              <CardDescription>Tranches DSAC has released so far.</CardDescription>
            </CardHeader>
            <CardContent>
              {disbursements.length === 0 ? (
                <p className="text-muted-foreground text-sm">No funds have been disbursed for this year yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tranche</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disbursements.map((d) => (
                      <TableRow key={d.tranche}>
                        <TableCell>{d.tranche}</TableCell>
                        <TableCell>{formatDate(d.disbursedAt)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRand(d.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell colSpan={2}>Total disbursed</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRand(summary.disbursed)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
