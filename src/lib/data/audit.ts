import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function logAudit(params: {
  /** Omit for system/scheduled-job actions with no requesting user (e.g. the weekly briefing). */
  userId?: string;
  entityId?: string | null;
  action: string;
  targetType: string;
  targetId?: string;
  ipAddress?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      entityId: params.entityId ?? undefined,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      ipAddress: params.ipAddress ?? undefined,
      before: params.before,
      after: params.after,
    },
  });
}

export interface AuditLogFilters {
  action?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
}

/** Callers gate this to DSAC Admin (canViewAuditLog) — this function itself is not tenant- or role-scoped, matching an admin-only audit trail over the whole platform. */
export async function listAuditLogs(filters: AuditLogFilters, limit = 200) {
  return prisma.auditLog.findMany({
    where: {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
      entity: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listDistinctAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
  return rows.map((r) => r.action);
}
