import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { updateTaskStatus } from "@/lib/data/tasks";
import type { TaskStatus } from "@prisma/client";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as TaskStatus;

  if (!["TODO", "IN_PROGRESS", "DONE", "BLOCKED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    const task = await updateTaskStatus(user, id, status);
    return NextResponse.json({ taskId: task.id, status: task.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
