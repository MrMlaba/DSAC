import { prisma } from "@/lib/prisma";
import { assertEntityAccess, type CurrentUser } from "@/lib/tenant-scope";
import type { Quarter } from "@prisma/client";

const QUARTER_ORDER: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

export async function getEntityDetail(user: CurrentUser, entityId: string, selectedFinancialYearId?: string) {
  assertEntityAccess(user, entityId);

  const entity = await prisma.entity.findUniqueOrThrow({
    where: { id: entityId },
    include: { riskScores: { orderBy: { computedAt: "desc" }, take: 1 } },
  });

  const financialYears = await prisma.financialYear.findMany({ orderBy: { startDate: "asc" } });
  const selectedFy = financialYears.find((y) => y.id === selectedFinancialYearId) ?? financialYears.at(-1);
  if (!selectedFy) throw new Error("No financial years seeded.");

  const [kpisAllYears, auditFindings, fundAllocations, workforceStats, jobCreations] = await Promise.all([
    prisma.kpi.findMany({
      where: { entityId },
      include: {
        financialYear: { select: { id: true, label: true, startDate: true } },
        milestones: {
          include: { reportingPeriod: { select: { id: true, quarter: true, dueDate: true, endDate: true } } },
        },
        performanceReports: {
          include: { reportingPeriod: { select: { id: true, quarter: true } } },
          orderBy: { submittedAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.auditFinding.findMany({
      where: { entityId },
      include: { financialYear: { select: { label: true, startDate: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.fundAllocation.findMany({
      where: { entityId },
      include: {
        expenditures: { select: { amountSpent: true } },
        financialYear: { select: { id: true, label: true, startDate: true } },
      },
    }),
    prisma.workforceStat.findMany({ where: { entityId, financialYearId: selectedFy.id } }),
    prisma.jobCreation.findMany({
      where: { entityId },
      include: { financialYear: { select: { label: true, startDate: true } } },
    }),
  ]);

  // --- KPIs for the selected year (progress table) ---
  const kpisForYear = kpisAllYears
    .filter((k) => k.financialYearId === selectedFy.id)
    .map((k) => {
      const milestonesByPeriod = new Map(k.milestones.map((m) => [m.reportingPeriodId, m]));
      const reportsByPeriod = new Map(k.performanceReports.map((r) => [r.reportingPeriodId, r]));
      const quarters = QUARTER_ORDER.map((quarter) => {
        const milestone = k.milestones.find((m) => m.reportingPeriod.quarter === quarter);
        const report = milestone ? reportsByPeriod.get(milestone.reportingPeriodId) : undefined;
        return {
          quarter,
          targetValue: milestone ? milestone.targetValue.toNumber() : null,
          actualValue: report ? report.actualValue.toNumber() : null,
          status: report?.status ?? null,
          isLate: report?.isLate ?? false,
          dueDate: milestone?.reportingPeriod.dueDate ?? null,
        };
      });
      void milestonesByPeriod;
      const latestReport = [...k.performanceReports].reverse()[0];
      return {
        id: k.id,
        name: k.name,
        category: k.category,
        unit: k.unit,
        baseline: k.baseline.toNumber(),
        annualTarget: k.annualTarget.toNumber(),
        status: k.status,
        latestActual: latestReport ? latestReport.actualValue.toNumber() : null,
        quarters,
      };
    });

  // --- Year-on-year comparison, grouped by KPI name ---
  const yoyMap = new Map<
    string,
    { name: string; category: string | null; unit: string; years: Map<string, { fyLabel: string; annualTarget: number; baseline: number; yearEndActual: number | null; status: string }> }
  >();
  for (const k of kpisAllYears) {
    if (!yoyMap.has(k.name)) {
      yoyMap.set(k.name, { name: k.name, category: k.category, unit: k.unit, years: new Map() });
    }
    const entry = yoyMap.get(k.name)!;
    const latestReport = [...k.performanceReports].reverse()[0];
    entry.years.set(k.financialYear.label, {
      fyLabel: k.financialYear.label,
      annualTarget: k.annualTarget.toNumber(),
      baseline: k.baseline.toNumber(),
      yearEndActual: latestReport ? latestReport.actualValue.toNumber() : null,
      status: k.status,
    });
  }
  const kpiYoY = [...yoyMap.values()]
    .map((entry) => ({
      name: entry.name,
      category: entry.category,
      unit: entry.unit,
      years: financialYears.map(
        (fy) =>
          entry.years.get(fy.label) ?? {
            fyLabel: fy.label,
            annualTarget: 0,
            baseline: 0,
            yearEndActual: null,
            status: "NOT_STARTED",
          },
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Finance by year ---
  const financeByYear = new Map<string, { fyLabel: string; startDate: Date; allocated: number; spent: number }>();
  for (const fa of fundAllocations) {
    const key = fa.financialYear.label;
    const entry = financeByYear.get(key) ?? { fyLabel: key, startDate: fa.financialYear.startDate, allocated: 0, spent: 0 };
    entry.allocated += fa.amountAllocated.toNumber();
    entry.spent += fa.expenditures.reduce((s, e) => s + e.amountSpent.toNumber(), 0);
    financeByYear.set(key, entry);
  }
  const finance = [...financeByYear.values()]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((f) => ({ ...f, utilisationRate: f.allocated > 0 ? f.spent / f.allocated : null }));

  // --- Audit findings & opinion history ---
  const auditByYear = new Map<string, { fyLabel: string; startDate: Date; findings: typeof auditFindings; opinion: string | null }>();
  for (const finding of auditFindings) {
    const key = finding.financialYear.label;
    const entry = auditByYear.get(key) ?? { fyLabel: key, startDate: finding.financialYear.startDate, findings: [], opinion: null };
    entry.findings.push(finding);
    entry.opinion = finding.auditorOpinion;
    auditByYear.set(key, entry);
  }
  const auditHistory = [...auditByYear.values()].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // --- Job creation by year ---
  const jobsByYear = new Map<string, { fyLabel: string; startDate: Date; permanent: number; temporary: number; youth: number }>();
  for (const j of jobCreations) {
    const key = j.financialYear.label;
    const entry = jobsByYear.get(key) ?? { fyLabel: key, startDate: j.financialYear.startDate, permanent: 0, temporary: 0, youth: 0 };
    if (j.jobType === "PERMANENT") entry.permanent += j.count;
    if (j.jobType === "TEMPORARY") entry.temporary += j.count;
    if (j.jobType === "YOUTH") entry.youth += j.count;
    jobsByYear.set(key, entry);
  }
  const jobCreationByYear = [...jobsByYear.values()].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return {
    entity: {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      sector: entity.sector,
      description: entity.description,
      fundingAllocation: entity.fundingAllocation.toNumber(),
    },
    risk: entity.riskScores[0]
      ? { score: entity.riskScores[0].score, band: entity.riskScores[0].band, computedAt: entity.riskScores[0].computedAt }
      : null,
    financialYears: financialYears.map((y) => ({ id: y.id, label: y.label })),
    selectedFinancialYear: { id: selectedFy.id, label: selectedFy.label },
    kpisForYear,
    kpiYoY,
    finance,
    auditHistory,
    workforceStats: workforceStats.map((w) => ({
      gender: w.gender,
      raceCategory: w.raceCategory,
      ageBand: w.ageBand,
      disabilityStatus: w.disabilityStatus,
      headcount: w.headcount,
    })),
    jobCreationByYear,
  };
}

export type EntityDetail = Awaited<ReturnType<typeof getEntityDetail>>;
