import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUser } from "@/lib/current-user";
import { getPortfolio } from "@/lib/data/portfolio";
import { resolveFinancialYear } from "@/lib/data/financial-years";
import { toExportRows } from "@/lib/data/export-rows";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const { selected } = await resolveFinancialYear(request.nextUrl.searchParams.get("fy") ?? undefined);
  const { rows, summary } = await getPortfolio(user, selected.id);
  const exportRows = toExportRows(rows);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DSAC Reporting and Oversight Platform (Demo)";
  const sheet = workbook.addWorksheet(`FY ${selected.label.replace("/", "-")}`.slice(0, 31));

  sheet.columns = [
    { header: "Organisation", key: "name", width: 40 },
    { header: "Type", key: "type", width: 16 },
    { header: "Sector", key: "sector", width: 14 },
    { header: "Compliance", key: "compliance", width: 20 },
    { header: "Compliance rate", key: "complianceRate", width: 16 },
    { header: "Performance", key: "performance", width: 14 },
    { header: "Overall performance", key: "overallPerformance", width: 18 },
    { header: "Approved budget (R)", key: "approved", width: 20 },
    { header: "Disbursed (R)", key: "disbursed", width: 18 },
    { header: "Utilised (R)", key: "utilised", width: 18 },
    { header: "Budget utilisation", key: "budgetUtilisation", width: 18 },
    { header: "Utilisation of disbursed", key: "fundUtilisation", width: 22 },
    { header: "Reports submitted", key: "reportsSubmitted", width: 17 },
    { header: "Reports outstanding", key: "reportsOutstanding", width: 19 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of exportRows) {
    sheet.addRow({ ...row, complianceRate: row.complianceRate ?? "", overallPerformance: row.overallPerformance ?? "", budgetUtilisation: row.budgetUtilisation ?? "", fundUtilisation: row.fundUtilisation ?? "" });
  }

  // Totals come from the same pooled portfolio figures as the dashboard, not from re-adding the rows above.
  const totals = sheet.addRow({
    name: "PORTFOLIO TOTAL",
    approved: summary.finance.approved,
    disbursed: summary.finance.disbursed,
    utilised: summary.finance.utilised,
    budgetUtilisation: summary.finance.budgetUtilisation ?? "",
    fundUtilisation: summary.finance.fundUtilisation ?? "",
    complianceRate: summary.compliance.rate ?? "",
    overallPerformance: summary.performance.overall ?? "",
    reportsSubmitted: summary.compliance.submitted,
    reportsOutstanding: summary.compliance.outstanding,
  });
  totals.font = { bold: true };

  for (const key of ["complianceRate", "overallPerformance", "budgetUtilisation", "fundUtilisation"]) sheet.getColumn(key).numFmt = "0.0%";
  for (const key of ["approved", "disbursed", "utilised"]) sheet.getColumn(key).numFmt = "#,##0";

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dsac-portfolio-${selected.label.replace("/", "-")}.xlsx"`,
    },
  });
}
