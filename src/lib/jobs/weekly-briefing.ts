import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/data/notifications";

/**
 * Deterministic, template-based summary for now — Phase 6 swaps this body
 * for a Claude-generated narrative with recommended actions, using the same
 * underlying risk data. Kept real and useful in the meantime rather than a
 * placeholder that does nothing.
 */
export async function runWeeklyBriefing(): Promise<void> {
  const latestPerEntity = await prisma.riskScore.findMany({
    orderBy: [{ entityId: "asc" }, { computedAt: "desc" }],
    distinct: ["entityId"],
    include: { entity: { select: { name: true } } },
  });

  const critical = latestPerEntity.filter((s) => s.band === "CRITICAL").sort((a, b) => b.score - a.score);
  const high = latestPerEntity.filter((s) => s.band === "HIGH").sort((a, b) => b.score - a.score);

  const lines = [
    `Weekly DSAC portfolio risk briefing — ${new Date().toLocaleDateString("en-ZA")}`,
    "",
    `${critical.length} entities are in the CRITICAL risk band, ${high.length} in HIGH, out of ${latestPerEntity.length} tracked.`,
  ];
  if (critical.length > 0) {
    lines.push("", "Critical — recommend immediate follow-up:");
    for (const s of critical.slice(0, 5)) lines.push(`- ${s.entity.name} (score ${s.score})`);
  }
  if (high.length > 0) {
    lines.push("", "High risk — worth a check-in this week:");
    for (const s of high.slice(0, 5)) lines.push(`- ${s.entity.name} (score ${s.score})`);
  }
  lines.push("", "This is a template summary. Phase 6 replaces it with an AI-generated narrative and recommended actions from the same data.");
  const body = lines.join("\n");

  const dsacUsers = await prisma.user.findMany({ where: { role: { in: ["DSAC_ADMIN", "DSAC_ANALYST"] } } });
  for (const user of dsacUsers) {
    await notifyUser({
      userId: user.id,
      userEmail: user.email,
      type: "WEEKLY_BRIEFING",
      title: "Weekly DSAC risk briefing",
      body,
      link: "/risk",
      channels: ["IN_APP", "EMAIL"],
    });
  }
}
