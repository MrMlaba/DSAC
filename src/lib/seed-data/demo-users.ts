import type { Role } from "@prisma/client";

/**
 * The shared password for every demo account. This is a hackathon prototype
 * seeded with synthetic data only — never reuse this pattern for real
 * credentials.
 */
export const DEMO_PASSWORD = "Demo@2026";

export interface DemoUserSeed {
  name: string;
  email: string;
  role: Role;
  /** Entity slug from entities.ts; omit for DSAC-wide roles. */
  entitySlug?: string;
}

export const DEMO_USERS: DemoUserSeed[] = [
  {
    name: "Thandiwe Mokoena",
    email: "thandiwe.mokoena@dsac.demo.gov.za",
    role: "DSAC_ADMIN",
  },
  {
    name: "Sipho Ndlovu",
    email: "sipho.ndlovu@dsac.demo.gov.za",
    role: "DSAC_ANALYST",
  },
  {
    name: "Naledi Pretorius",
    email: "naledi.pretorius@dsac.demo.gov.za",
    role: "EXECUTIVE_VIEWER",
  },
  // Healthy entity — for a clean contrast during the demo.
  {
    name: "Zanele Khumalo",
    email: "zanele.khumalo@nsea.demo.org",
    role: "ENTITY_ADMIN",
    entitySlug: "national-sports-excellence-agency",
  },
  {
    name: "Bongani Sithole",
    email: "bongani.sithole@nsea.demo.org",
    role: "ENTITY_CONTRIBUTOR",
    entitySlug: "national-sports-excellence-agency",
  },
  // Critical entity — for the early-warning walkthrough.
  {
    name: "Lindiwe Dube",
    email: "lindiwe.dube@frontierheritage.demo.org",
    role: "ENTITY_ADMIN",
    entitySlug: "frontier-history-museum-trust",
  },
  {
    name: "Kagiso Mahlangu",
    email: "kagiso.mahlangu@frontierheritage.demo.org",
    role: "ENTITY_CONTRIBUTOR",
    entitySlug: "frontier-history-museum-trust",
  },
  // A watch-list NPO, to show the NPO side of the roster.
  {
    name: "Precious Nkosi",
    email: "precious.nkosi@youthculturalfund.demo.org",
    role: "ENTITY_ADMIN",
    entitySlug: "youth-cultural-development-fund",
  },
];
