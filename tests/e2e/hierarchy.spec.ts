import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * Direction, campaign and cycle — the scaffolding above missions.
 *
 * These tests mutate state that is shared per user, and the single-active-cycle
 * rule means two concurrent runs would fight over the one slot. They therefore
 * run serially, and on one project only: running the same mutations twice at
 * once would produce failures that look like bugs and are not.
 */
test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.beforeEach(async ({ page }, testInfo) => {
  // One project is enough: these mutate shared per-user state, and the
  // single-active-cycle rule means two concurrent runs would fight over it.
  test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");

  // Start from a known state. Cascades from the user would also do it, but the
  // fixture user is shared with the other specs.
  // Missions first: they reference cycles and campaigns with ON DELETE
  // RESTRICT, so a mission left behind by the mission spec would make this
  // cleanup fail rather than clean.
  runSql(`
    delete from public.missions where user_id in (select id from auth.users where email = '${TEST_USER.email}');
    delete from public.cycles where user_id in (select id from auth.users where email = '${TEST_USER.email}');
    delete from public.campaigns where user_id in (select id from auth.users where email = '${TEST_USER.email}');
    delete from public.directions where user_id in (select id from auth.users where email = '${TEST_USER.email}');
  `);
  await signIn(page);
});

test("creates a direction, then a campaign beneath it", async ({ page }) => {
  await page.goto("/settings/directions");
  await page.getByLabel("Título").fill("Aumentar valor profissional");
  await page.getByLabel("Descrição").fill("Autonomia técnica e financeira.");
  await page.getByRole("button", { name: "Criar direção" }).click();

  await expect(page.getByText("Aumentar valor profissional")).toBeVisible();

  await page.goto("/settings/campaigns");
  await page.getByLabel("Nome").fill("Web exploitation");
  await page.getByLabel("Objetivo").fill("Competência prática em exploração web");
  await page.getByLabel("Início").fill("2026-09-01");
  await page.getByLabel("Fim").fill("2026-12-01");
  await page.getByRole("button", { name: "Criar campanha" }).click();

  await expect(page.getByText("Web exploitation")).toBeVisible();
});

test("will not offer a campaign form with no direction to attach it to", async ({ page }) => {
  await page.goto("/settings/campaigns");

  await expect(page.getByText("Crie uma direção antes de criar uma campanha.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar campanha" })).toHaveCount(0);
});

test("opens a cycle and shows the days remaining", async ({ page }) => {
  await page.goto("/dashboard");

  await page.getByLabel("Nome do ciclo").fill("Setembro");
  await page.getByLabel("Início").fill("2026-09-01");
  await page.getByLabel("Fim").fill("2026-10-01");
  await page.getByRole("button", { name: "Abrir ciclo" }).click();

  await expect(page.getByText("Setembro")).toBeVisible();
  await expect(page.getByTestId("days-remaining")).toBeVisible();
  await expect(page.getByRole("button", { name: "Encerrar ciclo" })).toBeVisible();
});

/**
 * The interface hides the open-cycle form once a cycle is running, so the
 * refusal is provoked the way it would really happen: the page was rendered
 * when no cycle existed, and by the time the form is submitted one does.
 *
 * This is the assertion that matters most here. The database refusal is already
 * proven in the SQL suite; what is proven now is that a person sees an
 * explanation about cycles rather than a Postgres error.
 *
 * An earlier version drove this from two tabs. It was rejected: the first tab's
 * revalidation perturbs the second tab's router cache, and the resulting
 * flakiness was a property of the test, not of the application.
 */
test("refuses a second active cycle, and explains why in plain language", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByLabel("Nome do ciclo")).toBeVisible();

  // A cycle appears underneath the loaded page.
  runSql(`
    insert into public.cycles (user_id, label, starts_on, ends_on, status)
    select id, 'Setembro', current_date, current_date + 30, 'active'
    from auth.users where email = '${TEST_USER.email}';
  `);

  await page.getByLabel("Nome do ciclo").fill("Outubro");
  await page.getByRole("button", { name: "Abrir ciclo" }).click();

  const alert = page.getByRole("alert").filter({ hasText: "ciclo" });
  await expect(alert).toContainText("Já existe um ciclo aberto");

  const text = (await alert.textContent()) ?? "";
  for (const leak of ["constraint", "duplicate key", "23505", "relation"]) {
    expect(text.toLowerCase(), `refusal leaked SQL: ${text}`).not.toContain(leak);
  }

  // The rule held: still exactly one active cycle.
  await page.reload();
  await expect(page.getByText("Setembro")).toBeVisible();
});

test("closing a cycle frees the slot for the next one", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByLabel("Nome do ciclo").fill("Setembro");
  await page.getByLabel("Início").fill("2026-09-01");
  await page.getByLabel("Fim").fill("2026-10-01");
  await page.getByRole("button", { name: "Abrir ciclo" }).click();
  await expect(page.getByRole("button", { name: "Encerrar ciclo" })).toBeVisible();

  await page.getByRole("button", { name: "Encerrar ciclo" }).click();

  // The rule is one cycle at a time, not one cycle ever.
  await expect(page.getByRole("button", { name: "Abrir ciclo" })).toBeVisible();

  await page.getByLabel("Nome do ciclo").fill("Outubro");
  await page.getByLabel("Início").fill("2026-10-02");
  await page.getByLabel("Fim").fill("2026-11-01");
  await page.getByRole("button", { name: "Abrir ciclo" }).click();

  await expect(page.getByText("Outubro")).toBeVisible();
});
