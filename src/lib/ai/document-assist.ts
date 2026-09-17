import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClaudeClient, isAiConfigured, CLAUDE_MODEL } from "@/lib/ai/claude";
import { redactPii } from "@/lib/ai/redact";
import { logAiInteraction } from "@/lib/ai/audit";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { assertEntityAccess, type CurrentUser } from "@/lib/tenant-scope";
import { canReviewDocuments } from "@/lib/constants";

const AnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence summary of the document"),
  keyFigures: z.array(z.object({ label: z.string(), value: z.string() })).describe("Key figures/numbers reported in the document"),
  inconsistencies: z
    .array(z.string())
    .describe("Ways the document's figures conflict with the system's recorded KPI actuals for this period — empty if none or if not checkable"),
});

export type DocumentAnalysis = z.infer<typeof AnalysisSchema>;

const TEXT_MIME_TYPES = ["text/plain", "text/csv"];

async function persist(versionId: string, result: DocumentAnalysis) {
  await prisma.documentVersion.update({
    where: { id: versionId },
    data: { aiSummary: result.summary, aiFlags: { keyFigures: result.keyFigures, inconsistencies: result.inconsistencies } },
  });
}

/**
 * "AI assist" for document review: extracts key figures, summarises, and
 * flags inconsistencies against recorded KPI actuals — always presented as
 * suggestions on the document detail page, never used to auto-approve or
 * auto-return anything. The review workflow buttons are unaffected by this.
 */
export async function analyzeDocumentVersion(user: CurrentUser, versionId: string): Promise<DocumentAnalysis> {
  if (!canReviewDocuments(user.role)) throw new Error("Forbidden: this role cannot run AI analysis.");

  const version = await prisma.documentVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { document: { include: { entity: true } } },
  });
  assertEntityAccess(user, version.document.entityId);

  if (!TEXT_MIME_TYPES.includes(version.mimeType)) {
    const result: DocumentAnalysis = {
      summary: "AI analysis is only available for text-based documents in this prototype — Word/Excel/PDF text extraction isn't wired up.",
      keyFigures: [],
      inconsistencies: [],
    };
    await persist(versionId, result);
    return result;
  }

  const buffer = await storage.getObject(version.storageKey);
  const rawText = buffer.toString("utf-8").slice(0, 8000); // keep prompts bounded
  const text = redactPii(rawText);

  const kpiActuals = version.document.reportingPeriodId
    ? await prisma.performanceReport.findMany({
        where: { reportingPeriodId: version.document.reportingPeriodId, kpi: { entityId: version.document.entityId } },
        include: { kpi: { select: { name: true, unit: true } } },
      })
    : [];
  const kpiActualsSummary =
    kpiActuals.map((r) => `${r.kpi.name}: ${r.actualValue.toString()} ${r.kpi.unit}`).join("\n") || "None recorded for this reporting period.";

  if (!isAiConfigured) {
    const result: DocumentAnalysis = {
      summary: `ANTHROPIC_API_KEY isn't set, so this is a placeholder rather than a real analysis. Document is ${rawText.length.toLocaleString()} characters of ${version.mimeType}.`,
      keyFigures: [],
      inconsistencies: [],
    };
    await logAiInteraction({
      userId: user.id,
      entityId: version.document.entityId,
      action: "DOCUMENT_ANALYSIS",
      targetId: versionId,
      promptSummary: text.slice(0, 500),
      responseSummary: result.summary,
    });
    await persist(versionId, result);
    return result;
  }

  const client = getClaudeClient();
  const response = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system:
      "You are assisting a DSAC reviewer checking a public entity's submitted report. You never approve, reject, or decide anything yourself — you only produce suggestions for a human reviewer to consider. All data is synthetic demo data.",
    messages: [
      {
        role: "user",
        content: `Document type: ${version.document.type}\nEntity: ${version.document.entity.name}\n\nRecorded KPI actuals for this reporting period, from the system (not the document):\n${kpiActualsSummary}\n\nDocument content:\n${text}\n\nSummarise the document, extract any key figures it reports, and flag any figures that conflict with the recorded KPI actuals above. If the document has no figures relevant to those KPIs, say so in the summary rather than inventing an inconsistency.`,
      },
    ],
    output_config: { format: zodOutputFormat(AnalysisSchema) },
  });

  const result: DocumentAnalysis = response.parsed_output ?? {
    summary: "Could not parse a structured analysis from the model's response.",
    keyFigures: [],
    inconsistencies: [],
  };

  await logAiInteraction({
    userId: user.id,
    entityId: version.document.entityId,
    action: "DOCUMENT_ANALYSIS",
    targetId: versionId,
    promptSummary: text.slice(0, 500),
    responseSummary: result.summary,
  });
  await persist(versionId, result);
  return result;
}
