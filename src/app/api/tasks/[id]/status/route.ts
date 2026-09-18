import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { updateTaskStatus } from "@/lib/data/tasks";
import { checkOrigin } from "@/lib/origin-check";
import { updateTaskStatusSchema } from "@/lib/validation/task";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateTaskStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    const task = await updateTaskStatus(user, id, parsed.data.status);
    return NextResponse.json({ taskId: task.id, status: task.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
