import Anthropic from "@anthropic-ai/sdk";

/**
 * Every AI feature in this app checks this first and falls back to a
 * deterministic mock when false — per the brief, the demo must never depend
 * on a live key. See src/lib/ai/ask-the-data.ts, document-assist.ts, and
 * src/lib/jobs/weekly-briefing.ts for the mock branches.
 */
export const isAiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

export const CLAUDE_MODEL = "claude-opus-5";

let client: Anthropic | undefined;

export function getClaudeClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
