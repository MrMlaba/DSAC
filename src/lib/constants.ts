import type { ExpenseCategory, ReportStatus, RequestCategory, RequestStatus } from "@prisma/client";
import type { ComplianceState, EntityComplianceStatus } from "@/lib/calc/compliance";
import type { KpiStatus, PerformanceBand } from "@/lib/calc/performance";
import type { Role, Sector, EntityType, Gender, RaceCategory, AgeBand, DisabilityStatus, AuditOpinion, JobType, Quarter, DocumentType, TaskDirection, TaskStatus } from "@prisma/client";

export const APP_NAME = "DSAC Reporting & Oversight";
export const DEMO_BANNER = "Demo – synthetic data";

export const ROLE_LABELS: Record<Role, string> = {
  DSAC_ADMIN: "DSAC Admin",
  DSAC_ANALYST: "DSAC Analyst / Manager",
  ENTITY_ADMIN: "Entity Admin",
  ENTITY_CONTRIBUTOR: "Entity Contributor",
  EXECUTIVE_VIEWER: "Executive Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  DSAC_ADMIN: "Manages entities, reporting cycles, targets and users across DSAC.",
  DSAC_ANALYST: "Reviews and approves submissions across all entities, receives alerts.",
  ENTITY_ADMIN: "Manages a single entity's users and submissions.",
  ENTITY_CONTRIBUTOR: "Uploads documents, edits KPIs, comments and completes tasks.",
  EXECUTIVE_VIEWER: "Read-only dashboards for executive oversight.",
};

export const SECTOR_LABELS: Record<Sector, string> = {
  SPORT: "Sport",
  ARTS: "Arts",
  CULTURE: "Culture",
  HERITAGE: "Heritage",
  MUSEUMS: "Museums",
  LIBRARIES: "Libraries",
  ARCHIVES: "Archives",
  OTHER: "Other",
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  PUBLIC_ENTITY: "Public Entity",
  NPO: "NPO",
};

export const GENDER_LABELS: Record<Gender, string> = {
  FEMALE: "Female",
  MALE: "Male",
  OTHER: "Other",
};

export const RACE_LABELS: Record<RaceCategory, string> = {
  AFRICAN: "African",
  COLOURED: "Coloured",
  INDIAN: "Indian",
  WHITE: "White",
  OTHER: "Other",
};

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  UNDER_25: "Under 25",
  AGE_25_34: "25–34",
  AGE_35_44: "35–44",
  AGE_45_54: "45–54",
  AGE_55_PLUS: "55+",
};

export const DISABILITY_LABELS: Record<DisabilityStatus, string> = {
  WITH_DISABILITY: "With disability",
  WITHOUT_DISABILITY: "Without disability",
};

export const AUDIT_OPINION_LABELS: Record<AuditOpinion, string> = {
  CLEAN: "Clean audit",
  UNQUALIFIED_WITH_FINDINGS: "Unqualified with findings",
  QUALIFIED: "Qualified",
  ADVERSE: "Adverse",
  DISCLAIMER: "Disclaimer",
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  PERMANENT: "Permanent",
  TEMPORARY: "Temporary",
  YOUTH: "Youth",
};

export const QUARTER_LABELS: Record<Quarter, string> = {
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4",
  ANNUAL: "Annual report",
};

export const QUARTER_ORDER: Quarter[] = ["Q1", "Q2", "Q3", "Q4", "ANNUAL"];

/** Reporting-cycle quarters used for portfolio/entity filtering — excludes ANNUAL, which the seed data doesn't create reporting periods for. */
export const PORTFOLIO_QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

/**
 * Roles that are not scoped to a single entity — they see across DSAC.
 * This governs read visibility only. EXECUTIVE_VIEWER is DSAC-wide but
 * read-only: any future approve/return/edit action must gate separately
 * (e.g. `role !== "EXECUTIVE_VIEWER"`), not just on this list.
 */
export const DSAC_WIDE_ROLES: Role[] = ["DSAC_ADMIN", "DSAC_ANALYST", "EXECUTIVE_VIEWER"];

export function isDsacWideRole(role: Role): boolean {
  return DSAC_WIDE_ROLES.includes(role);
}

export const READ_ONLY_ROLES: Role[] = ["EXECUTIVE_VIEWER"];

export function isReadOnlyRole(role: Role): boolean {
  return READ_ONLY_ROLES.includes(role);
}

/** Who can upload/version a document for an entity (still tenant-scoped — see assertEntityAccess). */
export const DOCUMENT_UPLOAD_ROLES: Role[] = ["ENTITY_ADMIN", "ENTITY_CONTRIBUTOR", "DSAC_ADMIN"];

export function canUploadDocuments(role: Role): boolean {
  return DOCUMENT_UPLOAD_ROLES.includes(role);
}

/** Who can approve/return a submitted document version. DSAC_ANALYST reviews; EXECUTIVE_VIEWER never acts. */
export const DOCUMENT_REVIEW_ROLES: Role[] = ["DSAC_ADMIN", "DSAC_ANALYST"];

export function canReviewDocuments(role: Role): boolean {
  return DOCUMENT_REVIEW_ROLES.includes(role);
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  STRATEGIC_PLAN: "Strategic Plan",
  APP: "Annual Performance Plan",
  OPERATIONAL_PLAN: "Operational Plan",
  ANNUAL_REPORT: "Annual Report",
  QUARTERLY_REPORT: "Quarterly Report",
  FINANCIALS: "Financial Statements",
  OTHER: "Other",
};

export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  "STRATEGIC_PLAN",
  "APP",
  "OPERATIONAL_PLAN",
  "QUARTERLY_REPORT",
  "ANNUAL_REPORT",
  "FINANCIALS",
  "OTHER",
];

/** Document types tied to a specific quarter rather than a whole financial year. */
export const QUARTERLY_DOCUMENT_TYPES: DocumentType[] = ["QUARTERLY_REPORT"];

export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const ALLOWED_UPLOAD_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
  "text/csv": ".csv",
};

/** Days-before-due-date thresholds for deadline alerts (configurable via env). */
export function getDeadlineAlertDays(): number[] {
  const raw = process.env.DEADLINE_ALERT_DAYS ?? "30,15";
  return raw
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => b - a);
}

export const TASK_DIRECTION_LABELS: Record<TaskDirection, string> = {
  INTERNAL: "Within entity",
  TO_DSAC: "To DSAC",
  FROM_DSAC: "From DSAC",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
};

export const TASK_STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

/** Directions a role may create a task with — entity roles request/delegate within their scope, DSAC roles delegate down to an entity. */
export function taskDirectionsForRole(role: Role): TaskDirection[] {
  if (isDsacWideRole(role)) return ["FROM_DSAC"];
  return ["INTERNAL", "TO_DSAC"];
}

/** Only DSAC Admin sees the audit log (under Administration). */
export const AUDIT_LOG_ROLES: Role[] = ["DSAC_ADMIN"];

export function canViewAuditLog(role: Role): boolean {
  return AUDIT_LOG_ROLES.includes(role);
}

/** Only DSAC Admin can delete/restore documents — the most consequential document action, kept the narrowest. */
export function canDeleteDocuments(role: Role): boolean {
  return role === "DSAC_ADMIN";
}

/** Default retention period per document type, matching typical public-sector record-keeping practice. Advisory/display-only in this prototype — see docs/SECURITY.md. */
export const DOCUMENT_RETENTION_YEARS: Record<DocumentType, number> = {
  STRATEGIC_PLAN: 10,
  APP: 5,
  OPERATIONAL_PLAN: 5,
  ANNUAL_REPORT: 7,
  QUARTERLY_REPORT: 5,
  FINANCIALS: 7,
  OTHER: 5,
};

export function computeRetentionUntil(type: DocumentType, from: Date = new Date()): Date {
  const result = new Date(from);
  result.setFullYear(result.getFullYear() + DOCUMENT_RETENTION_YEARS[type]);
  return result;
}

// ---------------------------------------------------------------------------
// Finance, performance, compliance, reports and requests
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  EMPLOYEE_COSTS: "Employee Costs",
  PROGRAMME_COSTS: "Programme Costs",
  TRAVEL: "Travel",
  ADMINISTRATION: "Administration",
  PROFESSIONAL_FEES: "Professional Fees",
  CAPITAL_EXPENDITURE: "Capital Expenditure",
  OTHER: "Other Approved Categories",
};

export const KPI_STATUS_LABELS: Record<KpiStatus, string> = {
  ACHIEVED: "Achieved",
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  NOT_ACHIEVED: "Not Achieved",
};

export const PERFORMANCE_BAND_LABELS: Record<PerformanceBand, string> = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  UNDER_TARGET: "Under Target",
  NO_DATA: "No data yet",
};

export const COMPLIANCE_STATE_LABELS: Record<ComplianceState, string> = {
  COMPLIANT: "Compliant",
  LATE_SUBMISSION: "Submitted late",
  RETURNED: "Returned for correction",
  DUE_SOON: "Due soon",
  UPCOMING: "Upcoming",
  OVERDUE: "Overdue",
};

export const ENTITY_COMPLIANCE_LABELS: Record<EntityComplianceStatus, string> = {
  COMPLIANT: "Compliant",
  ATTENTION_REQUIRED: "Attention Required",
  OVERDUE_REPORTING: "Overdue Reporting",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  ACCEPTED: "Accepted",
  RETURNED: "Returned for correction",
  FINALISED: "Finalised",
};

export const REQUEST_CATEGORY_LABELS: Record<RequestCategory, string> = {
  BUDGET_REQUEST: "Budget request",
  ADDITIONAL_FUNDING: "Additional funding",
  TECHNICAL_SUPPORT: "Technical support",
  GOVERNANCE_ASSISTANCE: "Governance assistance",
  PROGRAMME_SUPPORT: "Programme support",
  CAPACITY_BUILDING: "Capacity-building support",
};

/** Categories where an amount is expected. */
export const FUNDING_REQUEST_CATEGORIES: RequestCategory[] = ["BUDGET_REQUEST", "ADDITIONAL_FUNDING"];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  DECLINED: "Declined",
  MORE_INFO_REQUIRED: "More information required",
  COMPLETED: "Completed",
};

/** Entity staff who capture performance and expenditure and submit reports and requests. */
export function canCaptureReportingData(role: Role): boolean {
  return role === "ENTITY_ADMIN" || role === "ENTITY_CONTRIBUTOR";
}

/** DSAC staff who review submitted reports and decide requests. */
export function canReviewReports(role: Role): boolean {
  return role === "DSAC_ADMIN" || role === "DSAC_ANALYST";
}

/** Only DSAC Admin gives the final sign-off that finalises an accepted report. */
export function canFinaliseReports(role: Role): boolean {
  return role === "DSAC_ADMIN";
}

/** Administration (standards, audit log) is DSAC Admin only. */
export function canAdminister(role: Role): boolean {
  return role === "DSAC_ADMIN";
}
