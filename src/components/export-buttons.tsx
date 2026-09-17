"use client";

import { Button } from "@/components/ui/button";
import { FileSpreadsheetIcon, FileDownIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { SECTOR_LABELS, ENTITY_TYPE_LABELS } from "@/lib/constants";
import { RISK_BAND_VISUALS } from "@/lib/risk-visuals";
import type { PortfolioEntityRow } from "@/lib/data/portfolio";

export function ExportButtons({
  rows,
  financialYearLabel,
}: {
  rows: PortfolioEntityRow[];
  financialYearLabel: string;
}) {
  const searchParams = useSearchParams();

  async function exportPdf() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`DSAC Portfolio Overview — FY ${financialYearLabel}`, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Demo – synthetic data", 14, 21);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 26,
      head: [["Entity", "Sector", "Type", "Risk", "KPIs achieved", "Utilisation", "Compliance"]],
      body: rows.map((r) => [
        r.name,
        SECTOR_LABELS[r.sector],
        ENTITY_TYPE_LABELS[r.type],
        RISK_BAND_VISUALS[r.riskBand].label,
        `${r.kpiStatusCounts.ACHIEVED}/${r.totalKpis}`,
        r.utilisationRate !== null ? `${Math.round(r.utilisationRate * 100)}%` : "—",
        r.complianceRate !== null ? `${Math.round(r.complianceRate * 100)}%` : "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [10, 92, 54] },
    });
    doc.save(`dsac-portfolio-${financialYearLabel.replace("/", "-")}.pdf`);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" render={<a href={`/api/export/portfolio?${searchParams.toString()}`} download />}>
        <FileSpreadsheetIcon />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={exportPdf}>
        <FileDownIcon />
        PDF
      </Button>
    </div>
  );
}
