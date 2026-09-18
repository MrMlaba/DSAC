import { logAudit } from "@/lib/data/audit";

/**
 * "Log prompts/responses" safeguard — every AI call, real or mocked, is
 * recorded here via the platform's existing append-only AuditLog (see
 * /audit-log, Phase 7's admin viewer, for the rest of the audit trail).
 */
export async function logAiInteraction(params: {
  /** Omit for system/scheduled-job calls with no requesting user (e.g. the weekly briefing). */
  userId?: string;
  entityId?: string | null;
  action: "ASK_THE_DATA" | "DOCUMENT_ANALYSIS" | "WEEKLY_BRIEFING";
  targetId?: string;
  promptSummary: string;
  responseSummary: string;
}) {
  await logAudit({
    userId: params.userId,
    entityId: params.entityId,
    action: `AI_${params.action}`,
    targetType: "ai_interaction",
    targetId: params.targetId,
    before: { prompt: params.promptSummary.slice(0, 2000) },
    after: { response: params.responseSummary.slice(0, 2000) },
  });
}
