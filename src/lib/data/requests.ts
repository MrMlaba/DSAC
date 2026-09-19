import { prisma } from "@/lib/prisma";
import { now } from "@/lib/clock";
import { assertEntityAccess, entityScopeWhere, type CurrentUser } from "@/lib/tenant-scope";
import { canCaptureReportingData, canReviewReports } from "@/lib/constants";
import { logAudit } from "@/lib/data/audit";
import { notifyUser } from "@/lib/data/notifications";
import { getDefaultFinancialYear } from "@/lib/data/financial-years";
import { toRandCents } from "@/lib/validation/reporting";
import type { RequestCategory, RequestStatus } from "@prisma/client";

export interface RequestRow {
  id: string;
  entityId: string;
  entityName: string;
  title: string;
  category: RequestCategory;
  amountRequested: number | null;
  motivation: string;
  linkedProgramme: string | null;
  expectedOutcome: string;
  status: RequestStatus;
  decisionNote: string | null;
  createdByName: string;
  createdAt: Date;
  decidedAt: Date | null;
  attachmentCount: number;
}

export async function listRequests(user: CurrentUser, filters: { status?: RequestStatus; entityId?: string } = {}): Promise<RequestRow[]> {
  const tenant = entityScopeWhere(user);
  const rows = await prisma.supportRequest.findMany({
    where: {
      ...tenant,
      ...(!tenant.entityId && filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      entity: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { documents: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    entityId: r.entityId,
    entityName: r.entity.name,
    title: r.title,
    category: r.category,
    amountRequested: r.amountRequested ? r.amountRequested.toNumber() : null,
    motivation: r.motivation,
    linkedProgramme: r.linkedProgramme,
    expectedOutcome: r.expectedOutcome,
    status: r.status,
    decisionNote: r.decisionNote,
    createdByName: r.createdBy.name,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
    attachmentCount: r._count.documents,
  }));
}

/** Programmes the entity reports against — offered as the "linked programme" choices on a request. */
export async function listProgrammes(user: CurrentUser, entityId: string): Promise<string[]> {
  assertEntityAccess(user, entityId);
  const fy = await getDefaultFinancialYear();
  if (!fy) return [];
  const rows = await prisma.kpi.findMany({ where: { entityId, financialYearId: fy.id }, select: { programme: true }, distinct: ["programme"], orderBy: { programme: "asc" } });
  return rows.map((r) => r.programme);
}

export async function createRequest(
  user: CurrentUser,
  input: { title: string; category: RequestCategory; amountRequested?: number; motivation: string; linkedProgramme?: string; expectedOutcome: string },
  ipAddress?: string | null,
) {
  if (!canCaptureReportingData(user.role) || !user.entityId) throw new Error("Forbidden: only entity staff can submit requests.");
  const fy = await getDefaultFinancialYear();

  const request = await prisma.supportRequest.create({
    data: {
      entityId: user.entityId,
      financialYearId: fy?.id,
      title: input.title,
      category: input.category,
      amountRequested: input.amountRequested !== undefined ? toRandCents(input.amountRequested) : null,
      motivation: input.motivation,
      linkedProgramme: input.linkedProgramme || null,
      expectedOutcome: input.expectedOutcome,
      createdById: user.id,
    },
    include: { entity: { select: { name: true } } },
  });

  await logAudit({ userId: user.id, entityId: user.entityId, action: "REQUEST_SUBMITTED", targetType: "support_request", targetId: request.id, ipAddress, after: { title: request.title, category: request.category } });

  const dsacUsers = await prisma.user.findMany({ where: { role: { in: ["DSAC_ADMIN", "DSAC_ANALYST"] } } });
  await Promise.all(
    dsacUsers.map((dsac) =>
      notifyUser({ userId: dsac.id, userEmail: dsac.email, entityId: user.entityId, type: "REQUEST_UPDATE", title: `New request from ${request.entity.name}: ${request.title}`, body: input.motivation.slice(0, 200), link: "/requests", channels: ["IN_APP"] }),
    ),
  );
  return request;
}

export type RequestDecisionAction = "START_REVIEW" | "APPROVE" | "DECLINE" | "REQUEST_INFO" | "COMPLETE";

export async function decideRequest(user: CurrentUser, requestId: string, action: RequestDecisionAction, note: string | undefined, ipAddress?: string | null) {
  if (!canReviewReports(user.role)) throw new Error("Forbidden: this role cannot decide requests.");
  const request = await prisma.supportRequest.findUniqueOrThrow({ where: { id: requestId } });

  const open: RequestStatus[] = ["SUBMITTED", "UNDER_REVIEW"];
  let next: RequestStatus;
  switch (action) {
    case "START_REVIEW":
      if (request.status !== "SUBMITTED") throw new Error("Only a submitted request can be taken into review.");
      next = "UNDER_REVIEW";
      break;
    case "APPROVE":
      if (!open.includes(request.status)) throw new Error("This request is not open for a decision.");
      next = "APPROVED";
      break;
    case "DECLINE":
      if (!open.includes(request.status)) throw new Error("This request is not open for a decision.");
      if (!note?.trim()) throw new Error("Give the reason for declining.");
      next = "DECLINED";
      break;
    case "REQUEST_INFO":
      if (!open.includes(request.status)) throw new Error("This request is not open for a decision.");
      if (!note?.trim()) throw new Error("Say what further information is needed.");
      next = "MORE_INFO_REQUIRED";
      break;
    case "COMPLETE":
      if (request.status !== "APPROVED") throw new Error("Only an approved request can be completed.");
      next = "COMPLETED";
      break;
  }

  const updated = await prisma.supportRequest.update({
    where: { id: requestId },
    data: { status: next, decidedById: user.id, decidedAt: now(), ...(note?.trim() ? { decisionNote: note.trim() } : {}) },
  });

  await logAudit({ userId: user.id, entityId: request.entityId, action: `REQUEST_${action}`, targetType: "support_request", targetId: requestId, ipAddress, before: { status: request.status }, after: { status: next, ...(note ? { note } : {}) } });

  if (action !== "START_REVIEW") {
    const entityUsers = await prisma.user.findMany({ where: { entityId: request.entityId, role: { in: ["ENTITY_ADMIN", "ENTITY_CONTRIBUTOR"] } } });
    await Promise.all(
      entityUsers.map((u) =>
        notifyUser({ userId: u.id, userEmail: u.email, entityId: request.entityId, type: "REQUEST_UPDATE", title: `Your request "${request.title}" is now: ${next.replace(/_/g, " ").toLowerCase()}`, body: note?.trim() || "Open the request to see DSAC's response.", link: "/requests", channels: ["IN_APP"] }),
      ),
    );
  }
  return updated;
}

/** The entity answers DSAC's request for more information; the request goes back into the queue. */
export async function respondToRequest(user: CurrentUser, requestId: string, note: string, ipAddress?: string | null) {
  if (!canCaptureReportingData(user.role)) throw new Error("Forbidden: only entity staff can respond to a request.");
  const request = await prisma.supportRequest.findUniqueOrThrow({ where: { id: requestId } });
  assertEntityAccess(user, request.entityId);
  if (request.status !== "MORE_INFO_REQUIRED") throw new Error("DSAC has not asked for more information on this request.");

  const stamp = now().toISOString().slice(0, 10);
  const updated = await prisma.supportRequest.update({
    where: { id: requestId },
    data: { status: "SUBMITTED", motivation: `${request.motivation}\n\nAdditional information (${stamp}): ${note.trim()}`, decisionNote: null },
  });
  await logAudit({ userId: user.id, entityId: request.entityId, action: "REQUEST_INFO_PROVIDED", targetType: "support_request", targetId: requestId, ipAddress, before: { status: request.status }, after: { status: "SUBMITTED" } });
  return updated;
}
