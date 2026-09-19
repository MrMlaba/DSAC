import { describe, expect, it } from "vitest";
import { navItemsForRole } from "./nav-items";

const titles = (role: Parameters<typeof navItemsForRole>[0]) => navItemsForRole(role).map((i) => i.title);

describe("navigation follows the brief's two sidebars", () => {
  it("DSAC Admin sees exactly: Dashboard, Entities & NPOs, Reports, Requests / Support, Alerts, Administration", () => {
    expect(titles("DSAC_ADMIN")).toEqual(["Dashboard", "Entities & NPOs", "Reports", "Requests / Support", "Alerts", "Administration"]);
  });

  it("other DSAC roles get the same sidebar without Administration", () => {
    for (const role of ["DSAC_ANALYST", "EXECUTIVE_VIEWER"] as const) {
      expect(titles(role)).toEqual(["Dashboard", "Entities & NPOs", "Reports", "Requests / Support", "Alerts"]);
    }
  });

  it("entity roles see exactly: Dashboard, Performance, Finance, Compliance, Reports, Requests, Documents, Profile", () => {
    for (const role of ["ENTITY_ADMIN", "ENTITY_CONTRIBUTOR"] as const) {
      expect(titles(role)).toEqual(["Dashboard", "Performance", "Finance", "Compliance", "Reports", "Requests", "Documents", "Profile"]);
    }
  });

  it("entities never see the DSAC-only areas", () => {
    const entityHrefs = navItemsForRole("ENTITY_ADMIN").map((i) => i.href);
    for (const dsacOnly of ["/entities", "/alerts", "/administration"]) expect(entityHrefs).not.toContain(dsacOnly);
  });
});
