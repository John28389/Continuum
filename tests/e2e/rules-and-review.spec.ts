import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * The Rules page, and leaving a mission (RULE-004).
 *
 * WRITTEN WITHOUT A DATABASE (M13, no-Docker phase) AND NOT YET RUN. See the
 * verification debt in docs/status.md. Treat a first failure here as the spec
 * meeting the application for the first time, not as a regression.
 */
test.describe.configure({ mode: "serial" });

const MISSION = "Fundamentos de web exploitation";
const OWNED = `(select id from auth.users where email = '${TEST_USER.email}')`;
const JUSTIFICATION = "O laboratório que a missão pressupunha foi desativado pela plataforma.";

/** An active mission with one criterion. */
const RESET = `
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

function assertInDatabase(condition: string, message: string): void {
  const quoted = message.replaceAll("'", "''");
  runSql(`
    do $$
    begin
      if not (${condition}) then
        raise exception '${quoted}';
      end if;
    end
    $$;
  `);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openReview(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: MISSION }).click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);
  await page.getByText("Revisar esta missão").click();
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");
  runSql(RESET);
  await signIn(page);
});

test("the rules page shows what the database enforces, and how", async ({ page }) => {
  await page.goto("/rules");

  for (const code of [
    "RULE-001",
    "RULE-002",
    "RULE-003",
    "RULE-004",
    "RULE-005",
    "RULE-006",
    "RULE-007",
    "RULE-008",
  ]) {
    const card = page.locator(`[data-rule="${code}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByTestId("enforcement-badge")).toHaveAttribute("data-enforcement", "HARD");
  }

  const advisory = page.locator('[data-rule="RULE-101"]');
  await expect(advisory.getByTestId("enforcement-badge")).toHaveAttribute(
    "data-enforcement",
    "ADVISORY",
  );

  // Name, description, rationale, severity, exceptions.
  const first = page.locator('[data-rule="RULE-001"]');
  await expect(first).toContainText("Uma missão principal por vez");
  await expect(first).toContainText("Por que esta regra existe");
  await expect(first).toContainText("Exceções");
  await expect(first.getByTestId("severity-badge")).toContainText("Crítica");
});

test("a rule's recent blocks appear under it", async ({ page }) => {
  runSql(`
    insert into public.rule_events (user_id, rule_code, outcome)
    select id, 'RULE-001', 'blocked' from auth.users where email = '${TEST_USER.email}';
  `);

  await page.goto("/rules");
  await expect(page.locator('[data-rule="RULE-001"]').getByTestId("rule-events")).toContainText(
    "Bloqueou",
  );
  await expect(page.locator('[data-rule="RULE-002"]')).toContainText(
    "Nenhuma ocorrência registrada.",
  );
});

test("the review asks the question as reflection, and offers the parking lot", async ({ page }) => {
  await openReview(page);

  const prompt = page.getByTestId("reflection-prompt");
  await expect(prompt).toContainText("Você está mudando a regra ou tentando escapar dela?");
  await expect(
    prompt.getByRole("link", { name: "Estacionar a ideia nas curiosidades" }),
  ).toBeVisible();
});

test("keeping the mission records the review and changes nothing else", async ({ page }) => {
  await openReview(page);

  await page.getByLabel("Manter a missão").check();
  await page.getByLabel("Categoria do motivo").selectOption({ label: "A premissa mudou" });
  await page.getByLabel("Justificativa").fill(JUSTIFICATION);
  await page.getByRole("button", { name: "Registrar revisão" }).click();

  await expect(page.getByRole("status")).toContainText("Revisão registrada. A missão continua.");

  assertInDatabase(
    `(select status = 'active' from public.missions where user_id = ${OWNED} and title = '${MISSION}')
     and (select count(*) = 1 from public.mission_reviews where user_id = ${OWNED} and outcome = 'kept')`,
    "keeping should record one review and leave the mission active",
  );
});

test("ending the mission needs a real justification, then records it with the exit", async ({
  page,
}) => {
  await openReview(page);

  await page.getByLabel("Encerrar").check();
  await page.getByLabel("Categoria do motivo").selectOption({ label: "A premissa mudou" });
  await page.getByLabel("Justificativa").fill("curto demais");
  await page.getByRole("button", { name: "Registrar revisão" }).click();

  // Filtered: Next's route announcer also has role="alert".
  await expect(page.getByRole("alert").filter({ hasText: "20 caracteres" })).toContainText(
    "pelo menos 20 caracteres",
  );
  assertInDatabase(
    `(select count(*) = 0 from public.mission_reviews where user_id = ${OWNED})`,
    "a too-short justification should record nothing",
  );

  await page.getByLabel("Justificativa").fill(JUSTIFICATION);
  await page.getByRole("button", { name: "Registrar revisão" }).click();

  // The page is now a finished mission: no review form, no completion panel.
  await expect(page.getByText("Encerrada", { exact: true })).toBeVisible();
  await expect(page.getByTestId("reflection-prompt")).toHaveCount(0);

  assertInDatabase(
    `(select status = 'abandoned' from public.missions where user_id = ${OWNED} and title = '${MISSION}')
     and (select count(*) = 1 from public.mission_reviews
           where user_id = ${OWNED} and outcome = 'abandoned' and reason_category = 'premise_changed')`,
    "ending should record the review and the exit together",
  );
});
