import { prisma } from "@/lib/prisma";
import { now } from "@/lib/clock";
import { getDeadlineAlertDays } from "@/lib/constants";
import { daysUntilDue } from "@/lib/calc/compliance";
import { notifyUser } from "@/lib/data/notifications";
import type { NotificationChannel } from "@prisma/client";

/** Reports that fell due longer ago than this are history, not something to nag anyone about. */
const OVERDUE_LOOKBACK_DAYS = 90;

/**
 * Checks every report that is still owed (Draft or Returned) against the configured thresholds
 * (30 and 15 days out, then daily in the final stretch) and notifies the entity. Once a report is
 * overdue it is escalated to DSAC. Dedupes by exact notification title, which encodes the threshold
 * ("10 day(s) until … is due", "Overdue: …"), so re-running this job frequently is safe.
 */
export async function runDeadlineCheck(): Promise<number> {
  const today = now();
  const alertDays = getDeadlineAlertDays();
  const smallestThreshold = alertDays.length > 0 ? Math.min(...alertDays) : 15;
  const horizonDays = alertDays.length > 0 ? Math.max(...alertDays) : 30;
  const DAY_MS = 86_400_000;

  const reports = await prisma.report.findMany({
    where: {
      status: { in: ["DRAFT", "RETURNED"] },
      dueDate: { gte: new Date(today.getTime() - OVERDUE_LOOKBACK_DAYS * DAY_MS), lte: new Date(today.getTime() + horizonDays * DAY_MS) },
    },
    include: { entity: { select: { id: true, name: true } } },
  });
  if (reports.length === 0) return 0;

  const dsacUsers = await prisma.user.findMany({ where: { role: { in: ["DSAC_ADMIN", "DSAC_ANALYST"] } } });
  const entityUsersByEntity = new Map<string, Awaited<ReturnType<typeof prisma.user.findMany>>>();
  let sent = 0;

  for (const report of reports) {
    const days = daysUntilDue(report.dueDate, today);
    const overdue = days < 0;
    const isThreshold = alertDays.includes(days) || days < smallestThreshold;
    if (!overdue && !isThreshold) continue;

    const title = overdue ? `Overdue: ${report.title} — ${report.entity.name}` : `${days === 0 ? "Due today" : `${days} day(s) until`}: ${report.title}${days === 0 ? "" : " is due"} — ${report.entity.name}`;
    const body = overdue
      ? `${report.entity.name} has not submitted "${report.title}" (due ${report.dueDate.toLocaleDateString("en-ZA")}, ${-days} day(s) ago).`
      : `${report.entity.name} has not yet submitted "${report.title}" (due ${report.dueDate.toLocaleDateString("en-ZA")}).`;

    if (!entityUsersByEntity.has(report.entityId)) {
      entityUsersByEntity.set(report.entityId, await prisma.user.findMany({ where: { entityId: report.entityId, role: { in: ["ENTITY_ADMIN", "ENTITY_CONTRIBUTOR"] } } }));
    }
    const entityUsers = entityUsersByEntity.get(report.entityId) ?? [];
    const channels: NotificationChannel[] = overdue ? ["IN_APP", "EMAIL", "TEAMS"] : ["IN_APP", "EMAIL"];
    const recipients = [...entityUsers.map((u) => ({ user: u, link: "/reports" })), ...(overdue ? dsacUsers.map((u) => ({ user: u, link: `/entities/${report.entityId}/reports` })) : [])];

    for (const { user, link } of recipients) {
      const alreadySent = await prisma.notification.findFirst({ where: { userId: user.id, type: "DEADLINE_REMINDER", title, channel: "IN_APP" } });
      if (alreadySent) continue;
      await notifyUser({ userId: user.id, userEmail: user.email, entityId: report.entityId, type: "DEADLINE_REMINDER", title, body, link, channels });
      sent++;
    }
  }

  return sent;
}
