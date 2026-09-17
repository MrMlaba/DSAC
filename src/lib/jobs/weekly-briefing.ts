import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/data/notifications";
import { getClaudeClient, isAiConfigured, CLAUDE_MODEL } from "@/lib/ai/claude";
import { logAiInteraction } from "@/lib/ai/audit";

interface RiskEntry {
  score: number;
  band: string;
  entity: { name: string };
  factors: unknown;
}

function buildTemplateBody(critical: RiskEntry[], high: RiskEntry[], total: number): string {
  const lines = [
    `Weekly DSAC portfolio risk briefing — ${new Date().toLocaleDateString("en-ZA")}`,
    "",
    `${critical.length} entities are in the CRITICAL risk band, ${high.length} in HIGH, out of ${total} tracked.`,
  ];
  if (critical.length > 0) {
    lines.push("", "Critical — recommend immediate follow-up:");
    for (const s of critical.slice(0, 5)) lines.push(`- ${s.entity.name} (score ${s.score})`);
  }
  if (high.length > 0) {
    lines.push("", "High risk — worth a check-in this week:");
    for (const s of high.slice(0, 5)) lines.push(`- ${s.entity.name} (score ${s.score})`);
  }
  lines.push("", "This is a template summary — set ANTHROPIC_API_KEY for an AI-generated narrative and recommended actions from the same data.");
  return lines.join("\n");
}

async function buildAiBody(critical: RiskEntry[], high: RiskEntry[], total: number): Promise<string> {
  const factorsFor = (entries: RiskEntry[]) =>
    entries.slice(0, 5).map((s) => {
      const stored = s.factors as { factors?: { label: string; contribution: number; detail: string }[] } | null;
      const topFactors = (stored?.factors ?? []).slice(0, 2).map((f) => f.detail);
      return { entity: s.entity.name, score: s.score, band: s.band, topFactors };
    });

  const dataSummary = JSON.stringify({
    totalEntitiesTracked: total,
    criticalCount: critical.length,
    highCount: high.length,
    criticalEntities: factorsFor(critical),
    highRiskEntities: factorsFor(high),
  });

  const client = getClaudeClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system:
      "You write a weekly risk briefing for DSAC (Department of Sport, Arts and Culture) management, covering their funded public entities. This is a hackathon prototype using synthetic demo data. Write a short, direct narrative (3-5 short paragraphs or a paragraph plus a bullet list) naming specific entities and their risk factors, ending with concrete recommended actions. Do not invent any entity, score or factor not present in the data provided.",
    messages: [{ role: "user", content: `Structured risk data for this week:\n${dataSummary}\n\nWrite the briefing.` }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const narrative = textBlock && textBlock.type === "text" ? textBlock.text : null;
  if (!narrative) return buildTemplateBody(critical, high, total);

  await logAiInteraction({
    action: "WEEKLY_BRIEFING",
    promptSummary: dataSummary.slice(0, 500),
    responseSummary: narrative.slice(0, 500),
  }).catch(() => {}); // best-effort — a logging hiccup shouldn't block the briefing going out

  return narrative;
}

export async function runWeeklyBriefing(): Promise<void> {
  const latestPerEntity = await prisma.riskScore.findMany({
    orderBy: [{ entityId: "asc" }, { computedAt: "desc" }],
    distinct: ["entityId"],
    include: { entity: { select: { name: true } } },
  });

  const critical = latestPerEntity.filter((s) => s.band === "CRITICAL").sort((a, b) => b.score - a.score);
  const high = latestPerEntity.filter((s) => s.band === "HIGH").sort((a, b) => b.score - a.score);

  const body = isAiConfigured
    ? await buildAiBody(critical, high, latestPerEntity.length)
    : buildTemplateBody(critical, high, latestPerEntity.length);

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
