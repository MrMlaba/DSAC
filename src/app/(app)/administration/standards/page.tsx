import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { canAdminister, EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { getDefaultFinancialYear } from "@/lib/data/financial-years";
import { dueSoonWindowDays } from "@/lib/data/metrics";
import { KPI_STATUS_THRESHOLDS, PERFORMANCE_BAND_THRESHOLDS } from "@/lib/calc/performance";
import { annualReportDueDate, quarterlyReportDueDate, REPORT_KIND_LABELS } from "@/lib/reporting-calendar";
import { formatDate, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const KPI_FIELDS: [string, string][] = [
  ["Programme", "The programme the KPI belongs to."],
  ["Objective / outcome", "The strategic objective the programme serves."],
  ["KPI", "The indicator being measured."],
  ["Annual target", "The approved target for the whole year, captured at the start of the financial year."],
  ["Current reporting target", "The target for the current reporting period, and the cumulative (year-to-date) target through it."],
  ["Actual performance", "The result achieved in the current reporting period — the only thing the entity enters each quarter."],
  ["YTD performance", "Cumulative result. Counts add up quarter by quarter; rate KPIs (%, scores) take the latest value."],
  ["Variance", "YTD actual − YTD target. Negative means behind target."],
  ["Status", "Achieved / On Track / At Risk / Not Achieved — decided automatically from achievement (below)."],
  ["Reason for variance", "Required when the KPI is At Risk or Not Achieved."],
  ["Corrective action", "What the entity will do about it."],
  ["Evidence", "Supporting documents linked to the KPI."],
];

const FORMULAS: [string, string, string][] = [
  ["Remaining budget", "Approved annual budget − actual expenditure to date", "Per expense line and in total. Negative = overspent."],
  ["Budget utilisation", "Actual expenditure ÷ approved annual budget", "Used for every expense line, and for the entity's Budget utilisation figure."],
  ["Utilisation of disbursed funds", "Actual expenditure ÷ amount disbursed", "The portfolio's headline Overall utilisation and the entity Finance summary."],
  ["Actual to date", "Sum of every reported quarter's expenditure", "Q2 is added to Q1, Q3 to both, and so on — the entity never re-enters earlier quarters."],
  ["Achievement", "YTD actual ÷ YTD target", "Drives the KPI status."],
  ["Overall performance", "(KPIs Achieved + On Track) ÷ KPIs with a target due", "Same definition for an entity, and — pooled across all KPIs — for the portfolio."],
  ["Compliance rate", "Reports delivered on time ÷ reports assessed", "Assessed = already delivered, or past due."],
  ["Portfolio figures", "Sum the raw amounts and counts across entities first; derive the ratio last", "Never an average of entity percentages, so a R9m NPO does not weigh the same as a R400m agency."],
];

export default async function StandardsPage() {
  const user = await requireUser();
  if (!canAdminister(user.role)) redirect("/dashboard");
  const fy = await getDefaultFinancialYear();
  const start = fy?.startDate ?? new Date(Date.UTC(2026, 3, 1));
  const end = fy?.endDate ?? new Date(Date.UTC(2027, 2, 31));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/administration" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
          <ChevronLeftIcon className="size-3.5" />
          Administration
        </Link>
        <PageHeader title="Reporting standards" description="Every public entity and NPO reports in this same structure, so DSAC can compare organisations and consolidate the portfolio automatically. Attachments are evidence; the structured data is the report." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Standard KPI reporting structure</CardTitle>
          <CardDescription>Programme → Objective → KPI. Set once at the start of the year; each quarter only the latest result is entered.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {KPI_FIELDS.map(([field, description]) => (
                <TableRow key={field}>
                  <TableCell className="w-56 font-medium">{field}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">{description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Standard expense lines</CardTitle>
            <CardDescription>Every entity budgets, and reports expenditure, against these lines. The entity never recreates its budget each quarter.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {Object.values(EXPENSE_CATEGORY_LABELS).map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status rules</CardTitle>
            <CardDescription>The only place a status is decided.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">KPI status (achievement = YTD actual ÷ YTD target)</p>
              <p className="text-muted-foreground">
                Achieved ≥ {formatPercent(KPI_STATUS_THRESHOLDS.achieved)} · On Track ≥ {formatPercent(KPI_STATUS_THRESHOLDS.onTrack)} · At Risk ≥ {formatPercent(KPI_STATUS_THRESHOLDS.atRisk)} · Not Achieved below that.
              </p>
            </div>
            <div>
              <p className="font-medium">Entity performance</p>
              <p className="text-muted-foreground">
                On Track ≥ {formatPercent(PERFORMANCE_BAND_THRESHOLDS.onTrack)} of KPIs achieved or on track · At Risk ≥ {formatPercent(PERFORMANCE_BAND_THRESHOLDS.atRisk)} · Under Target below that.
              </p>
            </div>
            <div>
              <p className="font-medium">Compliance</p>
              <p className="text-muted-foreground">
                Green = compliant · Amber = due within {dueSoonWindowDays()} days, returned for correction, or submitted late · Red = overdue. An entity is Overdue Reporting if any report is red, Attention Required if any is amber, otherwise Compliant.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporting calendar — FY {fy?.label}</CardTitle>
          <CardDescription>Reports are due after each quarter closes. The annual report follows year-end.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Q1</TableHead>
                <TableHead>Q2</TableHead>
                <TableHead>Q3</TableHead>
                <TableHead>Q4</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(["QUARTERLY_PERFORMANCE", "QUARTERLY_FINANCIAL", "GOVERNANCE_RETURN"] as const).map((kind) => (
                <TableRow key={kind}>
                  <TableCell className="font-medium">{REPORT_KIND_LABELS[kind]}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">{kind === "GOVERNANCE_RETURN" ? "15th of the second month after quarter-end" : "Last day of the month after quarter-end"}</TableCell>
                  {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
                    <TableCell key={q} className="tabular-nums">
                      {formatDate(quarterlyReportDueDate(kind, start, q))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">{REPORT_KIND_LABELS.ANNUAL_REPORT}</TableCell>
                <TableCell className="text-muted-foreground" colSpan={5}>
                  {formatDate(annualReportDueDate(end))} — 31 August after year-end
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How every figure is calculated</CardTitle>
          <CardDescription>These formulas are implemented once (src/lib/calc) and used by every dashboard, tab, export and the early-warning model.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Figure</TableHead>
                <TableHead>Formula</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FORMULAS.map(([figure, formula, note]) => (
                <TableRow key={figure}>
                  <TableCell className="font-medium whitespace-normal">{figure}</TableCell>
                  <TableCell className="whitespace-normal">{formula}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">{note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
