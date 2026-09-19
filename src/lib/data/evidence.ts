import { prisma } from "@/lib/prisma";
import { assertEntityAccess, type CurrentUser } from "@/lib/tenant-scope";
import { getDefaultFinancialYear } from "@/lib/data/financial-years";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import type { ReviewStatus } from "@prisma/client";

export interface EvidenceItem {
  id: string;
  title: string;
  reviewStatus: ReviewStatus | null;
}

export interface EvidenceIndex {
  byKpi: Map<string, EvidenceItem[]>;
  byBudgetLine: Map<string, EvidenceItem[]>;
  byReport: Map<string, EvidenceItem[]>;
}

/**
 * Supporting documents for one entity and year, indexed by what they support (a KPI, a budget line
 * or a report). Attachments are evidence; the structured data is the primary reporting information.
 */
export async function getEvidenceIndex(user: CurrentUser, entityId: string, financialYearId: string): Promise<EvidenceIndex> {
  assertEntityAccess(user, entityId);

  const documents = await prisma.document.findMany({
    where: {
      entityId,
      deletedAt: null,
      OR: [{ kpi: { financialYearId } }, { budgetLine: { financialYearId } }, { report: { financialYearId } }],
    },
    select: {
      id: true,
      title: true,
      kpiId: true,
      budgetLineId: true,
      reportId: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { reviewStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const index: EvidenceIndex = { byKpi: new Map(), byBudgetLine: new Map(), byReport: new Map() };
  const push = (map: Map<string, EvidenceItem[]>, key: string | null, item: EvidenceItem) => {
    if (key) map.set(key, [...(map.get(key) ?? []), item]);
  };
  for (const d of documents) {
    const item: EvidenceItem = { id: d.id, title: d.title, reviewStatus: d.versions[0]?.reviewStatus ?? null };
    push(index.byKpi, d.kpiId, item);
    push(index.byBudgetLine, d.budgetLineId, item);
    push(index.byReport, d.reportId, item);
  }
  return index;
}

export interface EvidenceTargets {
  reports: { id: string; label: string }[];
  kpis: { id: string; label: string }[];
  lines: { id: string; label: string }[];
}

/** What an entity can attach evidence to in the current financial year: its reports, KPIs and budget lines. */
export async function listEvidenceTargets(user: CurrentUser, entityId: string): Promise<EvidenceTargets> {
  assertEntityAccess(user, entityId);
  const fy = await getDefaultFinancialYear();
  if (!fy) return { reports: [], kpis: [], lines: [] };

  const [reports, kpis, lines] = await Promise.all([
    prisma.report.findMany({ where: { entityId, financialYearId: fy.id }, select: { id: true, title: true }, orderBy: { dueDate: "asc" } }),
    prisma.kpi.findMany({ where: { entityId, financialYearId: fy.id }, select: { id: true, name: true, programme: true }, orderBy: [{ programme: "asc" }, { name: "asc" }] }),
    prisma.budgetLine.findMany({ where: { entityId, financialYearId: fy.id }, select: { id: true, category: true }, orderBy: { category: "asc" } }),
  ]);

  return {
    reports: reports.map((r) => ({ id: r.id, label: r.title })),
    kpis: kpis.map((k) => ({ id: k.id, label: `${k.name} (${k.programme})` })),
    lines: lines.map((l) => ({ id: l.id, label: EXPENSE_CATEGORY_LABELS[l.category] })),
  };
}
