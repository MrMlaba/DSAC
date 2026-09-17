import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient, isAiConfigured, CLAUDE_MODEL } from "@/lib/ai/claude";
import { redactPii } from "@/lib/ai/redact";
import { logAiInteraction } from "@/lib/ai/audit";
import type { CurrentUser } from "@/lib/tenant-scope";
import { getPortfolioData } from "@/lib/data/portfolio";
import { getDefaultFinancialYear } from "@/lib/data/financial-years";
import { listEntityRisk } from "@/lib/data/risk";
import { listDeadlines } from "@/lib/data/deadlines";

export interface AskTheDataResult {
  answer: string;
  toolsUsed: string[];
}

/**
 * "Ask the data" — a fixed set of safe, tenant-scoped query tools, never raw
 * SQL. Every tool here is a thin wrapper around a data-access function this
 * app already uses elsewhere (getPortfolioData, listEntityRisk,
 * listDeadlines), so tenant isolation and RBAC come for free — the model
 * can only ever see what the calling user could already see on their own
 * dashboard.
 */
function buildTools(user: CurrentUser, onUse: (name: string) => void) {
  const getPortfolioOverview = betaZodTool({
    name: "get_portfolio_overview",
    description:
      "Portfolio-wide summary for the current financial year: entity counts, average fund utilisation, average submission compliance, and KPI status breakdown. Scoped to whatever entities the current user can see.",
    inputSchema: z.object({}),
    run: async () => {
      onUse("get_portfolio_overview");
      const fy = await getDefaultFinancialYear();
      if (!fy) return JSON.stringify({ error: "No financial years seeded." });
      const { summary } = await getPortfolioData(user, { financialYearId: fy.id });
      return JSON.stringify(summary);
    },
  });

  const listEntitiesByRisk = betaZodTool({
    name: "list_entities_by_risk",
    description: "Lists entities with their current risk score and band, optionally filtered to one band. Sorted highest risk first.",
    inputSchema: z.object({ band: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional() }),
    run: async (input) => {
      onUse("list_entities_by_risk");
      const risk = await listEntityRisk(user);
      const filtered = input.band ? risk.filter((r) => r.band === input.band) : risk;
      return JSON.stringify(
        filtered.map((r) => ({
          entity: r.entityName,
          score: r.score,
          band: r.band,
          topFactor: r.factors[0]?.label ?? null,
          probabilityMissTarget: r.probabilityMissTarget,
          probabilityLateSubmission: r.probabilityLateSubmission,
        })),
      );
    },
  });

  const getEntitySummary = betaZodTool({
    name: "get_entity_summary",
    description: "Looks up one entity by name (partial match is fine) and returns its risk score, contributing factors, and predicted probabilities.",
    inputSchema: z.object({ entityName: z.string().describe("Full or partial entity name") }),
    run: async (input) => {
      onUse("get_entity_summary");
      const risk = await listEntityRisk(user);
      const match = risk.find((r) => r.entityName.toLowerCase().includes(input.entityName.toLowerCase()));
      if (!match) return JSON.stringify({ error: `No entity matching "${input.entityName}" in your scope.` });
      return JSON.stringify(match);
    },
  });

  const listUpcomingDeadlines = betaZodTool({
    name: "list_upcoming_deadlines",
    description: "Lists reporting deadlines due within 60 days or already overdue, with days remaining and submission status.",
    inputSchema: z.object({}),
    run: async () => {
      onUse("list_upcoming_deadlines");
      const list = await listDeadlines(user);
      const relevant = list.filter((d) => d.daysRemaining <= 60).slice(0, 15);
      return JSON.stringify(
        relevant.map((d) => ({
          title: d.title,
          dueDate: d.dueDate,
          daysRemaining: d.daysRemaining,
          satisfiedForYourEntity: d.isSatisfiedForViewer,
          complianceAcrossEntities: d.compliance,
        })),
      );
    },
  });

  return [getPortfolioOverview, listEntitiesByRisk, getEntitySummary, listUpcomingDeadlines];
}

const SYSTEM_PROMPT = [
  "You are an analyst assistant embedded in the DSAC Public Entities Performance & Reporting Platform, a hackathon prototype using entirely synthetic demo data.",
  "Answer the user's question using ONLY the tool results you receive — never invent figures, entity names, or dates.",
  "If the available tools don't cover what's being asked, say so plainly instead of guessing.",
  "Keep answers concise: a short paragraph or a short list. Cite specific entity names and numbers from the tool output.",
].join(" ");

/** Keyword-routed fallback using the exact same tenant-scoped data functions, for when no API key is configured. Real data, no LLM. */
async function mockAnswer(user: CurrentUser, question: string): Promise<AskTheDataResult> {
  const q = question.toLowerCase();

  if (/(risk|critical|worst|watch)/.test(q)) {
    const risk = await listEntityRisk(user);
    const top = risk.slice(0, 3);
    return {
      answer:
        top.length === 0
          ? "No risk scores have been computed yet."
          : `Highest-risk entities right now: ${top.map((r) => `${r.entityName} (${r.band}, score ${r.score})`).join("; ")}.`,
      toolsUsed: ["list_entities_by_risk"],
    };
  }

  if (/(deadline|overdue|due|submit)/.test(q)) {
    const deadlines = await listDeadlines(user);
    const overdue = deadlines.filter((d) => d.daysRemaining < 0 && d.isSatisfiedForViewer !== true);
    const soon = deadlines.filter((d) => d.daysRemaining >= 0 && d.daysRemaining <= 30);
    return {
      answer: `${overdue.length} deadline(s) overdue, ${soon.length} due within 30 days.${overdue[0] ? ` Most urgent: "${overdue[0].title}".` : ""}`,
      toolsUsed: ["list_upcoming_deadlines"],
    };
  }

  const fy = await getDefaultFinancialYear();
  if (fy) {
    const { summary } = await getPortfolioData(user, { financialYearId: fy.id });
    return {
      answer: `Portfolio overview (FY ${fy.label}): ${summary.entityCount} entities in scope, average fund utilisation ${
        summary.avgUtilisationRate !== null ? Math.round(summary.avgUtilisationRate * 100) + "%" : "—"
      }, average submission compliance ${summary.avgComplianceRate !== null ? Math.round(summary.avgComplianceRate * 100) + "%" : "—"}. ANTHROPIC_API_KEY isn't set, so this is a keyword-routed answer over real data rather than a Claude-generated one.`,
      toolsUsed: ["get_portfolio_overview"],
    };
  }
  return { answer: "No data available yet.", toolsUsed: [] };
}

export async function askTheData(user: CurrentUser, question: string): Promise<AskTheDataResult> {
  const redactedQuestion = redactPii(question);

  if (!isAiConfigured) {
    const result = await mockAnswer(user, redactedQuestion);
    await logAiInteraction({ userId: user.id, action: "ASK_THE_DATA", promptSummary: redactedQuestion, responseSummary: result.answer });
    return result;
  }

  const client = getClaudeClient();
  const toolsUsed = new Set<string>();
  const tools = buildTools(user, (name) => toolsUsed.add(name));

  const finalMessage = await client.beta.messages.toolRunner({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages: [{ role: "user", content: redactedQuestion }],
  });

  const textBlock = finalMessage.content.find(
    (b): b is Anthropic.Beta.BetaTextBlock => b.type === "text",
  );
  const answer = textBlock?.text ?? "I couldn't produce an answer from the available data.";

  await logAiInteraction({ userId: user.id, action: "ASK_THE_DATA", promptSummary: redactedQuestion, responseSummary: answer });

  return { answer, toolsUsed: [...toolsUsed] };
}
