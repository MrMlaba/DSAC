"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { formatPercent, formatRand } from "@/lib/format";
import { ratio, sumMoney } from "@/lib/calc/money";

export interface CaptureLine {
  id: string;
  category: string;
  annualBudget: number;
  /** Spent in the quarters before the one being reported. */
  priorActual: number;
  /** This quarter's saved amount, if any. */
  amount: number | null;
}

/**
 * The entity enters only THIS quarter's expenditure per budget line. The system adds it to earlier
 * quarters — the entity never re-enters its budget or earlier quarters.
 */
export function ExpenditureCaptureForm({
  entityId,
  financialYearId,
  quarter,
  lines,
  returnedComment,
}: {
  entityId: string;
  financialYearId: string;
  quarter: string;
  lines: CaptureLine[];
  returnedComment?: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(() => Object.fromEntries(lines.map((l) => [l.id, l.amount === null ? "" : String(l.amount)])));

  const numeric = (id: string) => (values[id].trim() === "" || Number.isNaN(Number(values[id])) ? null : Number(values[id]));

  async function save() {
    const entries = lines.filter((l) => numeric(l.id) !== null).map((l) => ({ budgetLineId: l.id, amount: numeric(l.id) as number }));
    if (entries.length === 0) {
      toast.error("Enter at least one amount first.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/finance/expenditure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityId, financialYearId, quarter, entries }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      toast.success(`${data.saved} line(s) saved — cumulative actuals updated.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const thisQuarterTotal = sumMoney(lines.map((l) => numeric(l.id) ?? 0));

  return (
    <div className="space-y-4">
      {returnedComment && (
        <div className="rounded-lg border border-[var(--status-serious)]/40 bg-[var(--status-serious)]/10 p-3 text-sm">
          <p className="font-medium">DSAC returned this report for correction</p>
          <p className="text-muted-foreground">{returnedComment}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="py-2 pr-3 font-medium">Budget line</th>
              <th className="py-2 pr-3 text-right font-medium">Annual budget</th>
              <th className="py-2 pr-3 text-right font-medium">Spent before {quarter}</th>
              <th className="w-44 py-2 pr-3 font-medium">Spent in {quarter} (R)</th>
              <th className="py-2 pr-3 text-right font-medium">Actual to date</th>
              <th className="py-2 text-right font-medium">Utilisation</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const entered = numeric(line.id);
              const cumulative = sumMoney([line.priorActual, entered ?? 0]);
              const utilisation = ratio(cumulative, line.annualBudget);
              const over = cumulative > line.annualBudget;
              return (
                <tr key={line.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{EXPENSE_CATEGORY_LABELS[line.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? line.category}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatRand(line.annualBudget)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatRand(line.priorActual)}</td>
                  <td className="py-2 pr-3">
                    <Input inputMode="decimal" aria-label={`${quarter} expenditure for ${line.category}`} value={values[line.id]} onChange={(e) => setValues((prev) => ({ ...prev, [line.id]: e.target.value }))} placeholder="0" className="tabular-nums" />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatRand(cumulative)}</td>
                  <td className={`py-2 text-right tabular-nums ${over ? "font-medium text-[var(--status-critical)]" : ""}`}>{formatPercent(utilisation)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="pt-2">Spent in {quarter}</td>
              <td />
              <td />
              <td className="pt-2 tabular-nums">{formatRand(thisQuarterTotal)}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Save {quarter} expenditure
        </Button>
        <p className="text-muted-foreground text-xs">
          When every line is complete, submit the report from the{" "}
          <Link href="/reports" className="text-primary hover:underline">
            Reports
          </Link>{" "}
          page.
        </p>
      </div>
    </div>
  );
}
