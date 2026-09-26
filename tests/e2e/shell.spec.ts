import { expect, test, type Page } from "@playwright/test";

import { TEST_USER } from "./global-setup";

/**
 * The application shell.
 *
 * Seven areas, reachable and distinguishable, on a phone as well as a desktop.
 * Parking a curiosity has to be comfortable on a small screen, so the small
 * viewport is a first-class target rather than a degraded fallback.
 */

const AREAS = [
  { name: "Painel", path: "/dashboard" },
  { name: "Missões", path: "/missions" },
  { name: "Curiosidades", path: "/curiosities" },
  { name: "Conhecimento", path: "/knowledge" },
  { name: "Histórico", path: "/history" },
  { name: "Regras", path: "/rules" },
  { name: "Ajustes", path: "/settings" },
] as const;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("application shell", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("every area is reachable and renders its own heading", async ({ page }) => {
    for (const area of AREAS) {
      await page.goto(area.path);
      await expect(page.getByRole("heading", { level: 1, name: area.name })).toBeVisible();
    }
  });

  test("offers exactly seven areas, and no eighth", async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
    }

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link")).toHaveCount(AREAS.length);
  });

  test("marks the current area for assistive technology", async ({ page, isMobile }) => {
    await page.goto("/curiosities");

    if (isMobile) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
    }

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Curiosidades" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("navigates between areas by clicking", async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
    }

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await nav.getByRole("link", { name: "Regras" }).click();

    await expect(page).toHaveURL(/\/rules/);
    await expect(page.getByRole("heading", { level: 1, name: "Regras" })).toBeVisible();
  });

  test("does not scroll sideways on a small screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    for (const area of AREAS) {
      await page.goto(area.path);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflows, `${area.path} overflows horizontally at 375px`).toBe(false);
    }
  });

  test("reaches the navigation by keyboard, with a visible skip link", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");

    const skip = page.getByRole("link", { name: "Ir para o conteúdo" });
    await expect(skip).toBeFocused();
  });
});

test.describe("small-screen drawer", () => {
  test.skip(({ isMobile }) => !isMobile, "drawer only exists on small screens");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("opens, navigates, and closes itself afterwards", async ({ page }) => {
    await page.getByRole("button", { name: "Abrir menu" }).click();

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await nav.getByRole("link", { name: "Conhecimento" }).click();

    await expect(page).toHaveURL(/\/knowledge/);
    // Leaving the drawer open would cover the page it just opened.
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeHidden();
  });

  test("closes on Escape", async ({ page }) => {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeHidden();
  });
});
