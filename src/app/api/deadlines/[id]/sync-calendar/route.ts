import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { graph, isGraphConfigured } from "@/lib/microsoft/graph";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const deadline = await prisma.deadline.findUnique({ where: { id } });
  if (!deadline) {
    return NextResponse.json({ error: "Deadline not found." }, { status: 404 });
  }

  const result = await graph.syncDeadlineToCalendar({
    userEmail: user.email,
    title: deadline.title,
    dueDate: deadline.dueDate,
    description: deadline.description ?? undefined,
  });

  return NextResponse.json({ ...result, configured: isGraphConfigured });
}
