import { prisma } from "@/lib/prisma";
import { assertEntityAccess, type CurrentUser } from "@/lib/tenant-scope";

/** Organisational-profile extras: audit history, aggregated workforce and jobs created. */
export async function getEntityProfileData(user: CurrentUser, entityId: string, financialYearId: string) {
  assertEntityAccess(user, entityId);

  const [auditFindings, workforceStats, jobCreations] = await Promise.all([
    prisma.auditFinding.findMany({ where: { entityId }, include: { financialYear: { select: { label: true, startDate: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.workforceStat.findMany({ where: { entityId, financialYearId } }),
    prisma.jobCreation.findMany({ where: { entityId }, include: { financialYear: { select: { label: true, startDate: true } } } }),
  ]);

  const auditByYear = new Map<string, { fyLabel: string; startDate: Date; findings: typeof auditFindings; opinion: string | null }>();
  for (const finding of auditFindings) {
    const key = finding.financialYear.label;
    const entry = auditByYear.get(key) ?? { fyLabel: key, startDate: finding.financialYear.startDate, findings: [], opinion: null };
    entry.findings.push(finding);
    entry.opinion = finding.auditorOpinion;
    auditByYear.set(key, entry);
  }

  const jobsByYear = new Map<string, { fyLabel: string; startDate: Date; permanent: number; temporary: number; youth: number }>();
  for (const j of jobCreations) {
    const key = j.financialYear.label;
    const entry = jobsByYear.get(key) ?? { fyLabel: key, startDate: j.financialYear.startDate, permanent: 0, temporary: 0, youth: 0 };
    if (j.jobType === "PERMANENT") entry.permanent += j.count;
    if (j.jobType === "TEMPORARY") entry.temporary += j.count;
    if (j.jobType === "YOUTH") entry.youth += j.count;
    jobsByYear.set(key, entry);
  }

  return {
    auditHistory: [...auditByYear.values()].sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    jobCreationByYear: [...jobsByYear.values()].sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    workforceStats: workforceStats.map((w) => ({ gender: w.gender, raceCategory: w.raceCategory, ageBand: w.ageBand, disabilityStatus: w.disabilityStatus, headcount: w.headcount })),
  };
}

export type EntityProfileData = Awaited<ReturnType<typeof getEntityProfileData>>;
