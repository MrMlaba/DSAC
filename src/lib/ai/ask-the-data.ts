import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient, isAiConfigured, CLAUDE_MODEL } from "@/lib/ai/claude";
import { redactPii } from "@/lib/ai/redact";
import { logAiInteraction } from "@/lib/ai/audit";
import type { CurrentUser } from "@/lib/tenant-scope";
import { getPortfolio } from "@/lib/data/portfolio";
import { getDefaultFinancialYear } from "@/lib/data/financial-years";
import { listEntityRisk } from "@/lib/data/risk";
import { listReports } from "@/lib/data/reports";
import { formatPercent, formatRand, formatRandCompact } from "@/lib/format";
import { ENTITY_COMPLIANCE_LABELS, PERFORMANCE_BAND_LABELS } from "@/lib/constants";

export interface AskTheDataResult {
  answer: string;
  toolsUsed: string[];
}

/** The portfolio figures as plain strings — formatted by the same functions the dashboard uses, so an answer can never disagree with the screen. */
async function portfolioFigures(user: CurrentUser) {
  const fy = await getDefaultFinancialYear();
  if (!fy) return null;
  const { rows, summary } = await getPortfolio(user, fy.id);
  return {
    fy,
    rows,
    summary,
    text: {
      financialYear: fy.label,
      organisationsInScope: summary.entityCount,
      publicEntities: summary.publicEntityCount,
      npos: summary.npoCount,
      totalApprovedBudget: formatRand(summary.finance.approved),
      totalDisbursed: formatRand(summary.finance.disbursed),
      totalUtilised: formatRand(summary.finance.utilised),
      overallUtilisationOfDisbursed: formatPercent(summary.finance.fundUtilisation),
      budgetUtilisationOfApproved: formatPercent(summary.finance.budgetUtilisation),
      overallKpiPerformance: formatPercent(summary.performance.overall),
      overallComplianceRate: formatPercent(summary.compliance.rate),
      reportsSubmitted: summary.compliance.submitted,
      reportsOutstanding: summary.compliance.outstanding,
      organisationsOverdueReporting: summary.complianceStatuses.OVERDUE_REPORTING,
      organisationsUnderTarget: summary.performanceBands.UNDER_TARGET,
    },
  };
}

/**
 * "Ask the data" — a fixed set of safe, tenant-scoped query tools, never raw SQL. Every tool is a
 * thin wrapper around a data-access function the app already uses (getPortfolio, listEntityRisk,
 * listReports), so tenant isolation and RBAC come for free and the numbers match the dashboards.
 */
function buildTools(user: CurrentUser, onUse: (name: string) => void) {
  const getPortfolioOverview = betaZodTool({
    name: "get_portfolio_overview",
    description:
      "Portfolio-wide summary for the current financial year: entity counts, total approved budget, disbursed and utilised amounts, overall utilisation, KPI performance, compliance rate and report counts. Scoped to whatever the current user can see.",
    inputSchema: z.object({}),
    run: async () => {
      onUse("get_portfolio_overview");
      const figures = await portfolioFigures(user);
      return JSON.stringify(figures?.text ?? { error: "No financial years seeded." });
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
        filtered.map((r) => ({ entity: r.entityName, score: r.score, band: r.band, topFactor: r.factors[0]?.label ?? null, probabilityMissTarget: r.probabilityMissTarget, probabilityLateSubmission: r.probabilityLateSubmission })),
      );
    },
  });

  const getEntitySummary = betaZodTool({
    name: "get_entity_summary",
    description: "Looks up one organisation by name (partial match is fine) and returns its finance, performance, compliance and risk figures.",
    inputSchema: z.object({ entityName: z.string().describe("Full or partial entity name") }),
    run: async (input) => {
      onUse("get_entity_summary");
      const figures = await portfolioFigures(user);
      const row = figures?.rows.find((r) => r.name.toLowerCase().includes(input.entityName.toLowerCase()));
      if (!row) return JSON.stringify({ error: `No organisation matching "${input.entityName}" in your scope.` });
      const m = row.metrics;
      return JSON.stringify({
        organisation: row.name,
        approvedBudget: formatRand(m.finance.summary.approved),
        disbursed: formatRand(m.finance.summary.disbursed),
        utilised: formatRand(m.finance.summary.utilised),
        budgetUtilisation: formatPercent(m.finance.summary.budgetUtilisation),
        utilisationOfDisbursed: formatPercent(m.finance.summary.fundUtilisation),
        overallPerformance: formatPercent(m.performance.summary.overall),
        performance: PERFORMANCE_BAND_LABELS[m.performance.band],
        compliance: ENTITY_COMPLIANCE_LABELS[m.compliance.summary.status],
        complianceRate: formatPercent(m.compliance.summary.rate),
        reportsOutstanding: m.compliance.summary.outstanding,
        riskBand: row.riskBand,
        riskScore: row.riskScore,
      });
    },
  });

  const listOutstandingReports = betaZodTool({
    name: "list_outstanding_reports",
    description: "Lists reports that are overdue or due within 60 days and not yet submitted, with the organisation, due date and days remaining.",
    inputSchema: z.object({}),
    run: async () => {
      onUse("list_outstanding_reports");
      const fy = await getDefaultFinancialYear();
      if (!fy) return JSON.stringify({ error: "No financial years seeded." });
      const reports = await listReports(user, { financialYearId: fy.id });
      const relevant = reports.filter((r) => (r.status === "DRAFT" || r.status === "RETURNED") && r.compliance.daysUntilDue <= 60).sort((a, b) => a.compliance.daysUntilDue - b.compliance.daysUntilDue).slice(0, 20);
      return JSON.stringify(relevant.map((r) => ({ organisation: r.entityName, report: r.title, dueDate: r.dueDate.toISOString().slice(0, 10), daysRemaining: r.compliance.daysUntilDue, status: r.status })));
    },
  });

  return [getPortfolioOverview, listEntitiesByRisk, getEntitySummary, listOutstandingReports];
}

const SYSTEM_PROMPT = [
  "You are an analyst assistant embedded in the DSAC Public Entity & NPO Reporting and Oversight Platform, a hackathon prototype using entirely synthetic demo data.",
  "Answer the user's question using ONLY the tool results you receive — never invent figures, entity names, or dates, and never recompute a figure the tools already give you.",
  "Note there are two utilisation measures: 'overall utilisation' is utilised ÷ disbursed, and 'budget utilisation' is utilised ÷ approved budget. Say which one you are quoting.",
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
      answer: top.length === 0 ? "No risk scores have been computed yet." : `Highest-risk organisations right now: ${top.map((r) => `${r.entityName} (${r.band}, score ${r.score})`).join("; ")}.`,
      toolsUsed: ["list_entities_by_risk"],
    };
  }

  if (/(deadline|overdue|due|submit|outstanding|report)/.test(q)) {
    const fy = await getDefaultFinancialYear();
    if (fy) {
      const reports = await listReports(user, { financialYearId: fy.id });
      const owed = reports.filter((r) => r.status === "DRAFT" || r.status === "RETURNED");
      const overdue = owed.filter((r) => r.compliance.daysUntilDue < 0);
      const soon = owed.filter((r) => r.compliance.daysUntilDue >= 0 && r.compliance.daysUntilDue <= 30);
      const worst = [...overdue].sort((a, b) => a.compliance.daysUntilDue - b.compliance.daysUntilDue)[0];
      return {
        answer: `${overdue.length} report(s) overdue and ${soon.length} due within 30 days.${worst ? ` Longest overdue: "${worst.title}" from ${worst.entityName} (${-worst.compliance.daysUntilDue} days).` : ""}`,
        toolsUsed: ["list_outstanding_reports"],
      };
    }
  }

  const figures = await portfolioFigures(user);
  if (figures) {
    const t = figures.text;
    return {
      answer: `FY ${t.financialYear}: ${t.organisationsInScope} organisations in scope. Approved ${formatRandCompact(figures.summary.finance.approved)}, disbursed ${t.totalDisbursed}, utilised ${t.totalUtilised} — overall utilisation ${t.overallUtilisationOfDisbursed} of disbursed funds (${t.budgetUtilisationOfApproved} of the approved budget). KPI performance ${t.overallKpiPerformance}; compliance rate ${t.overallComplianceRate}. ANTHROPIC_API_KEY isn't set, so this is a keyword-routed answer over real data rather than a Claude-generated one.`,
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

  const textBlock = finalMessage.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  const answer = textBlock?.text ?? "I couldn't produce an answer from the available data.";

  await logAiInteraction({ userId: user.id, action: "ASK_THE_DATA", promptSummary: redactedQuestion, responseSummary: answer });

  return { answer, toolsUsed: [...toolsUsed] };
}
