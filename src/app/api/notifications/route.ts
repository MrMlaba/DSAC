import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { listInAppNotifications, unreadNotificationCount } from "@/lib/data/notifications";

export async function GET() {
  const user = await requireUser();
  const [notifications, unreadCount] = await Promise.all([listInAppNotifications(user), unreadNotificationCount(user)]);
  return NextResponse.json({ notifications, unreadCount });
}
