import { ratio } from "./money";
import { isPastDue } from "./compliance";

export type PerfQuarter = "Q1" | "Q2" | "Q3" | "Q4";
export const PERF_QUARTERS: readonly PerfQuarter[] = ["Q1", "Q2", "Q3", "Q4"];

/**
 * SUM    — counts that accumulate through the year (beneficiaries, events). YTD = Q1 + Q2 + …
 * LATEST — rates and scores (a "% compliance" or satisfaction score). YTD = the latest reported value.
 */
export type KpiAggregation = "SUM" | "LATEST";

export type KpiStatus = "ACHIEVED" | "ON_TRACK" | "AT_RISK" | "NOT_ACHIEVED";
export const KPI_STATUS_KEYS: readonly KpiStatus[] = ["ACHIEVED", "ON_TRACK", "AT_RISK", "NOT_ACHIEVED"];

/** Achievement = YTD actual ÷ YTD target. These cut-offs are the only place a KPI status is decided. */
export const KPI_STATUS_THRESHOLDS = { achieved: 1, onTrack: 0.85, atRisk: 0.6 } as const;

export function kpiStatusFromAchievement(achievement: number | null): KpiStatus {
  if (achievement === null) return "NOT_ACHIEVED";
  if (achievement >= KPI_STATUS_THRESHOLDS.achieved) return "ACHIEVED";
  if (achievement >= KPI_STATUS_THRESHOLDS.onTrack) return "ON_TRACK";
  if (achievement >= KPI_STATUS_THRESHOLDS.atRisk) return "AT_RISK";
  return "NOT_ACHIEVED";
}

export interface KpiInput {
  id: string;
  annualTarget: number;
  aggregation: KpiAggregation;
  /** Per-quarter target (the period's own target) and reported actual (the period's own actual). */
  quarters: Record<PerfQuarter, { target: number | null; actual: number | null }>;
}

export interface KpiResult {
  id: string;
  asAt: PerfQuarter;
  annualTarget: number;
  /** Target for the current reporting period alone. */
  periodTarget: number | null;
  /** Actual reported for the current reporting period alone. */
  periodActual: number | null;
  /** Cumulative target through the current period. */
  ytdTarget: number;
  /** Cumulative result through the current period. */
  ytdActual: number;
  /** ytdActual − ytdTarget (negative = behind). */
  variance: number;
  /** ytdActual ÷ ytdTarget. */
  achievement: number | null;
  /** ytdActual ÷ annualTarget. */
  annualProgress: number | null;
  /** null when no target has fallen due yet, so the KPI can't be assessed. */
  status: KpiStatus | null;
  /** True once any actual exists up to the as-at quarter. */
  reported: boolean;
}

function upTo(asAt: PerfQuarter): PerfQuarter[] {
  return PERF_QUARTERS.slice(0, PERF_QUARTERS.indexOf(asAt) + 1);
}

export function calcKpi(input: KpiInput, asAt: PerfQuarter): KpiResult {
  const quarters = upTo(asAt);
  const targets = quarters.map((q) => input.quarters[q].target);
  const actuals = quarters.map((q) => input.quarters[q].actual);

  let ytdTarget: number;
  let ytdActual: number;

  if (input.aggregation === "SUM") {
    ytdTarget = targets.reduce<number>((sum, t) => sum + (t ?? 0), 0);
    ytdActual = actuals.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  } else {
    ytdTarget = [...targets].reverse().find((t) => t !== null) ?? 0;
    ytdActual = [...actuals].reverse().find((a) => a !== null) ?? 0;
  }

  const achievement = ytdTarget > 0 ? ratio(ytdActual, ytdTarget) : null;

  return {
    id: input.id,
    asAt,
    annualTarget: input.annualTarget,
    periodTarget: input.quarters[asAt].target,
    periodActual: input.quarters[asAt].actual,
    ytdTarget,
    ytdActual,
    variance: ytdActual - ytdTarget,
    achievement,
    annualProgress: ratio(ytdActual, input.annualTarget),
    status: ytdTarget > 0 ? kpiStatusFromAchievement(achievement) : null,
    reported: actuals.some((a) => a !== null),
  };
}

export interface PerformanceSummary {
  /** KPIs with a target that has fallen due. */
  assessed: number;
  achieved: number;
  onTrack: number;
  atRisk: number;
  notAchieved: number;
  /** (Achieved + On track) ÷ assessed — the single "Overall performance" definition used everywhere. */
  overall: number | null;
}

export function summarisePerformance(results: readonly Pick<KpiResult, "status">[]): PerformanceSummary {
  const counts = { ACHIEVED: 0, ON_TRACK: 0, AT_RISK: 0, NOT_ACHIEVED: 0 };
  for (const r of results) if (r.status) counts[r.status]++;
  const assessed = counts.ACHIEVED + counts.ON_TRACK + counts.AT_RISK + counts.NOT_ACHIEVED;
  return {
    assessed,
    achieved: counts.ACHIEVED,
    onTrack: counts.ON_TRACK,
    atRisk: counts.AT_RISK,
    notAchieved: counts.NOT_ACHIEVED,
    overall: ratio(counts.ACHIEVED + counts.ON_TRACK, assessed),
  };
}

/** Portfolio roll-up: pool the KPI counts, then take the ratio — not an average of entity percentages. */
export function combinePerformance(entities: readonly PerformanceSummary[]): PerformanceSummary {
  const total = entities.reduce(
    (acc, e) => ({
      assessed: acc.assessed + e.assessed,
      achieved: acc.achieved + e.achieved,
      onTrack: acc.onTrack + e.onTrack,
      atRisk: acc.atRisk + e.atRisk,
      notAchieved: acc.notAchieved + e.notAchieved,
    }),
    { assessed: 0, achieved: 0, onTrack: 0, atRisk: 0, notAchieved: 0 },
  );
  return { ...total, overall: ratio(total.achieved + total.onTrack, total.assessed) };
}

export type PerformanceBand = "ON_TRACK" | "AT_RISK" | "UNDER_TARGET" | "NO_DATA";

export const PERFORMANCE_BAND_THRESHOLDS = { onTrack: 0.7, atRisk: 0.4 } as const;

export function performanceBand(overall: number | null): PerformanceBand {
  if (overall === null) return "NO_DATA";
  if (overall >= PERFORMANCE_BAND_THRESHOLDS.onTrack) return "ON_TRACK";
  if (overall >= PERFORMANCE_BAND_THRESHOLDS.atRisk) return "AT_RISK";
  return "UNDER_TARGET";
}

/** Mean achievement with each KPI capped at 100%, so one over-delivering KPI can't mask a failing one. */
export function meanCappedAchievement(results: readonly Pick<KpiResult, "achievement" | "status">[]): number | null {
  const assessed = results.filter((r) => r.status !== null);
  if (assessed.length === 0) return null;
  const total = assessed.reduce((sum, r) => sum + Math.min(1, r.achievement ?? 0), 0);
  return total / assessed.length;
}

/** The latest quarter whose reporting deadline has passed. */
export function latestDueQuarter(dueDates: Record<PerfQuarter, Date>, today: Date): PerfQuarter | null {
  const due = PERF_QUARTERS.filter((q) => isPastDue(dueDates[q], today));
  return due.at(-1) ?? null;
}

/**
 * The reporting position an entity is assessed at: the later of "the latest quarter that
 * has fallen due" and "the latest quarter it has captured data for". Every screen uses
 * this same rule, so an entity that captures Q2 early is assessed against Q2 targets
 * everywhere at once.
 */
export function assessmentQuarter(dueQuarter: PerfQuarter | null, dataQuarter: PerfQuarter | null): PerfQuarter | null {
  if (!dueQuarter) return dataQuarter;
  if (!dataQuarter) return dueQuarter;
  return PERF_QUARTERS.indexOf(dataQuarter) > PERF_QUARTERS.indexOf(dueQuarter) ? dataQuarter : dueQuarter;
}
