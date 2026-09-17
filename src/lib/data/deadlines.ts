import { prisma } from "@/lib/prisma";
import { isDsacWideRole } from "@/lib/constants";
import { assertEntityAccess, type CurrentUser } from "@/lib/tenant-scope";
import type { DeadlineCategory, DocumentType } from "@prisma/client";

const CATEGORY_TO_DOCUMENT_TYPE: Partial<Record<DeadlineCategory, DocumentType>> = {
  QUARTERLY_REPORT: "QUARTERLY_REPORT",
  ANNUAL_REPORT: "ANNUAL_REPORT",
  FINANCIALS: "FINANCIALS",
  STRATEGIC_PLAN: "STRATEGIC_PLAN",
  APP_SUBMISSION: "APP",
};

export interface DeadlineView {
  id: string;
  title: string;
  category: DeadlineCategory;
  dueDate: Date;
  quarter: string | null;
  financialYearLabel: string | null;
  daysRemaining: number;
  /** For the current viewer's own entity (entity-scoped roles only). */
  isSatisfiedForViewer: boolean | null;
  /** DSAC-wide roles only — how many entities still owe a submission for this deadline. */
  compliance: { satisfied: number; total: number; outstandingEntities: { id: string; name: string }[] } | null;
}

function satisfiedKey(entityId: string, reportingPeriodId: string) {
  return `${entityId}|${reportingPeriodId}`;
}

async function computeSatisfiedSet(): Promise<Set<string>> {
  const documents = await prisma.document.findMany({
    where: { deletedAt: null, reportingPeriodId: { not: null } },
    select: {
      entityId: true,
      reportingPeriodId: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { reviewStatus: true } },
    },
  });
  const satisfied = new Set<string>();
  for (const doc of documents) {
    if (doc.versions[0]?.reviewStatus && doc.versions[0].reviewStatus !== "RETURNED") {
      satisfied.add(satisfiedKey(doc.entityId, doc.reportingPeriodId!));
    }
  }
  return satisfied;
}

export async function listDeadlines(user: CurrentUser): Promise<DeadlineView[]> {
  const dsacWide = isDsacWideRole(user.role);
  const now = new Date();

  const deadlines = await prisma.deadline.findMany({
    include: { reportingPeriod: { include: { financialYear: { select: { label: true } } } } },
    orderBy: { dueDate: "asc" },
  });

  const entities = await prisma.entity.findMany({ select: { id: true, name: true } });
  const satisfied = await computeSatisfiedSet();

  return deadlines.map((d) => {
    const docType = CATEGORY_TO_DOCUMENT_TYPE[d.category];
    const daysRemaining = Math.ceil((d.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let isSatisfiedForViewer: boolean | null = null;
    if (!dsacWide && user.entityId && docType && d.reportingPeriodId) {
      isSatisfiedForViewer = satisfied.has(satisfiedKey(user.entityId, d.reportingPeriodId));
    }

    let compliance: DeadlineView["compliance"] = null;
    if (dsacWide && docType && d.reportingPeriodId) {
      const outstanding = entities.filter((e) => !satisfied.has(satisfiedKey(e.id, d.reportingPeriodId!)));
      compliance = { satisfied: entities.length - outstanding.length, total: entities.length, outstandingEntities: outstanding.slice(0, 8) };
    }

    return {
      id: d.id,
      title: d.title,
      category: d.category,
      dueDate: d.dueDate,
      quarter: d.reportingPeriod?.quarter ?? null,
      financialYearLabel: d.reportingPeriod?.financialYear.label ?? null,
      daysRemaining,
      isSatisfiedForViewer,
      compliance,
    };
  });
}

/** Deadline status for one specific entity, regardless of the viewer's own role/entity — used by the entity workspace tab. */
export async function listDeadlinesForEntity(user: CurrentUser, entityId: string): Promise<DeadlineView[]> {
  assertEntityAccess(user, entityId);
  const now = new Date();

  const [deadlines, satisfied] = await Promise.all([
    prisma.deadline.findMany({
      include: { reportingPeriod: { include: { financialYear: { select: { label: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    computeSatisfiedSet(),
  ]);

  return deadlines.map((d) => {
    const docType = CATEGORY_TO_DOCUMENT_TYPE[d.category];
    const daysRemaining = Math.ceil((d.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isSatisfiedForViewer = docType && d.reportingPeriodId ? satisfied.has(satisfiedKey(entityId, d.reportingPeriodId)) : null;

    return {
      id: d.id,
      title: d.title,
      category: d.category,
      dueDate: d.dueDate,
      quarter: d.reportingPeriod?.quarter ?? null,
      financialYearLabel: d.reportingPeriod?.financialYear.label ?? null,
      daysRemaining,
      isSatisfiedForViewer,
      compliance: null,
    };
  });
}
