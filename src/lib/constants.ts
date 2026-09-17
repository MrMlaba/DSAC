import type { Role } from "@prisma/client";

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

/** Roles that are not scoped to a single entity — they see across DSAC. */
export const DSAC_WIDE_ROLES: Role[] = ["DSAC_ADMIN", "DSAC_ANALYST"];

export function isDsacWideRole(role: Role): boolean {
  return DSAC_WIDE_ROLES.includes(role);
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
