import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notifications/email";
import { sendTeamsMessage } from "@/lib/notifications/teams";
import type { CurrentUser } from "@/lib/tenant-scope";
import type { NotificationChannel, NotificationType } from "@prisma/client";

export async function notifyUser(params: {
  userId: string;
  userEmail: string;
  entityId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  channels?: NotificationChannel[];
}) {
  const channels = params.channels ?? (["IN_APP", "EMAIL"] as NotificationChannel[]);

  await Promise.all(
    channels.map((channel) =>
      prisma.notification.create({
        data: {
          userId: params.userId,
          entityId: params.entityId ?? undefined,
          channel,
          type: params.type,
          title: params.title,
          body: params.body,
          link: params.link,
        },
      }),
    ),
  );

  if (channels.includes("EMAIL")) await sendEmail(params.userEmail, params.title, params.body);
  if (channels.includes("TEAMS")) await sendTeamsMessage(`**${params.title}**\n${params.body}`);
}

export async function listInAppNotifications(user: CurrentUser) {
  return prisma.notification.findMany({
    where: { userId: user.id, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function unreadNotificationCount(user: CurrentUser) {
  return prisma.notification.count({ where: { userId: user.id, channel: "IN_APP", read: false } });
}

export async function markNotificationRead(user: CurrentUser, notificationId: string) {
  await prisma.notification.updateMany({ where: { id: notificationId, userId: user.id }, data: { read: true } });
}

export async function markAllNotificationsRead(user: CurrentUser) {
  await prisma.notification.updateMany({ where: { userId: user.id, channel: "IN_APP", read: false }, data: { read: true } });
}
