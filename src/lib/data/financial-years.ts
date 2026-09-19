import { prisma } from "@/lib/prisma";
import { now } from "@/lib/clock";

export async function listFinancialYears() {
  return prisma.financialYear.findMany({ orderBy: { startDate: "asc" } });
}

export async function listReportingPeriods(financialYearId: string) {
  return prisma.reportingPeriod.findMany({ where: { financialYearId }, orderBy: { startDate: "asc" } });
}

/** The financial year containing today; falls back to the most recent one if today is outside every seeded year. */
export async function getDefaultFinancialYear() {
  const years = await listFinancialYears();
  const today = now();
  return years.find((y) => y.startDate <= today && today.getTime() < y.endDate.getTime() + 86_400_000) ?? years.at(-1) ?? null;
}

/** Resolves the `?fy=` search param (an id) to a year, defaulting to the current one. Shared by every page so they all agree. */
export async function resolveFinancialYear(fyParam?: string | string[] | undefined) {
  const years = await listFinancialYears();
  const requested = typeof fyParam === "string" ? years.find((y) => y.id === fyParam) : undefined;
  const selected = requested ?? (await getDefaultFinancialYear());
  if (!selected) throw new Error("No financial years seeded — run `pnpm db:seed`.");
  return { financialYears: years.map((y) => ({ id: y.id, label: y.label })), selected: { id: selected.id, label: selected.label, startDate: selected.startDate, endDate: selected.endDate } };
}
