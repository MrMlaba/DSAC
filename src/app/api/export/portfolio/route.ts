import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUser } from "@/lib/current-user";
import { getPortfolioData } from "@/lib/data/portfolio";
import { resolvePortfolioFilters } from "@/lib/data/portfolio-filters";
import { SECTOR_LABELS, ENTITY_TYPE_LABELS } from "@/lib/constants";
import { RISK_BAND_VISUALS } from "@/lib/risk-visuals";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { filters, financialYearLabel } = await resolvePortfolioFilters(searchParams);
  const { rows } = await getPortfolioData(user, filters);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DSAC Performance & Reporting Platform (Demo)";
  const sheetName = `FY ${financialYearLabel.replace("/", "-")}`.slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: "Entity", key: "name", width: 40 },
    { header: "Type", key: "type", width: 16 },
    { header: "Sector", key: "sector", width: 14 },
    { header: "Risk band", key: "risk", width: 14 },
    { header: "Risk score", key: "riskScore", width: 12 },
    { header: "KPIs achieved", key: "achieved", width: 14 },
    { header: "KPIs total", key: "total", width: 12 },
    { header: "Fund allocated (R)", key: "allocated", width: 18 },
    { header: "Fund spent (R)", key: "spent", width: 16 },
    { header: "Utilisation", key: "utilisation", width: 12 },
    { header: "Submission compliance", key: "compliance", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow({
      name: row.name,
      type: ENTITY_TYPE_LABELS[row.type],
      sector: SECTOR_LABELS[row.sector],
      risk: RISK_BAND_VISUALS[row.riskBand].label,
      riskScore: row.riskScore ?? "",
      achieved: row.kpiStatusCounts.ACHIEVED,
      total: row.totalKpis,
      allocated: row.fundAllocated,
      spent: row.fundSpent,
      utilisation: row.utilisationRate ?? "",
      compliance: row.complianceRate ?? "",
    });
  }
  sheet.getColumn("utilisation").numFmt = "0%";
  sheet.getColumn("compliance").numFmt = "0%";
  sheet.getColumn("allocated").numFmt = "#,##0";
  sheet.getColumn("spent").numFmt = "#,##0";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dsac-portfolio-${financialYearLabel.replace("/", "-")}.xlsx"`,
    },
  });
}
