import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * The whole product, once, through the interface only.
 *
 * From an empty account: a direction and a campaign, a cycle opened on the
 * dashboard, a mission drafted and activated, a session from the dashboard, a
 * discovery through the dashboard shortcut, a curiosity parked with the C key,
 * evidence, the Definition of Done, completion — and then the record: the
 * trail, the timeline, the integrity counts, and a dashboard that says the
 * mission is finished and suggests nothing more.
 *
 * Every other spec starts from a fixture written in SQL. This one proves the
 * parts connect when a person drives them in order.
 */
test.describe.configure({ mode: "serial" });

const DIRECTION = "Aumentar valor profissional";
const CAMPAIGN = "Web exploitation";
const MISSION = "Fundamentos de web exploitation";
const CRITERION = "Reproduzir oito labs sem walkthrough";
const DISCOVERY = "Parâmetros refletidos sem escape no lab 2";
const CURIOSITY = "Fuzzing de protocolos binários";
const EVIDENCE = "Writeup dos oito labs publicado";

/** An account with nothing in it. The record is reset too: this spec reads it back. */
const RESET = `
do $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where email = '${TEST_USER.email}';

  delete from public.rule_events where user_id = v_user;
  delete from public.knowledge_notes where user_id = v_user;
  delete from public.curiosities where user_id = v_user;
  delete from public.missions where user_id = v_user;
  delete from public.cycles where user_id = v_user;
  delete from public.campaigns where user_id = v_user;
  delete from public.directions where user_id = v_user;
  delete from public.audit_events where user_id = v_user;
end
$$;
`;

/** A calendar day relative to today, as a date input takes it, in this machine's timezone. */
function day(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toLocaleDateString("sv-SE");
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");
  runSql(RESET);
  await signIn(page);
});

test("from an empty account to a finished mission in the record", async ({ page }) => {
  test.setTimeout(90_000);

  // Direction, then a campaign beneath it.
  await page.goto("/settings/directions");
  await page.getByLabel("Título").fill(DIRECTION);
  await page.getByLabel("Descrição").fill("Autonomia técnica e financeira.");
  await page.getByRole("button", { name: "Criar direção" }).click();
  await expect(page.getByText(DIRECTION)).toBeVisible();

  await page.goto("/settings/campaigns");
  await page.getByLabel("Nome").fill(CAMPAIGN);
  await page.getByLabel("Objetivo").fill("Competência prática em exploração web");
  await page.getByLabel("Início").fill(day(-1));
  await page.getByLabel("Fim").fill(day(89));
  await page.getByRole("button", { name: "Criar campanha" }).click();
  await expect(page.getByText(CAMPAIGN)).toBeVisible();

  // A cycle, opened on the dashboard.
  await page.goto("/dashboard");
  await page.getByLabel("Nome do ciclo").fill("Setembro");
  await page.getByLabel("Início").fill(day(-1));
  await page.getByLabel("Fim").fill(day(29));
  await page.getByRole("button", { name: "Abrir ciclo" }).click();
  await expect(page.getByTestId("days-remaining")).toBeVisible();

  // A mission: drafted, then activated as a separate, deliberate step.
  await page.goto("/missions/new");
  await page.getByLabel("Título").fill(MISSION);
  await page.getByLabel("Por que esta missão").fill("Fechar a distância entre ler e encontrar");
  await page.getByLabel("Carga mínima (horas)").fill("10");
  await page.getByLabel("Carga-alvo (horas)").fill("20");
  await page.getByLabel("Critério 1", { exact: true }).fill(CRITERION);
  await page.getByRole("button", { name: "Criar missão" }).click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);
  const missionUrl = page.url();
  await page.getByRole("button", { name: "Ativar missão" }).click();
  await expect(page.getByText("Missão", { exact: true })).toBeVisible();

  // A session, one action from the dashboard.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Iniciar sessão" }).click();
  await expect(page.getByTestId("running-session")).toBeVisible();
  await page.getByRole("button", { name: "Encerrar sessão" }).click();
  await expect(page.getByRole("button", { name: "Iniciar sessão" })).toBeVisible();

  // A discovery, through the shortcut, already typed as one and tied to the mission.
  await page.getByRole("link", { name: "Registrar uma descoberta" }).click();
  await expect(page.getByLabel("Tipo")).toHaveValue("discovery");
  await expect(page.getByRole("link", { name: MISSION })).toBeVisible();
  await page.getByLabel("Título").fill(DISCOVERY);
  await page.getByLabel("Conteúdo").fill("O parâmetro de busca volta no HTML sem codificação.");
  await page.getByRole("button", { name: "Criar nota" }).click();
  await expect(page.getByText(DISCOVERY).first()).toBeVisible();

  // A curiosity parked in passing, from the dashboard, with the key.
  await page.goto("/dashboard");
  await expect(page.locator("[data-capture-ready]")).toBeAttached();
  await page.keyboard.press("c");
  await page.getByLabel("Título").fill(CURIOSITY);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nova curiosidade" })).toHaveCount(0);

  // Evidence, the Definition of Done, and completion.
  await page.goto(missionUrl);
  await page.getByRole("link", { name: "Evidências", exact: true }).click();
  await page.getByLabel("O que foi produzido").fill(EVIDENCE);
  await page.getByLabel("Critério atendido (opcional)").selectOption({ label: CRITERION });
  await page.getByRole("button", { name: "Registrar evidência" }).click();
  await expect(page.getByTestId("evidence-list")).toContainText(EVIDENCE);

  await page.goto(missionUrl);
  await page
    .getByTestId("criterion")
    .filter({ hasText: CRITERION })
    .getByRole("button", { name: /Marcar como satisfeito/ })
    .click();
  await page.getByRole("button", { name: "Concluir missão" }).click();
  await expect(page.getByTestId("mission-completed")).toContainText("MISSÃO CONCLUÍDA");

  // The trail: what the mission left behind, step by step.
  const trail = page.getByTestId("evidence-trail");
  expect(
    await trail.locator("li").evaluateAll((items) => items.map((item) => item.dataset.step)),
  ).toEqual([
    "created",
    "first_session",
    "first_discovery",
    "first_evidence",
    "definition_of_done",
    "completed",
  ]);
  await expect(trail).toContainText(DISCOVERY);
  await expect(trail).toContainText(EVIDENCE);

  // The record.
  await page.goto("/history?type=mission");
  const timeline = page.getByTestId("timeline");
  await expect(timeline).toContainText("Missão criada");
  await expect(timeline).toContainText("Missão ativada");
  await expect(timeline).toContainText("Missão concluída");

  await page.goto("/history/integrity");
  await expect(page.locator('[data-testid="integrity-count"][data-key="completed"] dd')).toHaveText(
    "1",
  );

  // And the dashboard afterwards: finished, free, nothing suggested.
  await page.goto("/dashboard");
  await expect(page.getByTestId("mission-completed")).toBeVisible();
  await expect(page.getByRole("link", { name: "Registrar uma descoberta" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Iniciar sessão" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver as regras" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^1 curiosidades guardadas$/ })).toBeVisible();
});
