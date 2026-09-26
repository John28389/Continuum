import { expect, test } from "@playwright/test";

import { TEST_USER } from "./global-setup";

/**
 * The auth boundary.
 *
 * This application holds one person's private behavioural record on a publicly
 * reachable URL, so "logged out means nothing is visible" is not a convenience
 * — it is the boundary the rest of the product assumes.
 */

test.describe("authentication", () => {
  test("sends an unauthenticated visitor to the login page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });

  test("protects the root as well as named routes", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("remembers where the visitor was heading", async ({ page }) => {
    await page.goto("/missions");
    await expect(page).toHaveURL(/next=%2Fmissions/);
  });

  test("refuses a wrong password without revealing whether the account exists", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill("not-the-password");
    await page.getByRole("button", { name: "Entrar" }).click();

    const error = page.getByRole("alert");
    await expect(error).toBeVisible();

    // The same message must appear for an address that does not exist at all,
    // otherwise the form becomes a way to enumerate registered accounts.
    const wrongPasswordMessage = await error.textContent();

    await page.goto("/login");
    await page.getByLabel("E-mail").fill("nobody@continuum.test");
    await page.getByLabel("Senha").fill("not-the-password");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("alert")).toHaveText(wrongPasswordMessage ?? "");
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs in, lands on the dashboard, and signs out again", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    // Signing out lives in Settings rather than on the dashboard, which is
    // reserved for what is being worked on right now.
    await page.goto("/settings");
    await expect(page.getByTestId("user-email")).toHaveText(TEST_USER.email);

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);

    // The session must really be gone, not just navigated away from.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("returns a signed-in visitor to where they were heading", async ({ page }) => {
    await page.goto("/missions");
    await expect(page).toHaveURL(/next=%2Fmissions/);

    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();

    // /missions does not exist yet, so a 404 here is the correct outcome: what
    // matters is that the redirect target was honoured rather than discarded.
    await expect(page).toHaveURL(/\/missions/);
  });

  test("keeps a signed-in visitor away from the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("creates the profile row on first sign-in", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(TEST_USER.email);
    await page.getByLabel("Senha").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Reaching any protected page proves it: the layout inserts the profile
    // through an RLS-checked statement, so a policy failure would surface here
    // rather than silently doing nothing.
    await page.goto("/settings");
    await expect(page.getByTestId("user-email")).toHaveText(TEST_USER.email);
  });
});
