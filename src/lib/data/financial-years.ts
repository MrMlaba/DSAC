import { prisma } from "@/lib/prisma";

export async function listFinancialYears() {
  return prisma.financialYear.findMany({ orderBy: { startDate: "asc" } });
}

export async function listReportingPeriods(financialYearId: string) {
  return prisma.reportingPeriod.findMany({ where: { financialYearId }, orderBy: { startDate: "asc" } });
}

/** The most recent financial year by start date — the "current" one in the demo timeline. */
export async function getDefaultFinancialYear() {
  const years = await prisma.financialYear.findMany({ orderBy: { startDate: "desc" }, take: 1 });
  return years[0] ?? null;
}
