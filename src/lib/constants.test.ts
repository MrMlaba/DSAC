import { describe, expect, it } from "vitest";
import { canReviewDocuments, canUploadDocuments, isDsacWideRole, isReadOnlyRole } from "./constants";
import type { Role } from "@prisma/client";

const ALL_ROLES: Role[] = ["DSAC_ADMIN", "DSAC_ANALYST", "ENTITY_ADMIN", "ENTITY_CONTRIBUTOR", "EXECUTIVE_VIEWER"];

describe("role capability matrix", () => {
  it("DSAC-wide visibility matches DSAC_ADMIN, DSAC_ANALYST and EXECUTIVE_VIEWER only", () => {
    const wide = ALL_ROLES.filter(isDsacWideRole);
    expect(wide.sort()).toEqual(["DSAC_ADMIN", "DSAC_ANALYST", "EXECUTIVE_VIEWER"].sort());
  });

  it("EXECUTIVE_VIEWER is DSAC-wide (sees the portfolio) but read-only", () => {
    expect(isDsacWideRole("EXECUTIVE_VIEWER")).toBe(true);
    expect(isReadOnlyRole("EXECUTIVE_VIEWER")).toBe(true);
  });

  it("no other role is marked read-only", () => {
    const readOnly = ALL_ROLES.filter(isReadOnlyRole);
    expect(readOnly).toEqual(["EXECUTIVE_VIEWER"]);
  });

  it("only entity roles and DSAC_ADMIN can upload documents", () => {
    const uploaders = ALL_ROLES.filter(canUploadDocuments);
    expect(uploaders.sort()).toEqual(["DSAC_ADMIN", "ENTITY_ADMIN", "ENTITY_CONTRIBUTOR"].sort());
  });

  it("EXECUTIVE_VIEWER can never upload documents despite being DSAC-wide", () => {
    expect(canUploadDocuments("EXECUTIVE_VIEWER")).toBe(false);
  });

  it("only DSAC_ADMIN and DSAC_ANALYST can review documents", () => {
    const reviewers = ALL_ROLES.filter(canReviewDocuments);
    expect(reviewers.sort()).toEqual(["DSAC_ADMIN", "DSAC_ANALYST"].sort());
  });

  it("EXECUTIVE_VIEWER can never review documents", () => {
    expect(canReviewDocuments("EXECUTIVE_VIEWER")).toBe(false);
  });

  it("entity roles can never review documents (no self-approval)", () => {
    expect(canReviewDocuments("ENTITY_ADMIN")).toBe(false);
    expect(canReviewDocuments("ENTITY_CONTRIBUTOR")).toBe(false);
  });
});
