import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { listAssignableUsers } from "@/lib/data/tasks";
import type { TaskDirection } from "@prisma/client";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const entityId = request.nextUrl.searchParams.get("entityId");
  const direction = request.nextUrl.searchParams.get("direction") as TaskDirection | null;

  if (!entityId || !direction) {
    return NextResponse.json({ error: "entityId and direction are required." }, { status: 400 });
  }

  try {
    const users = await listAssignableUsers(user, entityId, direction);
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list assignable users.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Forbidden") ? 403 : 400 });
  }
}
