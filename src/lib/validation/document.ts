import { z } from "zod";

/** Validates the non-file fields of a document upload — file type/size are checked separately in src/lib/data/documents.ts against the actual bytes, not just the client-supplied metadata. */
export const uploadDocumentMetadataSchema = z.object({
  entityId: z.string().min(1),
  documentId: z.string().min(1).optional(),
  type: z.enum(["STRATEGIC_PLAN", "APP", "OPERATIONAL_PLAN", "ANNUAL_REPORT", "QUARTERLY_REPORT", "FINANCIALS", "OTHER"]),
  title: z.string().trim().min(1, "Title is required.").max(200, "Keep the title under 200 characters."),
  financialYearId: z.string().min(1),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4", "ANNUAL"]).optional(),
  changeNote: z.string().trim().max(1000).optional(),
  /** Evidence links: what this document supports. At most one of these is set by the upload dialog. */
  reportId: z.string().min(1).optional(),
  kpiId: z.string().min(1).optional(),
  budgetLineId: z.string().min(1).optional(),
});

export const reviewDocumentSchema = z.object({
  action: z.enum(["start_review", "approve", "return"]),
  comment: z.string().trim().max(2000).optional(),
});
