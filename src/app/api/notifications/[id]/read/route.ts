import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { markNotificationRead } from "@/lib/data/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  await markNotificationRead(user, id);
  return NextResponse.json({ ok: true });
}
