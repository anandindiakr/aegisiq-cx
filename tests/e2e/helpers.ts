import { expect, type Page } from "@playwright/test";

export function hasCredentials() {
  return Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
}

/** Signs into the console with the demo tenant credentials. */
export async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Work email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to console" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Asserts an unauthenticated visit to a protected path is bounced to sign-in. */
export async function expectRedirectedToSignIn(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Company sign in" })).toBeVisible({
    timeout: 20_000,
  });
}
