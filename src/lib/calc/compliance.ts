import { ratio } from "./money";

export type ReportStatusKey = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "RETURNED" | "FINALISED";

/** Statuses meaning the report has reached DSAC. */
export const DELIVERED_STATUSES: readonly ReportStatusKey[] = ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "FINALISED"];

export type ComplianceState = "COMPLIANT" | "LATE_SUBMISSION" | "RETURNED" | "DUE_SOON" | "UPCOMING" | "OVERDUE";
/** green = Compliant · amber = Due soon / Attention required · red = Overdue · neutral = not due yet */
export type ComplianceColour = "green" | "amber" | "red" | "neutral";

export const DEFAULT_DUE_SOON_DAYS = 30;
const DAY_MS = 86_400_000;

function utcDay(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

/** Whole days from today to the due date. 0 = due today, negative = overdue. Due dates are inclusive. */
export function daysUntilDue(dueDate: Date, today: Date): number {
  return utcDay(dueDate) - utcDay(today);
}

export function isPastDue(dueDate: Date, today: Date): boolean {
  return daysUntilDue(dueDate, today) < 0;
}

export interface ComplianceItem {
  status: ReportStatusKey;
  dueDate: Date;
  submittedAt: Date | null;
}

export interface ComplianceResult {
  state: ComplianceState;
  colour: ComplianceColour;
  daysUntilDue: number;
}

const STATE_COLOUR: Record<ComplianceState, ComplianceColour> = {
  COMPLIANT: "green",
  LATE_SUBMISSION: "amber",
  RETURNED: "amber",
  DUE_SOON: "amber",
  UPCOMING: "neutral",
  OVERDUE: "red",
};

export function complianceOf(item: ComplianceItem, today: Date, dueSoonDays = DEFAULT_DUE_SOON_DAYS): ComplianceResult {
  const days = daysUntilDue(item.dueDate, today);
  let state: ComplianceState;

  if (DELIVERED_STATUSES.includes(item.status)) {
    const onTime = !item.submittedAt || utcDay(item.submittedAt) <= utcDay(item.dueDate);
    state = onTime ? "COMPLIANT" : "LATE_SUBMISSION";
  } else if (item.status === "RETURNED") {
    state = "RETURNED";
  } else if (days < 0) {
    state = "OVERDUE";
  } else if (days <= dueSoonDays) {
    state = "DUE_SOON";
  } else {
    state = "UPCOMING";
  }

  return { state, colour: STATE_COLOUR[state], daysUntilDue: days };
}

export type EntityComplianceStatus = "COMPLIANT" | "ATTENTION_REQUIRED" | "OVERDUE_REPORTING";

export interface ComplianceSummary {
  total: number;
  /** Reached DSAC (submitted, under review, accepted or finalised). */
  submitted: number;
  /** Past due and still owed: never submitted, or returned for correction. */
  outstanding: number;
  /** total − submitted − outstanding: nothing owed yet. */
  notYetDue: number;
  /** Reports that count towards the compliance rate: already delivered, or past due. */
  assessed: number;
  /** Assessed reports delivered on or before their due date. */
  compliant: number;
  /** compliant ÷ assessed. */
  rate: number | null;
  overdue: number;
  dueSoon: number;
  returned: number;
  late: number;
  status: EntityComplianceStatus;
}

export function summariseCompliance(items: readonly ComplianceItem[], today: Date, dueSoonDays = DEFAULT_DUE_SOON_DAYS): ComplianceSummary {
  let submitted = 0;
  let outstanding = 0;
  let assessed = 0;
  let compliant = 0;
  let overdue = 0;
  let dueSoon = 0;
  let returned = 0;
  let late = 0;

  for (const item of items) {
    const result = complianceOf(item, today, dueSoonDays);
    const delivered = DELIVERED_STATUSES.includes(item.status);
    const pastDue = result.daysUntilDue < 0;

    if (delivered) submitted++;
    if (!delivered && pastDue) outstanding++;
    if (delivered || pastDue) assessed++;
    if (result.state === "COMPLIANT") compliant++;
    if (result.state === "OVERDUE") overdue++;
    if (result.state === "DUE_SOON") dueSoon++;
    if (result.state === "RETURNED") returned++;
    if (result.state === "LATE_SUBMISSION") late++;
  }

  const status: EntityComplianceStatus = overdue > 0 ? "OVERDUE_REPORTING" : returned > 0 || dueSoon > 0 ? "ATTENTION_REQUIRED" : "COMPLIANT";

  return {
    total: items.length,
    submitted,
    outstanding,
    notYetDue: items.length - submitted - outstanding,
    assessed,
    compliant,
    rate: ratio(compliant, assessed),
    overdue,
    dueSoon,
    returned,
    late,
    status,
  };
}

/** Portfolio roll-up: pool the counts, then take the ratio. */
export function combineCompliance(summaries: readonly ComplianceSummary[]): ComplianceSummary {
  const sum = (pick: (s: ComplianceSummary) => number) => summaries.reduce((total, s) => total + pick(s), 0);
  const assessed = sum((s) => s.assessed);
  const compliant = sum((s) => s.compliant);
  const overdue = sum((s) => s.overdue);
  const returned = sum((s) => s.returned);
  const dueSoon = sum((s) => s.dueSoon);
  return {
    total: sum((s) => s.total),
    submitted: sum((s) => s.submitted),
    outstanding: sum((s) => s.outstanding),
    notYetDue: sum((s) => s.notYetDue),
    assessed,
    compliant,
    rate: ratio(compliant, assessed),
    overdue,
    dueSoon,
    returned,
    late: sum((s) => s.late),
    status: overdue > 0 ? "OVERDUE_REPORTING" : returned > 0 || dueSoon > 0 ? "ATTENTION_REQUIRED" : "COMPLIANT",
  };
}
