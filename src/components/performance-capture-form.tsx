"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KpiStatusBadge } from "@/components/status-badge";
import { formatKpiValue, formatPercent } from "@/lib/format";
import { kpiStatusFromAchievement } from "@/lib/calc/performance";
import { ratio } from "@/lib/calc/money";

export interface CaptureKpi {
  id: string;
  name: string;
  programme: string;
  unit: string;
  aggregation: "SUM" | "LATEST";
  periodTarget: number | null;
  /** Year-to-date target through the quarter being reported. */
  ytdTarget: number;
  /** Sum of the earlier quarters' actuals (for cumulative KPIs). */
  priorActual: number;
  actual: number | null;
  reason: string;
  action: string;
}

/**
 * The entity enters only THIS quarter's result for each KPI. Year-to-date, variance and
 * achievement are calculated from it — the same calc library the DSAC screens use.
 */
export function PerformanceCaptureForm({
  entityId,
  financialYearId,
  quarter,
  kpis,
  returnedComment,
}: {
  entityId: string;
  financialYearId: string;
  quarter: string;
  kpis: CaptureKpi[];
  returnedComment?: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(() => Object.fromEntries(kpis.map((k) => [k.id, { actual: k.actual === null ? "" : String(k.actual), reason: k.reason, action: k.action }])));

  const set = (id: string, patch: Partial<{ actual: string; reason: string; action: string }>) => setValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  async function save() {
    const entries = kpis
      .filter((k) => values[k.id].actual.trim() !== "" && !Number.isNaN(Number(values[k.id].actual)))
      .map((k) => ({ kpiId: k.id, actual: Number(values[k.id].actual), varianceExplanation: values[k.id].reason.trim() || undefined, correctiveAction: values[k.id].action.trim() || undefined }));
    if (entries.length === 0) {
      toast.error("Enter at least one KPI result first.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/performance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityId, financialYearId, quarter, entries }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      toast.success(`${data.saved} KPI result(s) saved — dashboards updated.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {returnedComment && (
        <div className="rounded-lg border border-[var(--status-serious)]/40 bg-[var(--status-serious)]/10 p-3 text-sm">
          <p className="font-medium">DSAC returned this report for correction</p>
          <p className="text-muted-foreground">{returnedComment}</p>
        </div>
      )}
      <div className="space-y-3">
        {kpis.map((kpi) => {
          const v = values[kpi.id];
          const entered = v.actual.trim() !== "" && !Number.isNaN(Number(v.actual));
          const actualNow = entered ? Number(v.actual) : null;
          const ytdActual = actualNow === null ? null : kpi.aggregation === "SUM" ? kpi.priorActual + actualNow : actualNow;
          const achievement = ytdActual === null ? null : kpi.ytdTarget > 0 ? ratio(ytdActual, kpi.ytdTarget) : null;
          const status = achievement === null ? null : kpiStatusFromAchievement(achievement);
          const needsReason = status === "AT_RISK" || status === "NOT_ACHIEVED";
          return (
            <div key={kpi.id} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,1.3fr)_9rem_minmax(0,1.6fr)]">
              <div className="min-w-0">
                <p className="text-sm font-medium">{kpi.name}</p>
                <p className="text-muted-foreground text-xs">
                  {kpi.programme} · {quarter} target {formatKpiValue(kpi.periodTarget, kpi.unit)} · target to date {formatKpiValue(kpi.ytdTarget, kpi.unit)}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Actual to date</span>
                  <span className="font-medium tabular-nums">{formatKpiValue(ytdActual, kpi.unit)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium tabular-nums">{formatPercent(achievement)}</span>
                  <KpiStatusBadge status={status} />
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs" htmlFor={`actual-${kpi.id}`}>
                  {quarter} result{kpi.unit === "%" ? " (%)" : ""}
                </label>
                <Input id={`actual-${kpi.id}`} inputMode="decimal" value={v.actual} onChange={(e) => set(kpi.id, { actual: e.target.value })} placeholder="0" className="tabular-nums" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Textarea rows={2} value={v.reason} onChange={(e) => set(kpi.id, { reason: e.target.value })} placeholder={needsReason ? "Reason for variance (required)" : "Reason for variance (if any)"} aria-invalid={needsReason && !v.reason.trim()} />
                <Textarea rows={2} value={v.action} onChange={(e) => set(kpi.id, { action: e.target.value })} placeholder="Corrective action" />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Save {quarter} results
        </Button>
        <p className="text-muted-foreground text-xs">
          Saving updates your dashboards and DSAC&apos;s view straight away. When every KPI is complete, submit the report from the{" "}
          <Link href="/reports" className="text-primary hover:underline">
            Reports
          </Link>{" "}
          page.
        </p>
      </div>
    </div>
  );
}
