import type { Role, Sector, EntityType, Gender, RaceCategory, AgeBand, DisabilityStatus, AuditOpinion, JobType, Quarter } from "@prisma/client";

export const APP_NAME = "DSAC Performance & Reporting Platform";
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

/** Days-before-due-date thresholds for deadline alerts (configurable via env). */
export function getDeadlineAlertDays(): number[] {
  const raw = process.env.DEADLINE_ALERT_DAYS ?? "30,15";
  return raw
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => b - a);
}

export function getDeadlineHourlyWindowHours(): number {
  const raw = process.env.DEADLINE_ALERT_HOURLY_WITHIN_HOURS ?? "24";
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 24 : parsed;
}
