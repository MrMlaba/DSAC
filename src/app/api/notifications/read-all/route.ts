import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { markAllNotificationsRead } from "@/lib/data/notifications";
import { checkOrigin } from "@/lib/origin-check";

export async function POST(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const user = await requireUser();
  await markAllNotificationsRead(user);
  return NextResponse.json({ ok: true });
}
