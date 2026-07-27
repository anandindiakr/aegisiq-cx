import { test, expect } from "@playwright/test";
import { signIn, hasCredentials, expectRedirectedToSignIn } from "./helpers";

const PROTECTED = ["/settings", "/users", "/outlets", "/cameras", "/audit-logs", "/profile"];

test.describe("settings & management routes", () => {
  for (const path of PROTECTED) {
    test(`${path} is protected when signed out`, async ({ page }) => {
      await expectRedirectedToSignIn(page, path);
    });
  }

  test("settings tabs render for an admin", async ({ page }) => {
    test.skip(!hasCredentials(), "E2E_EMAIL / E2E_PASSWORD not configured");
    await signIn(page);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("tab").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /save/i }).first()).toBeVisible();
  });

  test("outlets and cameras load tenant records", async ({ page }) => {
    test.skip(!hasCredentials(), "E2E_EMAIL / E2E_PASSWORD not configured");
    await signIn(page);

    await page.goto("/outlets");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/cameras");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
