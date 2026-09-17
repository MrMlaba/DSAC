import { describe, expect, it } from "vitest";
import { assertEntityAccess, entityIdScopeWhere, entityScopeWhere, type CurrentUser } from "./tenant-scope";

function user(overrides: Partial<CurrentUser>): CurrentUser {
  return { id: "u1", name: "Test User", email: "t@example.com", role: "ENTITY_CONTRIBUTOR", entityId: "entity-a", ...overrides };
}

describe("tenant isolation guards", () => {
  describe("assertEntityAccess", () => {
    it("allows an entity user to access their own entity", () => {
      expect(() => assertEntityAccess(user({ entityId: "entity-a" }), "entity-a")).not.toThrow();
    });

    it("blocks an entity user from accessing another entity", () => {
      expect(() => assertEntityAccess(user({ entityId: "entity-a" }), "entity-b")).toThrow(/Forbidden/);
    });

    it("allows DSAC_ADMIN to access any entity", () => {
      expect(() => assertEntityAccess(user({ role: "DSAC_ADMIN", entityId: null }), "entity-b")).not.toThrow();
    });

    it("allows DSAC_ANALYST to access any entity", () => {
      expect(() => assertEntityAccess(user({ role: "DSAC_ANALYST", entityId: null }), "entity-b")).not.toThrow();
    });

    it("allows EXECUTIVE_VIEWER (DSAC-wide, read-only) to access any entity", () => {
      expect(() => assertEntityAccess(user({ role: "EXECUTIVE_VIEWER", entityId: null }), "entity-b")).not.toThrow();
    });
  });

  describe("entityScopeWhere", () => {
    it("scopes entity-bound roles to their own entityId", () => {
      expect(entityScopeWhere(user({ entityId: "entity-a" }))).toEqual({ entityId: "entity-a" });
    });

    it("returns an unsatisfiable filter for an entity-bound role with no entityId", () => {
      const where = entityScopeWhere(user({ entityId: null }));
      expect(where.entityId).toBeDefined();
      expect(where.entityId).not.toBe("entity-a");
    });

    it("returns no restriction for DSAC-wide roles", () => {
      expect(entityScopeWhere(user({ role: "DSAC_ADMIN", entityId: null }))).toEqual({});
      expect(entityScopeWhere(user({ role: "DSAC_ANALYST", entityId: null }))).toEqual({});
      expect(entityScopeWhere(user({ role: "EXECUTIVE_VIEWER", entityId: null }))).toEqual({});
    });

    it("never leaks another entity's rows for an entity-bound role", () => {
      const where = entityScopeWhere(user({ role: "ENTITY_ADMIN", entityId: "entity-a" }));
      expect(where).toEqual({ entityId: "entity-a" });
      expect(where.entityId).not.toBe("entity-b");
    });
  });

  describe("entityIdScopeWhere", () => {
    it("scopes to the user's own entity id field", () => {
      expect(entityIdScopeWhere(user({ entityId: "entity-a" }))).toEqual({ id: "entity-a" });
    });

    it("returns no restriction for DSAC-wide roles, including EXECUTIVE_VIEWER", () => {
      expect(entityIdScopeWhere(user({ role: "EXECUTIVE_VIEWER", entityId: null }))).toEqual({});
    });
  });
});
