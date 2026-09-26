import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * Knowledge notes and links (M14).
 *
 * WRITTEN WITHOUT A DATABASE (no-Docker phase) AND NOT YET RUN. See the
 * verification debt in docs/status.md. Treat a first failure here as the spec
 * meeting the application for the first time, not as a regression.
 *
 * Notes are deleted before missions, here and after every test. Until the
 * 20260914172741 migration, the M5 foreign key from a note to its mission nulled
 * user_id along with mission_id, so deleting a mission that still had notes
 * failed and broke the next spec's reset. The key is fixed now (see
 * 070_knowledge_notes.test.sql); the cleanup stays because a spec should not
 * leave its notes in the fixture user's account either way.
 */
test.describe.configure({ mode: "serial" });

const MISSION = "Fundamentos de web exploitation";
const OWNED = `(select id from auth.users where email = '${TEST_USER.email}')`;

const CLEAN_NOTES = `delete from public.knowledge_notes where user_id = ${OWNED};`;

const RESET = `
${CLEAN_NOTES}
do $$
declare
  v_user uuid;
  v_direction uuid;
  v_campaign uuid;
  v_cycle uuid;
  v_mission uuid;
begin
  select id into v_user from auth.users where email = '${TEST_USER.email}';

  delete from public.rule_events where user_id = v_user;
  delete from public.missions where user_id = v_user;
  delete from public.cycles where user_id = v_user;
  delete from public.campaigns where user_id = v_user;
  delete from public.directions where user_id = v_user;

  insert into public.directions (user_id, title)
  values (v_user, 'Aumentar valor profissional')
  returning id into v_direction;

  insert into public.campaigns (user_id, direction_id, name, objective, starts_on, ends_on)
  values (v_user, v_direction, 'Web exploitation', 'Competencia pratica', current_date, current_date + 90)
  returning id into v_campaign;

  insert into public.cycles (user_id, label, starts_on, ends_on, status)
  values (v_user, 'Setembro', current_date, current_date + 30, 'active')
  returning id into v_cycle;

  insert into public.missions
    (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
  values (v_user, v_cycle, v_campaign, '${MISSION}', 'Fechar a distancia entre ler e encontrar', 60, 120)
  returning id into v_mission;

  insert into public.mission_dod_criteria (user_id, mission_id, description)
  values (v_user, v_mission, 'Reproduzir oito labs sem walkthrough');

  update public.missions set status = 'active' where id = v_mission;
end
$$;
`;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function writeNote(page: Page, title: string, content: string) {
  await page.goto("/knowledge/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Conteúdo").fill(content);
  await page.getByRole("button", { name: "Criar nota" }).click();
  await expect(page).toHaveURL(/\/knowledge\/[0-9a-f-]{36}$/);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");
  runSql(RESET);
  await signIn(page);
});

test.afterEach(async ({}, testInfo) => {
  if (testInfo.project.name === "chromium") runSql(CLEAN_NOTES);
});

test("a note needs only a title and content", async ({ page }) => {
  await page.goto("/knowledge");
  await expect(page.getByText("Nenhuma nota ainda.")).toBeVisible();

  await writeNote(page, "Injeção de SQL", "Parâmetros preparados resolvem a classe inteira.");

  await expect(page.getByTestId("note-content")).toContainText("Parâmetros preparados");
  // The type it did not have to choose is the default.
  // In the page header: the edit form's type select also has a "Conceito" option.
  await expect(page.locator("main header").getByText("Conceito", { exact: true })).toBeVisible();
});

test("search finds notes by title and content, ignoring accents", async ({ page }) => {
  await writeNote(page, "Injeção de SQL", "Parâmetros preparados resolvem a classe inteira.");
  await writeNote(page, "CSP e XSS", "O relatório do lab 4 mostrou onde a política falha.");

  await page.goto("/knowledge?q=relatorio");
  await expect(page.getByTestId("note-list")).toContainText("CSP e XSS");
  await expect(page.getByTestId("note-list")).not.toContainText("Injeção de SQL");

  await page.goto("/knowledge?q=nada+disso");
  await expect(page.getByText("Nenhuma nota encontrada para essa busca.")).toBeVisible();
});

test("a link shows on both notes: as a link on one, a backlink on the other", async ({ page }) => {
  await writeNote(page, "Autenticação", "Cookies, tokens e onde cada um mora.");
  await writeNote(page, "Injeção de SQL", "Parâmetros preparados resolvem.");

  // On "Injeção de SQL", link to "Autenticação".
  await page.getByLabel("Relação").selectOption({ label: "Sustenta" });
  await page.getByLabel("Ligar a").selectOption({ label: "Autenticação" });
  await page.getByRole("button", { name: "Ligar" }).click();
  await expect(page.getByTestId("note-outgoing")).toContainText("Autenticação");

  await page.getByTestId("note-outgoing").getByRole("link", { name: "Autenticação" }).click();
  await expect(page.getByTestId("note-backlinks")).toContainText("Injeção de SQL");
  await expect(page.getByTestId("note-backlinks")).toContainText("Sustenta");
});

test("a note can come from a mission in one action, and carries that origin", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: MISSION }).click();
  await page.getByRole("link", { name: "Criar nota a partir desta missão" }).click();

  await expect(page.getByText(`Origem: ${MISSION}`)).toBeVisible();
  await page.getByLabel("Título").fill("O que o lab 1 ensinou");
  await page.getByLabel("Conteúdo").fill("A validação no cliente não conta.");
  await page.getByRole("button", { name: "Criar nota" }).click();

  await expect(page.getByRole("link", { name: MISSION })).toBeVisible();

  await page.getByRole("link", { name: MISSION }).click();
  await expect(page.getByTestId("mission-notes")).toContainText("O que o lab 1 ensinou");
});
