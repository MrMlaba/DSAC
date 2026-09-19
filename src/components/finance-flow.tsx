import { ArrowDownIcon } from "lucide-react";
import { formatPercent, formatRand, formatRandCompact } from "@/lib/format";
import type { FinanceSummary } from "@/lib/calc/finance";

function Row({ label, amount, widthRatio, color, note }: { label: string; amount: number; widthRatio: number; color: string; note: string }) {
  const width = Math.max(0, Math.min(1, widthRatio)) * 100;
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[7rem_1fr_9rem]">
      <span className="text-sm font-medium">{label}</span>
      <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      <div className="col-span-2 flex items-baseline justify-between gap-2 sm:col-span-1 sm:block sm:text-right">
        <p className="text-sm font-semibold tabular-nums" title={formatRand(amount)}>
          {formatRandCompact(amount)}
        </p>
        <p className="text-muted-foreground text-xs">{note}</p>
      </div>
    </div>
  );
}

/** Approved → Disbursed → Utilised, all drawn to the same scale (the approved budget). */
export function FinanceFlow({ summary }: { summary: FinanceSummary }) {
  const scale = summary.approved;
  return (
    <div className="space-y-2" role="group" aria-label="Approved, disbursed and utilised funds">
      <Row label="Approved" amount={summary.approved} widthRatio={1} color="var(--chart-1)" note="approved annual budget" />
      <div className="text-muted-foreground flex items-center gap-2 pl-1 text-xs">
        <ArrowDownIcon className="size-3.5" />
        {formatPercent(summary.disbursementRate)} released by DSAC
      </div>
      <Row label="Disbursed" amount={summary.disbursed} widthRatio={scale > 0 ? summary.disbursed / scale : 0} color="var(--chart-3)" note={`${formatRandCompact(summary.undisbursed)} not yet released`} />
      <div className="text-muted-foreground flex items-center gap-2 pl-1 text-xs">
        <ArrowDownIcon className="size-3.5" />
        {formatPercent(summary.fundUtilisation)} of disbursed funds spent
      </div>
      <Row label="Utilised" amount={summary.utilised} widthRatio={scale > 0 ? summary.utilised / scale : 0} color="var(--chart-2)" note={`${formatPercent(summary.budgetUtilisation)} of approved budget`} />
    </div>
  );
}
