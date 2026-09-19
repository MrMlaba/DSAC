import { prisma } from "@/lib/prisma";
import { trainLogisticRegression, predict } from "@/lib/ml/logistic-regression";
import { now } from "@/lib/clock";
import { computeEntityMetrics, type EntityFyMetrics } from "@/lib/data/metrics";
import { meanCappedAchievement } from "@/lib/calc/performance";
import { formatPercent } from "@/lib/format";
import type { RiskBand } from "@prisma/client";

/**
 * Transparent weighted model — the primary, explainable score. Weights are fixed constants
 * (not learned) so every score traces back to named factors for the "why am I seeing this?"
 * view. Every input comes from computeEntityMetrics(), so the risk score is built from exactly
 * the same finance, performance and compliance figures the dashboards show.
 */
const WEIGHTS = {
  progressGap: 0.25,
  latenessRate: 0.2,
  auditRisk: 0.2,
  returnedReports: 0.15,
  deadlineProximity: 0.1,
  spendDeliveryMismatch: 0.1,
} as const;

const SEVERITY_WEIGHT: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export interface RiskFactor {
  key: keyof typeof WEIGHTS;
  label: string;
  /** 0-1, this factor's own severity before weighting. */
  rawValue: number;
  /** rawValue * weight * 100 — this factor's share of the 0-100 score. */
  contribution: number;
  detail: string;
}

export interface EntityRiskResult {
  entityId: string;
  score: number;
  band: RiskBand;
  factors: RiskFactor[];
  /** From the trained model — see trainRiskModels(). Illustrative, not production-grade. */
  probabilityMissTarget: number;
  probabilityLateSubmission: number;
}

export function bandForScore(score: number): RiskBand {
  if (score < 20) return "LOW";
  if (score < 40) return "MEDIUM";
  if (score < 60) return "HIGH";
  return "CRITICAL";
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Share of reports assessed so far that were late or are still owed. 0 when nothing has been assessed. */
function latenessOf(m: EntityFyMetrics): number {
  const rate = m.compliance.summary.rate;
  return rate === null ? 0 : clamp01(1 - rate);
}

/** Share of KPIs (with a target due) that are not on track. */
function kpiBehindRateOf(m: EntityFyMetrics): number {
  const overall = m.performance.summary.overall;
  return overall === null ? 0 : clamp01(1 - overall);
}

/** Share of the annual delivery target completed, over cumulative-count KPIs only (rates don't accumulate). */
function annualDeliveryOf(m: EntityFyMetrics): number | null {
  const counts = m.performance.kpis.filter((k) => k.aggregation === "SUM" && k.result && k.result.annualProgress !== null);
  if (counts.length === 0) return null;
  return counts.reduce((sum, k) => sum + Math.min(1, k.result!.annualProgress!), 0) / counts.length;
}

/** 1.0 = a report is overdue, tapering to 0 as the nearest owed report gets further away. */
function deadlineUrgencyOf(m: EntityFyMetrics): number {
  let urgency = 0;
  for (const report of m.compliance.reports) {
    if (report.status !== "DRAFT" && report.status !== "RETURNED") continue;
    const days = report.compliance.daysUntilDue;
    if (days < 0) urgency = Math.max(urgency, 1);
    else if (days <= 15) urgency = Math.max(urgency, 0.8);
    else if (days <= 30) urgency = Math.max(urgency, 0.4);
  }
  return urgency;
}

async function unresolvedAuditScoreByEntity(): Promise<Map<string, number>> {
  const findings = await prisma.auditFinding.findMany({ where: { status: { not: "RESOLVED" } }, select: { entityId: true, severity: true } });
  const scores = new Map<string, number>();
  for (const f of findings) scores.set(f.entityId, (scores.get(f.entityId) ?? 0) + (SEVERITY_WEIGHT[f.severity] ?? 1));
  return scores;
}

const auditRiskOf = (score: number) => clamp01(score / 8); // 8 ~= two unresolved CRITICAL findings

/**
 * Trains two small logistic regression models on this platform's own history: each entity's
 * behaviour in one completed year is used to predict what happened in the next completed year
 * (P(late submissions) and P(miss targets)). Deliberately simple — three proportions as
 * features, no cross-validation — this illustrates a trained-model layer sitting alongside the
 * transparent weighted score, not a production-grade forecasting system.
 */
async function trainRiskModels(completedFyIds: string[], audit: Map<string, number>) {
  const features: number[][] = [];
  const lateLabels: number[] = [];
  const missLabels: number[] = [];

  for (let i = 0; i < completedFyIds.length - 1; i++) {
    const [from, to] = await Promise.all([
      computeEntityMetrics({ financialYearId: completedFyIds[i] }),
      computeEntityMetrics({ financialYearId: completedFyIds[i + 1] }),
    ]);
    for (const [entityId, before] of from) {
      const after = to.get(entityId);
      if (!after || before.compliance.summary.assessed === 0 || after.compliance.summary.assessed === 0) continue;
      features.push([latenessOf(before), kpiBehindRateOf(before), auditRiskOf(audit.get(entityId) ?? 0)]);
      lateLabels.push((after.compliance.summary.rate ?? 1) < 0.75 ? 1 : 0);
      missLabels.push((after.performance.summary.overall ?? 1) < 0.5 ? 1 : 0);
    }
  }

  return {
    lateModel: features.length >= 4 ? trainLogisticRegression(features, lateLabels) : null,
    missModel: features.length >= 4 ? trainLogisticRegression(features, missLabels) : null,
  };
}

/**
 * Computes an explainable risk score for every entity in one pass, plus ML-based miss/late
 * probabilities. Both the on-demand "recalculate" path and the scheduled job call this.
 */
export async function computeAllEntityRisk(): Promise<EntityRiskResult[]> {
  const today = now();
  const financialYears = await prisma.financialYear.findMany({ orderBy: { startDate: "asc" } });
  const currentFy = financialYears.find((fy) => fy.startDate <= today && today.getTime() <= fy.endDate.getTime() + 86_400_000) ?? financialYears.at(-1);
  if (!currentFy) return [];
  const completedFyIds = financialYears.filter((fy) => fy.endDate < today && fy.id !== currentFy.id).map((fy) => fy.id);

  const audit = await unresolvedAuditScoreByEntity();
  const [current, { lateModel, missModel }, entities] = await Promise.all([
    computeEntityMetrics({ financialYearId: currentFy.id, today }),
    trainRiskModels(completedFyIds, audit),
    prisma.entity.findMany({ select: { id: true } }),
  ]);

  const results: EntityRiskResult[] = [];
  for (const { id: entityId } of entities) {
    const m = current.get(entityId);
    if (!m) continue;

    const achievement = meanCappedAchievement(m.performance.kpis.map((k) => ({ achievement: k.result?.achievement ?? null, status: k.result?.status ?? null })));
    const progressGap = achievement === null ? 0 : clamp01(1 - achievement);
    const latenessRate = latenessOf(m);
    const unresolvedAuditScore = audit.get(entityId) ?? 0;
    const auditRisk = auditRiskOf(unresolvedAuditScore);
    const cs = m.compliance.summary;
    const reachedDsac = cs.submitted + cs.returned;
    const returnedRate = reachedDsac > 0 ? cs.returned / reachedDsac : 0;
    const deadlineProximity = deadlineUrgencyOf(m);
    const delivery = annualDeliveryOf(m);
    const spent = m.finance.summary.budgetUtilisation;
    const spendDeliveryMismatch = delivery === null || spent === null ? 0 : clamp01(Math.abs(spent - delivery));

    const factors: RiskFactor[] = [
      {
        key: "progressGap",
        label: "Behind on KPI targets",
        rawValue: progressGap,
        contribution: progressGap * WEIGHTS.progressGap * 100,
        detail: achievement === null ? "No KPI targets have fallen due yet." : `KPIs are at ${formatPercent(achievement)} of their year-to-date targets on average (each capped at 100%).`,
      },
      {
        key: "latenessRate",
        label: "Late or outstanding reports",
        rawValue: latenessRate,
        contribution: latenessRate * WEIGHTS.latenessRate * 100,
        detail: cs.assessed === 0 ? "No reports have fallen due yet." : `${cs.assessed - cs.compliant} of ${cs.assessed} reports assessed this year were late, returned or are still outstanding (${formatPercent(cs.rate)} compliance).`,
      },
      {
        key: "auditRisk",
        label: "Unresolved audit findings",
        rawValue: auditRisk,
        contribution: auditRisk * WEIGHTS.auditRisk * 100,
        detail: `Unresolved audit finding severity score: ${unresolvedAuditScore}.`,
      },
      {
        key: "returnedReports",
        label: "Reports returned by DSAC",
        rawValue: returnedRate,
        contribution: returnedRate * WEIGHTS.returnedReports * 100,
        detail: reachedDsac > 0 ? `${cs.returned} of ${reachedDsac} reports that reached DSAC are currently returned for correction.` : "No reports have reached DSAC yet.",
      },
      {
        key: "deadlineProximity",
        label: "Upcoming or overdue deadlines",
        rawValue: deadlineProximity,
        contribution: deadlineProximity * WEIGHTS.deadlineProximity * 100,
        detail: deadlineProximity > 0 ? `${cs.overdue} report(s) overdue and ${cs.dueSoon} due soon.` : "No imminent or overdue deadlines outstanding.",
      },
      {
        key: "spendDeliveryMismatch",
        label: "Spend vs. delivery mismatch",
        rawValue: spendDeliveryMismatch,
        contribution: spendDeliveryMismatch * WEIGHTS.spendDeliveryMismatch * 100,
        detail:
          delivery === null || spent === null
            ? "Not enough data to compare spend with delivery."
            : `${formatPercent(spent)} of the approved budget is spent, against ${formatPercent(delivery)} of annual delivery targets — a wide gap suggests spend isn't translating into delivery, or vice versa.`,
      },
    ];

    const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.contribution, 0))));
    const mlFeatures = [latenessRate, kpiBehindRateOf(m), auditRisk];

    results.push({
      entityId,
      score,
      band: bandForScore(score),
      factors: factors.sort((a, b) => b.contribution - a.contribution),
      probabilityMissTarget: clamp01(missModel ? predict(missModel, mlFeatures) : progressGap),
      probabilityLateSubmission: clamp01(lateModel ? predict(lateModel, mlFeatures) : latenessRate),
    });
  }

  return results;
}

/** Recomputes and persists a fresh RiskScore row for every entity. */
export async function recalculateAllRiskScores(): Promise<number> {
  const results = await computeAllEntityRisk();
  await prisma.$transaction(
    results.map((r) =>
      prisma.riskScore.create({
        data: {
          entityId: r.entityId,
          score: r.score,
          band: r.band,
          factors: {
            factors: r.factors.map((f) => ({ key: f.key, label: f.label, contribution: Math.round(f.contribution), detail: f.detail })),
            probabilityMissTarget: r.probabilityMissTarget,
            probabilityLateSubmission: r.probabilityLateSubmission,
            model: "weighted-v2 + logistic-regression-v2",
          },
        },
      }),
    ),
  );
  return results.length;
}
