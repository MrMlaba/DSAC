import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { createTask } from "@/lib/data/tasks";
import type { TaskDirection } from "@prisma/client";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = await request.json().catch(() => ({}));

  const { entityId, title, description, assigneeId, direction, dueDate } = body as {
    entityId?: string;
    title?: string;
    description?: string;
    assigneeId?: string;
    direction?: TaskDirection;
    dueDate?: string;
  };

  if (!entityId || !title || !assigneeId || !direction) {
    return NextResponse.json({ error: "entityId, title, assigneeId and direction are required." }, { status: 400 });
  }

  try {
    const task = await createTask(user, {
      entityId,
      title,
      description,
      assigneeId,
      direction,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });
    return NextResponse.json({ taskId: task.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
