import { prisma } from "@/lib/prisma";
import { assertEntityAccess, type CurrentUser } from "@/lib/tenant-scope";
import { isReadOnlyRole } from "@/lib/constants";
import { notifyUser } from "@/lib/data/notifications";
import { publishEntityEvent } from "@/lib/realtime/publish";

export interface CommentAnchor {
  entityId: string;
  documentId?: string;
  documentVersionId?: string;
  kpiId?: string;
  taskId?: string;
}

/** Top-level comments for an exact anchor (e.g. the general entity feed has every anchor field null); replies nested via include. */
export async function listComments(user: CurrentUser, anchor: CommentAnchor) {
  assertEntityAccess(user, anchor.entityId);

  return prisma.comment.findMany({
    where: {
      entityId: anchor.entityId,
      documentId: anchor.documentId ?? null,
      documentVersionId: anchor.documentVersionId ?? null,
      kpiId: anchor.kpiId ?? null,
      taskId: anchor.taskId ?? null,
      parentId: null,
    },
    include: {
      author: { select: { id: true, name: true, role: true } },
      replies: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createComment(
  user: CurrentUser,
  params: CommentAnchor & { body: string; parentId?: string; mentionedUserIds?: string[] },
) {
  if (isReadOnlyRole(user.role)) throw new Error("Forbidden: read-only role cannot comment.");
  assertEntityAccess(user, params.entityId);

  const comment = await prisma.comment.create({
    data: {
      entityId: params.entityId,
      authorId: user.id,
      documentId: params.documentId,
      documentVersionId: params.documentVersionId,
      kpiId: params.kpiId,
      taskId: params.taskId,
      parentId: params.parentId,
      body: params.body,
      mentionedUserIds: params.mentionedUserIds ?? [],
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  if (params.mentionedUserIds && params.mentionedUserIds.length > 0) {
    const mentioned = await prisma.user.findMany({ where: { id: { in: params.mentionedUserIds } } });
    for (const m of mentioned) {
      if (m.id === user.id) continue;
      await notifyUser({
        userId: m.id,
        userEmail: m.email,
        entityId: params.entityId,
        type: "COMMENT_MENTION",
        title: `${user.name} mentioned you in a comment`,
        body: params.body.slice(0, 200),
        link: `/entities/${params.entityId}`,
      });
    }
  }

  await publishEntityEvent(params.entityId, "comment.created", { comment, parentId: params.parentId ?? null });
  return comment;
}

export async function resolveComment(user: CurrentUser, commentId: string) {
  if (isReadOnlyRole(user.role)) throw new Error("Forbidden: read-only role cannot resolve comments.");
  const comment = await prisma.comment.findUniqueOrThrow({ where: { id: commentId } });
  assertEntityAccess(user, comment.entityId);

  const updated = await prisma.comment.update({ where: { id: commentId }, data: { resolved: true } });
  await publishEntityEvent(comment.entityId, "comment.resolved", { commentId });
  return updated;
}

export async function listTeamMembers(user: CurrentUser, entityId: string) {
  assertEntityAccess(user, entityId);
  return prisma.user.findMany({
    where: { entityId },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}
