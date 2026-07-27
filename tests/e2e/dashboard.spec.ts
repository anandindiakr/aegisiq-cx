import { test, expect } from "@playwright/test";
import { signIn, hasCredentials, expectRedirectedToSignIn } from "./helpers";

test.describe("dashboard", () => {
  test("is protected when signed out", async ({ page }) => {
    await expectRedirectedToSignIn(page, "/dashboard");
  });

  test("renders KPIs and charts when signed in", async ({ page }) => {
    test.skip(!hasCredentials(), "E2E_EMAIL / E2E_PASSWORD not configured");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await signIn(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: /dashboard/i })).toBeVisible();
    // Charts hydrate as SVG once tenant data resolves.
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 30_000 });
    expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("navigates to conversations and alerts", async ({ page }) => {
    test.skip(!hasCredentials(), "E2E_EMAIL / E2E_PASSWORD not configured");
    await signIn(page);

    await page.getByRole("link", { name: /conversations/i }).first().click();
    await expect(page).toHaveURL(/\/conversations/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByRole("link", { name: /alerts/i }).first().click();
    await expect(page).toHaveURL(/\/alerts/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
