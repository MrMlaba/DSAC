import { test, expect, type Page } from "@playwright/test";

/**
 * Happy-path e2e tests through a real browser:
 *  1. DSAC: portfolio dashboard → Entities & NPOs → one organisation → its six tabs, with the same
 *     money figure on the Overview cards and the Finance tab total.
 *  2. Entity: its own dashboard and the entity-only sidebar.
 *
 * Runs against whatever is on :3000 (`pnpm start` or `pnpm dev`); reuses it if already running.
 * Generous timeouts — a cold `pnpm dev` compile of a heavy route can take 10-25s.
 */
async function signInAs(page: Page, name: RegExp) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByRole("button", { name }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test("DSAC: dashboard → entities → one organisation's six tabs", async ({ page }) => {
  await signInAs(page, /Thandiwe Mokoena/i);

  // The portfolio dashboard answers "how much approved / disbursed / utilised" at a glance.
  await expect(page.getByRole("heading", { name: "Portfolio overview" })).toBeVisible({ timeout: 30_000 });
  for (const label of ["Total organisations monitored", "Total approved budget", "Total disbursed to date", "Total utilised to date", "Overall utilisation", "Overall compliance rate"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  // Simple sidebar: exactly the six items from the spec.
  for (const item of ["Dashboard", "Entities & NPOs", "Reports", "Requests / Support", "Alerts", "Administration"]) {
    await expect(page.getByRole("link", { name: item, exact: true })).toBeVisible();
  }

  // Entities & NPOs → search → open one organisation.
  await page.getByRole("link", { name: "Entities & NPOs", exact: true }).click();
  await page.getByLabel("Search organisations").fill("Frontier");
  await page.getByRole("link", { name: "Frontier History Museum Trust" }).first().click();

  // Overview: the summary cards.
  await expect(page.getByText("Approved annual budget", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Next reporting due date", { exact: true })).toBeVisible();
  const approvedOnOverview = await page.getByText("Approved annual budget", { exact: true }).locator("xpath=ancestor::*[@data-slot='card'][1]").locator("[data-slot='card-title']").innerText();

  // The same six tabs on every organisation.
  const tabs = page.getByRole("navigation", { name: "Entity sections" });
  for (const tab of ["Overview", "Performance", "Finance", "Compliance", "Reports", "Profile"]) {
    await expect(tabs.getByRole("link", { name: tab, exact: true })).toBeVisible();
  }

  await tabs.getByRole("link", { name: "Performance", exact: true }).click();
  await expect(page.getByText("Key performance indicators")).toBeVisible({ timeout: 30_000 });

  // Finance: annual budget vs cumulative actual — no Q1–Q4 columns — and the same approved figure.
  await tabs.getByRole("link", { name: "Finance", exact: true }).click();
  await expect(page.getByText("Annual budget vs actual expenditure to date")).toBeVisible({ timeout: 30_000 });
  const approvedOnFinance = await page.getByText("Approved annual budget", { exact: true }).first().locator("xpath=ancestor::*[@data-slot='card'][1]").locator("[data-slot='card-title']").innerText();
  expect(approvedOnFinance).toBe(approvedOnOverview);
  await expect(page.getByRole("columnheader", { name: /^Q[1-4]$/ })).toHaveCount(0);

  await tabs.getByRole("link", { name: "Compliance", exact: true }).click();
  await expect(page.getByText("Compliance requirements")).toBeVisible({ timeout: 30_000 });
});

test("Entity: own dashboard and entity-only sidebar", async ({ page }) => {
  await signInAs(page, /Lindiwe Dube/i);

  await expect(page.getByRole("heading", { name: "Frontier History Museum Trust" })).toBeVisible({ timeout: 30_000 });
  for (const item of ["Dashboard", "Performance", "Finance", "Compliance", "Reports", "Requests", "Documents", "Profile"]) {
    await expect(page.getByRole("link", { name: item, exact: true })).toBeVisible();
  }
  // The DSAC-only areas are not offered to an entity.
  await expect(page.getByRole("link", { name: "Entities & NPOs", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Administration", exact: true })).toHaveCount(0);

  for (const section of ["Upcoming deadlines", "Recent submissions", "Latest DSAC feedback"]) {
    await expect(page.getByText(section, { exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "Finance", exact: true }).click();
  await expect(page.getByText("Annual budget vs actual expenditure to date")).toBeVisible({ timeout: 30_000 });
});
