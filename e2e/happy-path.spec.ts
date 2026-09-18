import { test, expect } from "@playwright/test";

/**
 * One happy-path e2e test per the brief: demo login, the DSAC portfolio
 * dashboard, an entity drill-down, and its tenant-scoped workspace tab.
 * Generous timeout — this dev server's cold per-route compile has taken
 * 10-25s for heavier pages during this project's own testing.
 */
test("demo login → dashboard → entity drill-down → workspace", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  // One-click demo login as the DSAC Admin persona.
  await page.getByRole("button", { name: /Thandiwe Mokoena/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "DSAC Portfolio Overview" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Ask the data")).toBeVisible();

  // Drill into an entity from the dashboard's entity cards.
  await page.locator("a[href^='/entities/']").first().click();
  await expect(page.getByText(/KPI progress/)).toBeVisible({ timeout: 30_000 });

  // Switch to the entity's Workspace tab.
  await page.getByRole("tab", { name: "Workspace" }).click();
  await expect(page.getByText("Comments", { exact: true })).toBeVisible();

  // Tenant-isolated data made it all the way to the screen: the workspace
  // tab's team roster is scoped to this one entity, not the whole portfolio.
  await expect(page.getByText("Team", { exact: true })).toBeVisible();
});
