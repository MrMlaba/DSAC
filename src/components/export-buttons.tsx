"use client";

import { Button } from "@/components/ui/button";
import { FileSpreadsheetIcon, FileDownIcon } from "lucide-react";
import { formatPercent, formatRand } from "@/lib/format";
import type { ExportRow } from "@/lib/data/export-rows";

export function ExportButtons({ rows, financialYearId, financialYearLabel }: { rows: ExportRow[]; financialYearId: string; financialYearLabel: string }) {
  async function exportPdf() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`DSAC Portfolio — FY ${financialYearLabel}`, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Demo – synthetic data", 14, 21);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 26,
      head: [["Organisation", "Type", "Compliance", "Performance", "Approved", "Disbursed", "Utilised", "Budget util.", "Fund util."]],
      body: rows.map((r) => [r.name, r.type, r.compliance, r.performance, formatRand(r.approved), formatRand(r.disbursed), formatRand(r.utilised), formatPercent(r.budgetUtilisation), formatPercent(r.fundUtilisation)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [10, 92, 54] },
    });
    doc.save(`dsac-portfolio-${financialYearLabel.replace("/", "-")}.pdf`);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" render={<a href={`/api/export/portfolio?fy=${financialYearId}`} download />}>
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
