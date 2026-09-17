import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { markAllNotificationsRead } from "@/lib/data/notifications";

export async function POST() {
  const user = await requireUser();
  await markAllNotificationsRead(user);
  return NextResponse.json({ ok: true });
}
