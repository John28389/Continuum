import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * The mission lifecycle, and RULE-001 as the user meets it.
 *
 * The assertion that matters most in this file is not that a button was
 * disabled — it is that the *database* refused a second active mission, and
 * that the person on the other side got an explanation rather than a Postgres
 * error. The interface deliberately offers the activate button whatever else is
 * running, so every attempt here reaches the server for real.
 */
test.describe.configure({ mode: "serial" });

const OWNED = `(select id from auth.users where email = '${TEST_USER.email}')`;

/** Direction, campaign and an open cycle: the scaffolding a mission needs. */
const RESET = `
do $$
declare
  v_user uuid;
  v_direction uuid;
  v_campaign uuid;
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
  values (v_user, 'Setembro', current_date, current_date + 30, 'active');
end
$$;
`;

/**
 * Asserts in SQL and raises there, so a wrong answer fails the run.
 *
 * Checking the database directly is the point: an assertion made against the
 * rendered page could pass while the rule had actually been broken underneath.
 */
function assertInDatabase(condition: string, message: string): void {
  runSql(`
    do $$
    begin
      if not (${condition}) then
        raise exception '${message}';
      end if;
    end
    $$;
  `);
}

function expectSingleActiveMission(title: string): void {
  assertInDatabase(
    `(select count(*) from public.missions where user_id = ${OWNED} and status = 'active') = 1`,
    "RULE-001 broken: the number of active missions is not exactly one",
  );
  assertInDatabase(
    `(select title from public.missions where user_id = ${OWNED} and status = 'active') = '${title}'`,
    "the active mission is not the one that was activated first",
  );
}

function expectRecordedBlock(ruleCode: string): void {
  assertInDatabase(
    `exists (
       select 1 from public.rule_events
       where user_id = ${OWNED} and rule_code = '${ruleCode}' and outcome = 'blocked'
     )`,
    `no rule_events row was written for ${ruleCode}`,
  );
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function createMission(
  page: Page,
  { title, reason, criterion }: { title: string; reason: string; criterion: string },
) {
  await page.goto("/missions/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Por que esta missão").fill(reason);
  await page.getByLabel("Carga mínima (horas)").fill("24");
  await page.getByLabel("Carga-alvo (horas)").fill("30");
  await page.getByLabel("Critério 1", { exact: true }).fill(criterion);
  await page.getByRole("button", { name: "Criar missão" }).click();

  // Creation lands on the mission it created.
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");
  runSql(RESET);
  await signIn(page);
});

test("a mission is created as a draft and activated as a separate act", async ({ page }) => {
  await createMission(page, {
    title: "Fundamentos de web exploitation",
    reason: "Fechar a distância entre ler sobre vulnerabilidades e encontrá-las",
    criterion: "Reproduzir oito labs sem seguir walkthrough",
  });

  // Nothing is active yet: creating is not committing.
  await expect(page.getByText("Rascunho")).toBeVisible();
  assertInDatabase(
    `(select count(*) from public.missions where user_id = ${OWNED} and status = 'active') = 0`,
    "creating a mission should not activate it",
  );

  await page.getByRole("button", { name: "Ativar missão" }).click();

  await expect(page.getByText("Missão", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ativar missão" })).toHaveCount(0);
  expectSingleActiveMission("Fundamentos de web exploitation");
});

test("the dashboard shows the active mission as the current one", async ({ page }) => {
  await createMission(page, {
    title: "Fundamentos de web exploitation",
    reason: "Fechar a distância entre ler sobre vulnerabilidades e encontrá-las",
    criterion: "Reproduzir oito labs sem seguir walkthrough",
  });
  await page.getByRole("button", { name: "Ativar missão" }).click();
  await expect(page.getByText("Missão", { exact: true })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("Fundamentos de web exploitation")).toBeVisible();
});

/**
 * The milestone's central test.
 *
 * Planning a second mission is allowed — that is what a draft is for. Running
 * two is not, and the refusal has to arrive as an explanation with a way
 * forward, not as a dead end.
 */
test("refuses a second active mission, explains RULE-001, and keeps the first", async ({
  page,
}) => {
  await createMission(page, {
    title: "Fundamentos de web exploitation",
    reason: "Fechar a distância entre ler sobre vulnerabilidades e encontrá-las",
    criterion: "Reproduzir oito labs sem seguir walkthrough",
  });
  await page.getByRole("button", { name: "Ativar missão" }).click();
  await expect(page.getByText("Missão", { exact: true })).toBeVisible();

  // A second mission may be planned. It simply may not be started.
  await createMission(page, {
    title: "A coisa nova e brilhante",
    reason: "Pareceu mais interessante esta manhã, o que é exatamente o padrão a evitar",
    criterion: "Publicar um writeup do primeiro desafio",
  });

  await page.getByRole("button", { name: "Ativar missão" }).click();

  const block = page.getByTestId("rule-violation");
  await expect(block).toBeVisible();

  // Names the rule, explains why it exists, and offers the parking lot.
  await expect(block).toContainText("RULE-001");
  await expect(block).toContainText("Já existe uma missão principal ativa");
  await expect(block).toContainText("Por que esta regra existe");
  await expect(
    block.getByRole("link", { name: "Estacionar a ideia nas curiosidades" }),
  ).toBeVisible();

  // Not a stack trace and not a telling-off.
  const text = (await block.textContent()) ?? "";
  for (const leak of ["constraint", "duplicate key", "23505", "relation", "postgres", "ct001"]) {
    expect(text.toLowerCase(), `refusal leaked SQL: ${text}`).not.toContain(leak);
  }
  for (const scolding of ["você errou", "proibido", "não pode fazer isso"]) {
    expect(text.toLowerCase()).not.toContain(scolding);
  }

  // The rule held where it counts.
  expectSingleActiveMission("Fundamentos de web exploitation");
  expectRecordedBlock("RULE-001");

  await page.goto("/dashboard");
  await expect(page.getByText("Fundamentos de web exploitation")).toBeVisible();
  await expect(page.getByText("A coisa nova e brilhante")).toHaveCount(0);
});

test("refuses a mission with no Definition of Done, in the words of RULE-002", async ({ page }) => {
  await page.goto("/missions/new");
  await page.getByLabel("Título").fill("Estudar web exploitation");
  await page.getByLabel("Por que esta missão").fill("Porque parece importante");
  await page.getByLabel("Carga mínima (horas)").fill("24");
  await page.getByLabel("Carga-alvo (horas)").fill("30");
  await page.getByRole("button", { name: "Criar missão" }).click();

  const block = page.getByTestId("rule-violation");
  await expect(block).toContainText("RULE-002");
  await expect(block).toContainText("critério de conclusão");

  expectRecordedBlock("RULE-002");
  assertInDatabase(
    `(select count(*) from public.missions where user_id = ${OWNED}) = 0`,
    "a mission without a Definition of Done should not have been created",
  );
});

/**
 * RULE-101 is ADVISORY and must stay that way.
 *
 * The advisory appears, and the mission is created anyway. Judging whether
 * prose is measurable is the user's call, and a system that quietly turned this
 * into a gate would have changed what kind of system it is.
 */
test("flags an unverifiable criterion without blocking it", async ({ page }) => {
  await page.goto("/missions/new");
  await page.getByLabel("Título").fill("Estudar web exploitation");
  await page.getByLabel("Por que esta missão").fill("Quero entender melhor o assunto");
  await page.getByLabel("Carga mínima (horas)").fill("24");
  await page.getByLabel("Carga-alvo (horas)").fill("30");
  await page.getByLabel("Critério 1", { exact: true }).fill("Aprender bastante sobre o tema");

  const advisory = page.getByTestId("rule-advisory");
  await expect(advisory).toContainText("RULE-101");
  await expect(advisory).toContainText("critério de conclusão verificável");

  await page.getByRole("button", { name: "Criar missão" }).click();

  // It advised. It did not refuse.
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("rule-violation")).toHaveCount(0);
  await expect(page.getByTestId("rule-advisory")).toBeVisible();
});
