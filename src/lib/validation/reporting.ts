import { z } from "zod";

const quarter = z.enum(["Q1", "Q2", "Q3", "Q4"]);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const performanceCaptureSchema = z.object({
  entityId: z.string().min(1),
  financialYearId: z.string().min(1),
  quarter,
  entries: z
    .array(
      z.object({
        kpiId: z.string().min(1),
        actual: z.number().finite("Enter a number.").min(0, "Actual performance cannot be negative.").max(1_000_000_000),
        varianceExplanation: optionalText(1000),
        correctiveAction: optionalText(1000),
      }),
    )
    .min(1, "Enter at least one KPI result.")
    .max(200),
});

export const expenditureCaptureSchema = z.object({
  entityId: z.string().min(1),
  financialYearId: z.string().min(1),
  quarter,
  entries: z
    .array(
      z.object({
        budgetLineId: z.string().min(1),
        amount: z.number().finite("Enter an amount.").min(0, "Expenditure cannot be negative.").max(1_000_000_000_000),
        note: optionalText(500),
      }),
    )
    .min(1, "Enter at least one expenditure amount.")
    .max(50),
});

export const reportReviewSchema = z.object({
  action: z.enum(["START_REVIEW", "ACCEPT", "RETURN", "FINALISE"]),
  comment: optionalText(2000),
});

export const createRequestSchema = z.object({
  title: z.string().trim().min(3, "Give the request a short title.").max(200),
  category: z.enum(["BUDGET_REQUEST", "ADDITIONAL_FUNDING", "TECHNICAL_SUPPORT", "GOVERNANCE_ASSISTANCE", "PROGRAMME_SUPPORT", "CAPACITY_BUILDING"]),
  amountRequested: z.number().finite().positive("The amount must be more than zero.").max(10_000_000_000).optional(),
  motivation: z.string().trim().min(10, "Explain why this is needed (at least a sentence).").max(4000),
  linkedProgramme: optionalText(200),
  expectedOutcome: z.string().trim().min(5, "Describe the outcome you expect.").max(2000),
});

export const requestDecisionSchema = z.object({
  action: z.enum(["START_REVIEW", "APPROVE", "DECLINE", "REQUEST_INFO", "COMPLETE"]),
  note: optionalText(2000),
});

export const requestRespondSchema = z.object({
  note: z.string().trim().min(3, "Add the information DSAC asked for.").max(2000),
});

/** Money is captured to the cent. */
export const toRandCents = (value: number) => Math.round(value * 100) / 100;
