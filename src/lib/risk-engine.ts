import { prisma } from "@/lib/prisma";
import { trainLogisticRegression, predict } from "@/lib/ml/logistic-regression";
import type { RiskBand } from "@prisma/client";

/**
 * Transparent weighted model — the primary, explainable score. Weights are
 * fixed constants (not learned) so every score can be traced back to
 * specific, named factors for the "why am I seeing this?" view.
 */
const WEIGHTS = {
  progressGap: 0.25,
  latenessRate: 0.2,
  auditRisk: 0.2,
  returnedDocs: 0.15,
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
  if (score < 25) return "LOW";
  if (score < 50) return "MEDIUM";
  if (score < 75) return "HIGH";
  return "CRITICAL";
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Per-entity, per-financial-year aggregate stats used both as weighted-model
 * inputs and as training features for the logistic regression models below.
 */
async function computeEntityYearStats(financialYearIds: string[]) {
  const [reports, findings, fundAllocations, kpis] = await Promise.all([
    prisma.performanceReport.findMany({
      where: { kpi: { financialYearId: { in: financialYearIds } } },
      select: { isLate: true, kpi: { select: { entityId: true, financialYearId: true } } },
    }),
    prisma.auditFinding.findMany({
      where: { financialYearId: { in: financialYearIds } },
      select: { entityId: true, financialYearId: true, severity: true, status: true },
    }),
    prisma.fundAllocation.findMany({
      where: { financialYearId: { in: financialYearIds } },
      include: { expenditures: { select: { amountSpent: true } } },
    }),
    prisma.kpi.findMany({
      where: { financialYearId: { in: financialYearIds } },
      select: { entityId: true, financialYearId: true, status: true, annualTarget: true, baseline: true },
    }),
  ]);

  type YearStats = {
    lateCount: number;
    totalReports: number;
    unresolvedFindingScore: number;
    hasAdverseOpinion: boolean;
    allocated: number;
    spent: number;
    hadMissedTarget: boolean;
    kpiCount: number;
  };
  const key = (entityId: string, fyId: string) => `${entityId}|${fyId}`;
  const stats = new Map<string, YearStats>();
  const empty = (): YearStats => ({
    lateCount: 0,
    totalReports: 0,
    unresolvedFindingScore: 0,
    hasAdverseOpinion: false,
    allocated: 0,
    spent: 0,
    hadMissedTarget: false,
    kpiCount: 0,
  });
  const get = (entityId: string, fyId: string) => {
    const k = key(entityId, fyId);
    if (!stats.has(k)) stats.set(k, empty());
    return stats.get(k)!;
  };

  for (const r of reports) {
    const s = get(r.kpi.entityId, r.kpi.financialYearId);
    s.totalReports++;
    if (r.isLate) s.lateCount++;
  }
  for (const f of findings) {
    const s = get(f.entityId, f.financialYearId);
    if (f.status !== "RESOLVED") s.unresolvedFindingScore += SEVERITY_WEIGHT[f.severity] ?? 1;
  }
  for (const fa of fundAllocations) {
    const s = get(fa.entityId, fa.financialYearId);
    s.allocated += fa.amountAllocated.toNumber();
    s.spent += fa.expenditures.reduce((sum, e) => sum + e.amountSpent.toNumber(), 0);
  }
  for (const k of kpis) {
    const s = get(k.entityId, k.financialYearId);
    s.kpiCount++;
    if (k.status === "DEADLINE_MISSED") s.hadMissedTarget = true;
  }

  return stats;
}

/**
 * Trains two small logistic regression models on this platform's own
 * synthetic history (one financial year per entity = one training example),
 * predicting P(late submission) and P(miss target) for the *current* year
 * from each entity's year-to-date behaviour. Deliberately simple — three
 * hand-picked features, no leave-one-out validation — this illustrates a
 * trained-model layer sitting alongside the transparent weighted score, not
 * a production-grade forecasting system.
 */
async function trainRiskModels(historicalFyIds: string[]) {
  const stats = await computeEntityYearStats(historicalFyIds);

  const lateFeatures: number[][] = [];
  const lateLabels: number[] = [];
  const missFeatures: number[][] = [];
  const missLabels: number[] = [];

  for (const s of stats.values()) {
    if (s.totalReports === 0) continue;
    const latenessRate = s.lateCount / s.totalReports;
    const utilisationRate = s.allocated > 0 ? s.spent / s.allocated : 0;
    const features = [latenessRate, utilisationRate, s.unresolvedFindingScore];

    lateFeatures.push(features);
    lateLabels.push(latenessRate > 0.5 ? 1 : 0);
    missFeatures.push(features);
    missLabels.push(s.hadMissedTarget ? 1 : 0);
  }

  return {
    lateModel: lateFeatures.length >= 4 ? trainLogisticRegression(lateFeatures, lateLabels) : null,
    missModel: missFeatures.length >= 4 ? trainLogisticRegression(missFeatures, missLabels) : null,
  };
}

/**
 * Computes an explainable risk score for every entity in one pass (shared
 * queries), plus ML-based miss/late probabilities from the trained models.
 * This is the function both the on-demand "recalculate" path and the
 * scheduled job call.
 */
export async function computeAllEntityRisk(): Promise<EntityRiskResult[]> {
  const financialYears = await prisma.financialYear.findMany({ orderBy: { startDate: "asc" } });
  const currentFy = financialYears.at(-1);
  const historicalFyIds = financialYears.slice(0, -1).map((f) => f.id);
  if (!currentFy) return [];

  const [currentStats, allFyStats, { lateModel, missModel }, returnedDocCounts, entities] = await Promise.all([
    computeEntityYearStats([currentFy.id]),
    computeEntityYearStats(financialYears.map((f) => f.id)),
    trainRiskModels(historicalFyIds.length > 0 ? historicalFyIds : [currentFy.id]),
    prisma.document.findMany({
      where: { deletedAt: null },
      select: {
        entityId: true,
        versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { reviewStatus: true } },
      },
    }),
    prisma.entity.findMany({ select: { id: true } }),
  ]);

  // Unresolved audit findings never get seeded against the *current* year (this
  // year's audit hasn't happened yet — that's realistic, not a gap), so audit
  // risk has to look across all years and sum whatever's still unresolved,
  // not just the current year (which would always be zero).
  const unresolvedAuditScoreByEntity = new Map<string, number>();
  for (const [key, s] of allFyStats) {
    const entityId = key.split("|")[0];
    unresolvedAuditScoreByEntity.set(entityId, (unresolvedAuditScoreByEntity.get(entityId) ?? 0) + s.unresolvedFindingScore);
  }

  const returnedByEntity = new Map<string, { returned: number; total: number }>();
  for (const doc of returnedDocCounts) {
    const entry = returnedByEntity.get(doc.entityId) ?? { returned: 0, total: 0 };
    entry.total++;
    if (doc.versions[0]?.reviewStatus === "RETURNED") entry.returned++;
    returnedByEntity.set(doc.entityId, entry);
  }

  // Progress gap: current-year KPIs, actual vs. milestone-to-date expectation.
  const currentKpis = await prisma.kpi.findMany({
    where: { financialYearId: currentFy.id },
    select: {
      entityId: true,
      annualTarget: true,
      baseline: true,
      status: true,
      performanceReports: { orderBy: { submittedAt: "desc" }, take: 1, select: { actualValue: true } },
    },
  });
  const progressByEntity = new Map<string, { gapSum: number; count: number }>();
  for (const kpi of currentKpis) {
    if (kpi.status === "NOT_STARTED") continue;
    const entry = progressByEntity.get(kpi.entityId) ?? { gapSum: 0, count: 0 };
    const target = kpi.annualTarget.toNumber();
    const baseline = kpi.baseline.toNumber();
    const actual = kpi.performanceReports[0]?.actualValue.toNumber() ?? baseline;
    const range = target - baseline;
    const gap = range !== 0 ? clamp01((target - actual) / Math.abs(range)) : 0;
    entry.gapSum += kpi.status === "DEADLINE_MISSED" ? 1 : gap;
    entry.count++;
    progressByEntity.set(kpi.entityId, entry);
  }

  // Nearest open deadline per entity (see src/lib/data/deadlines.ts for the full countdown view).
  const openDeadlineUrgency = await computeDeadlineUrgencyByEntity();

  const results: EntityRiskResult[] = [];
  for (const { id: entityId } of entities) {
    const cs = currentStats.get(`${entityId}|${currentFy.id}`);

    const progress = progressByEntity.get(entityId);
    const progressGap = progress && progress.count > 0 ? progress.gapSum / progress.count : 0;

    const latenessRate = cs && cs.totalReports > 0 ? cs.lateCount / cs.totalReports : 0;
    const unresolvedAuditScore = unresolvedAuditScoreByEntity.get(entityId) ?? 0;
    const auditRisk = clamp01(unresolvedAuditScore / 8); // 8 ~= two unresolved CRITICAL findings
    const returned = returnedByEntity.get(entityId);
    const returnedRate = returned && returned.total > 0 ? returned.returned / returned.total : 0;
    const utilisationRate = cs && cs.allocated > 0 ? cs.spent / cs.allocated : 0;
    const achievementRate = progress && progress.count > 0 ? 1 - progressGap : 0;
    const spendDeliveryMismatch = clamp01(Math.abs(utilisationRate - achievementRate));
    const deadlineProximity = openDeadlineUrgency.get(entityId) ?? 0;

    const factors: RiskFactor[] = [
      {
        key: "progressGap",
        label: "Behind on KPI trajectory",
        rawValue: progressGap,
        contribution: progressGap * WEIGHTS.progressGap * 100,
        detail: `Current-year KPIs are tracking ${Math.round(progressGap * 100)}% behind their expected trajectory, on average.`,
      },
      {
        key: "latenessRate",
        label: "History of late submissions",
        rawValue: latenessRate,
        contribution: latenessRate * WEIGHTS.latenessRate * 100,
        detail: `${Math.round(latenessRate * 100)}% of this entity's performance reports this year were submitted late.`,
      },
      {
        key: "auditRisk",
        label: "Unresolved audit findings",
        rawValue: auditRisk,
        contribution: auditRisk * WEIGHTS.auditRisk * 100,
        detail: `Unresolved audit finding severity score: ${unresolvedAuditScore}.`,
      },
      {
        key: "returnedDocs",
        label: "Documents returned by DSAC",
        rawValue: returnedRate,
        contribution: returnedRate * WEIGHTS.returnedDocs * 100,
        detail: returned
          ? `${returned.returned} of ${returned.total} submitted documents are currently sitting in a returned (not yet fixed) state.`
          : "No documents submitted yet.",
      },
      {
        key: "deadlineProximity",
        label: "Upcoming/overdue deadlines",
        rawValue: deadlineProximity,
        contribution: deadlineProximity * WEIGHTS.deadlineProximity * 100,
        detail:
          deadlineProximity > 0
            ? "At least one reporting deadline is imminent or overdue without a matching submission."
            : "No imminent or overdue deadlines outstanding.",
      },
      {
        key: "spendDeliveryMismatch",
        label: "Spend vs. delivery mismatch",
        rawValue: spendDeliveryMismatch,
        contribution: spendDeliveryMismatch * WEIGHTS.spendDeliveryMismatch * 100,
        detail: `Fund utilisation (${Math.round(utilisationRate * 100)}%) vs. KPI achievement (${Math.round(achievementRate * 100)}%) — a wide gap suggests spend isn't translating into delivery, or vice versa.`,
      },
    ];

    const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0));
    const clampedScore = Math.max(0, Math.min(100, score));

    const mlFeatures = [latenessRate, utilisationRate, unresolvedAuditScore];
    const probabilityLateSubmission = lateModel ? predict(lateModel, mlFeatures) : latenessRate;
    const probabilityMissTarget = missModel ? predict(missModel, mlFeatures) : progressGap;

    results.push({
      entityId,
      score: clampedScore,
      band: bandForScore(clampedScore),
      factors: factors.sort((a, b) => b.contribution - a.contribution),
      probabilityMissTarget: clamp01(probabilityMissTarget),
      probabilityLateSubmission: clamp01(probabilityLateSubmission),
    });
  }

  return results;
}

/** 1.0 = overdue with nothing submitted, tapering to 0 as the nearest open deadline gets further away. */
async function computeDeadlineUrgencyByEntity(): Promise<Map<string, number>> {
  const now = new Date();
  const deadlines = await prisma.deadline.findMany({
    where: { reportingPeriodId: { not: null } },
    select: { reportingPeriodId: true, dueDate: true, category: true },
  });

  const documentsByPeriod = await prisma.document.findMany({
    where: { reportingPeriodId: { not: null }, deletedAt: null },
    select: {
      entityId: true,
      reportingPeriodId: true,
      type: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { reviewStatus: true } },
    },
  });
  const satisfied = new Set<string>(); // `${entityId}|${reportingPeriodId}`
  for (const doc of documentsByPeriod) {
    if (doc.versions[0]?.reviewStatus && doc.versions[0].reviewStatus !== "RETURNED") {
      satisfied.add(`${doc.entityId}|${doc.reportingPeriodId}`);
    }
  }

  const entities = await prisma.entity.findMany({ select: { id: true } });
  const urgencyByEntity = new Map<string, number>();

  for (const { id: entityId } of entities) {
    let maxUrgency = 0;
    for (const d of deadlines) {
      if (satisfied.has(`${entityId}|${d.reportingPeriodId}`)) continue;
      const daysUntilDue = (d.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      let urgency = 0;
      if (daysUntilDue < 0) urgency = 1; // overdue, unmet
      else if (daysUntilDue <= 15) urgency = 0.8;
      else if (daysUntilDue <= 30) urgency = 0.4;
      else urgency = 0;
      maxUrgency = Math.max(maxUrgency, urgency);
    }
    urgencyByEntity.set(entityId, maxUrgency);
  }
  return urgencyByEntity;
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
            model: "weighted-v1 + logistic-regression-v1",
          },
        },
      }),
    ),
  );
  return results.length;
}
