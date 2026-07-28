import { test, expect } from "@playwright/test";
import { signIn, hasCredentials } from "./helpers";

test.describe("sign-in page", () => {
  test("renders the credential form and branding", async ({ page }) => {
    await page.goto("/signin");

    await expect(page.getByRole("heading", { name: "Company sign in" })).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in to console" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  });

  test("validates a malformed email before hitting the backend", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Work email").fill("not-an-email");
    await page.getByLabel("Password").fill("supersecret1");
    await page.getByRole("button", { name: "Sign in to console" }).click();

    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole("heading", { name: "Company sign in" })).toBeVisible();
  });

  test("switches to the workspace request tab", async ({ page }) => {
    await page.goto("/signin");
    const tab = page.getByRole("tab", { name: "Request workspace" });

    // Retry the click until React has hydrated the tab control.
    await expect(async () => {
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
    }).toPass({ timeout: 30_000 });

    await expect(page.getByLabel("Full name")).toBeVisible();
  });

  test("password recovery route renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  test("signs in with demo credentials", async ({ page }) => {
    test.skip(!hasCredentials(), "E2E_EMAIL / E2E_PASSWORD not configured");
    await signIn(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
