import { prisma } from "@/lib/prisma";
import { getDeadlineAlertDays, getDeadlineHourlyWindowHours } from "@/lib/constants";
import { notifyUser } from "@/lib/data/notifications";
import type { NotificationChannel } from "@prisma/client";

/**
 * Checks every deadline against the configured thresholds (30d, 15d, then
 * daily, then hourly in the final window) and notifies anyone who still owes
 * a submission. Dedupes by exact notification title, which encodes the
 * threshold ("14 days until…", "overdue: …") — so re-running this job
 * frequently is safe: the same threshold for the same (user, deadline) never
 * re-fires, but a new day/hour crossing a new threshold does.
 */
export async function runDeadlineCheck(): Promise<number> {
  const now = new Date();
  const alertDays = getDeadlineAlertDays();
  const hourlyWindowHours = getDeadlineHourlyWindowHours();
  const smallestDayThreshold = alertDays.length > 0 ? Math.min(...alertDays) : 15;

  const deadlines = await prisma.deadline.findMany({ where: { reportingPeriodId: { not: null } } });
  if (deadlines.length === 0) return 0;

  const documents = await prisma.document.findMany({
    where: { deletedAt: null, reportingPeriodId: { not: null } },
    select: {
      entityId: true,
      reportingPeriodId: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { reviewStatus: true } },
    },
  });
  const satisfied = new Set<string>();
  for (const d of documents) {
    if (d.versions[0]?.reviewStatus && d.versions[0].reviewStatus !== "RETURNED") {
      satisfied.add(`${d.entityId}|${d.reportingPeriodId}`);
    }
  }

  const entities = await prisma.entity.findMany({ select: { id: true, name: true } });
  const dsacUsers = await prisma.user.findMany({ where: { role: { in: ["DSAC_ADMIN", "DSAC_ANALYST"] } } });

  let notificationsSent = 0;

  for (const deadline of deadlines) {
    const hoursUntilDue = (deadline.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const daysUntilDue = hoursUntilDue / 24;

    let thresholdLabel: string | null = null;
    if (hoursUntilDue <= 0) {
      thresholdLabel = "overdue";
    } else if (hoursUntilDue <= hourlyWindowHours) {
      thresholdLabel = `${Math.max(1, Math.ceil(hoursUntilDue))}h`;
    } else if (daysUntilDue < smallestDayThreshold || alertDays.some((d) => Math.ceil(daysUntilDue) === d)) {
      thresholdLabel = `${Math.ceil(daysUntilDue)}d`;
    }
    if (!thresholdLabel) continue;

    const outstandingEntities = entities.filter((e) => !satisfied.has(`${e.id}|${deadline.reportingPeriodId}`));
    if (outstandingEntities.length === 0) continue;

    for (const entity of outstandingEntities) {
      const entityUsers = await prisma.user.findMany({
        where: { entityId: entity.id, role: { in: ["ENTITY_ADMIN", "ENTITY_CONTRIBUTOR"] } },
      });

      const title =
        thresholdLabel === "overdue"
          ? `Overdue: ${deadline.title} — ${entity.name}`
          : `${thresholdLabel.endsWith("h") ? thresholdLabel.replace("h", " hour(s)") : thresholdLabel.replace("d", " day(s)")} until ${deadline.title} is due — ${entity.name}`;
      const body = `${entity.name} has not yet submitted for "${deadline.title}" (due ${deadline.dueDate.toLocaleDateString("en-ZA")}).`;
      const isOverdue = thresholdLabel === "overdue";
      const recipients = isOverdue ? [...entityUsers, ...dsacUsers] : entityUsers; // escalate overdue to DSAC
      const channels: NotificationChannel[] = isOverdue ? ["IN_APP", "EMAIL", "TEAMS"] : ["IN_APP", "EMAIL"];

      for (const recipient of recipients) {
        const alreadySent = await prisma.notification.findFirst({
          where: { userId: recipient.id, type: "DEADLINE_REMINDER", title, channel: "IN_APP" },
        });
        if (alreadySent) continue;

        await notifyUser({
          userId: recipient.id,
          userEmail: recipient.email,
          entityId: entity.id,
          type: "DEADLINE_REMINDER",
          title,
          body,
          link: "/risk",
          channels,
        });
        notificationsSent++;
      }
    }
  }

  return notificationsSent;
}
