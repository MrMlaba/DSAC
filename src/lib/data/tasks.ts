import { prisma } from "@/lib/prisma";
import { entityScopeWhere, assertEntityAccess, type CurrentUser } from "@/lib/tenant-scope";
import { isReadOnlyRole } from "@/lib/constants";
import { notifyUser } from "@/lib/data/notifications";
import { publishEntityEvent } from "@/lib/realtime/publish";
import type { TaskDirection, TaskStatus } from "@prisma/client";

export interface TaskFilters {
  entityId?: string;
  status?: TaskStatus;
}

export async function listTasks(user: CurrentUser, filters: TaskFilters) {
  const tenantWhere = entityScopeWhere(user);
  const entityWhere = tenantWhere.entityId ? tenantWhere : filters.entityId ? { entityId: filters.entityId } : {};

  return prisma.task.findMany({
    where: { ...entityWhere, ...(filters.status ? { status: filters.status } : {}) },
    include: {
      entity: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, role: true } },
      assigner: { select: { id: true, name: true, role: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Who a task can be assigned to, given its direction. TO_DSAC always targets DSAC staff regardless of which entity is asking. */
export async function listAssignableUsers(user: CurrentUser, entityId: string, direction: TaskDirection) {
  assertEntityAccess(user, entityId);
  if (direction === "TO_DSAC") {
    return prisma.user.findMany({
      where: { role: { in: ["DSAC_ADMIN", "DSAC_ANALYST"] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
  }
  return prisma.user.findMany({ where: { entityId }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
}

export async function createTask(
  user: CurrentUser,
  params: { entityId: string; title: string; description?: string; assigneeId: string; direction: TaskDirection; dueDate?: Date },
) {
  if (isReadOnlyRole(user.role)) throw new Error("Forbidden: read-only role cannot create tasks.");
  assertEntityAccess(user, params.entityId);

  const assignee = await prisma.user.findUniqueOrThrow({ where: { id: params.assigneeId } });

  const task = await prisma.task.create({
    data: {
      entityId: params.entityId,
      title: params.title,
      description: params.description,
      assigneeId: params.assigneeId,
      assignerId: user.id,
      direction: params.direction,
      dueDate: params.dueDate,
    },
  });

  await notifyUser({
    userId: assignee.id,
    userEmail: assignee.email,
    entityId: params.entityId,
    type: "TASK_ASSIGNED",
    title: `New task: ${params.title}`,
    body: `${user.name} assigned you a task${params.dueDate ? ` due ${params.dueDate.toLocaleDateString("en-ZA")}` : ""}.`,
    link: "/tasks",
  });

  await publishEntityEvent(params.entityId, "task.created", { taskId: task.id });
  return task;
}

export async function updateTaskStatus(user: CurrentUser, taskId: string, status: TaskStatus) {
  if (isReadOnlyRole(user.role)) throw new Error("Forbidden: read-only role cannot update tasks.");
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  assertEntityAccess(user, task.entityId);

  const updated = await prisma.task.update({ where: { id: taskId }, data: { status } });
  await publishEntityEvent(task.entityId, "task.updated", { taskId: task.id, status });
  return updated;
}
