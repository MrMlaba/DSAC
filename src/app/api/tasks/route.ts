import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { createTask } from "@/lib/data/tasks";
import { checkOrigin } from "@/lib/origin-check";
import { createTaskSchema } from "@/lib/validation/task";

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  try {
    const task = await createTask(user, {
      ...parsed.data,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
    });
    return NextResponse.json({ taskId: task.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
