import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * Evidence, the Definition of Done, and completion.
 *
 * Three things are proven here that the SQL suite cannot reach: that the
 * reason completion is unavailable is always on screen, that a refusal made
 * behind the page's back still reaches the person as RULE-008's explanation,
 * and that once a mission is complete the interface says so and stops.
 */
test.describe.configure({ mode: "serial" });

const MISSION = "Fundamentos de web exploitation";
const FIRST = "Reproduzir oito labs sem walkthrough";
const SECOND = "Publicar um writeup de cada classe";
const OWNED = `(select id from auth.users where email = '${TEST_USER.email}')`;

const SATISFY_ALL = `update public.mission_dod_criteria set satisfied_at = now() where user_id = ${OWNED};`;

/** Direction, campaign and an open cycle; optionally an active mission with two criteria. */
function reset(withActiveMission: boolean): string {
  const mission = withActiveMission
    ? `
  insert into public.missions
    (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
  values (v_user, v_cycle, v_campaign, '${MISSION}', 'Fechar a distancia entre ler e encontrar', 60, 120)
  returning id into v_mission;

  insert into public.mission_dod_criteria (user_id, mission_id, description, position) values
    (v_user, v_mission, '${FIRST}', 0),
    (v_user, v_mission, '${SECOND}', 1);

  update public.missions set status = 'active' where id = v_mission;`
    : "";

  return `
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
  ${mission}
end
$$;
`;
}

/**
 * Asserts in SQL and raises there, so a wrong answer fails the run. The message
 * is quoted for SQL, so an apostrophe cannot turn a failed assertion into a
 * syntax error.
 */
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

/**
 * Runs a write the database is expected to refuse, and returns what it said.
 *
 * psql prints the error and its DETAIL line, where raise_rule_violation puts
 * the rule code, so the caller can assert which rule answered.
 */
function refusedByDatabase(script: string): string {
  try {
    runSql(script);
  } catch (error) {
    return String((error as Error).message);
  }
  throw new Error(`expected the database to refuse, but it accepted: ${script}`);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openMission(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: MISSION }).click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);
}

function criterion(page: Page, text: string) {
  return page.getByTestId("criterion").filter({ hasText: text });
}

test.describe("the whole loop", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");
    runSql(reset(false));
    await signIn(page);
  });

  test("create, activate, session, evidence, satisfy, complete — and the record stays closed", async ({
    page,
  }) => {
    // Create and activate.
    await page.goto("/missions/new");
    await page.getByLabel("Título").fill(MISSION);
    await page
      .getByLabel("Por que esta missão")
      .fill("Fechar a distância entre ler sobre vulnerabilidades e encontrá-las");
    await page.getByLabel("Carga mínima (horas)").fill("24");
    await page.getByLabel("Carga-alvo (horas)").fill("30");
    await page.getByLabel("Critério 1", { exact: true }).fill(FIRST);
    await page.getByRole("button", { name: "Criar missão" }).click();
    await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);
    const missionUrl = page.url();

    await page.getByRole("button", { name: "Ativar missão" }).click();
    await expect(page.getByText("Missão", { exact: true })).toBeVisible();

    // A session: time, as an input.
    await page.getByRole("link", { name: "Sessões", exact: true }).click();
    await page.getByRole("button", { name: "Iniciar sessão" }).click();
    await expect(page.getByTestId("running-session")).toBeVisible();
    await page.getByRole("button", { name: "Encerrar sessão" }).click();
    await expect(page.getByRole("button", { name: "Iniciar sessão" })).toBeVisible();

    // Evidence: output, citing the criterion it speaks to.
    await page.goto(missionUrl);
    await page.getByRole("link", { name: "Evidências", exact: true }).click();
    await page.getByLabel("O que foi produzido").fill("Writeup do lab 1 publicado");
    await page.getByLabel("Link (opcional)").fill("https://example.com/writeup-1");
    await page.getByLabel("Critério atendido (opcional)").selectOption({ label: FIRST });
    await page.getByRole("button", { name: "Registrar evidência" }).click();
    await expect(page.getByTestId("evidence-list")).toContainText("Writeup do lab 1 publicado");

    // Completion is not on offer yet, and the page says why.
    await page.goto(missionUrl);
    const completion = page.getByTestId("completion");
    await expect(completion).toContainText("Ainda em aberto");
    await expect(completion).toContainText(FIRST);
    await expect(page.getByRole("button", { name: "Concluir missão" })).toHaveCount(0);
    await expect(criterion(page, FIRST)).toContainText("Evidência: Writeup do lab 1 publicado");

    // Satisfy, then complete.
    await criterion(page, FIRST)
      .getByRole("button", { name: /Marcar como satisfeito/ })
      .click();
    await expect(page.getByRole("button", { name: "Concluir missão" })).toBeVisible();
    await page.getByRole("button", { name: "Concluir missão" }).click();

    const done = page.getByTestId("mission-completed");
    await expect(done).toContainText("MISSÃO CONCLUÍDA");
    await expect(done).toContainText("não há mais nada a fazer aqui");

    // And it stops: nothing to do, nothing remaining, nothing suggested.
    for (const action of [
      "Concluir missão",
      "Desmarcar",
      "Marcar como satisfeito",
      "Iniciar sessão",
      "Ativar missão",
      "Registrar evidência",
    ]) {
      await expect(page.getByRole("button", { name: action })).toHaveCount(0);
    }
    const text = (await page.locator("main").textContent()) ?? "";
    expect(text, "a finished mission should show no distance still to go").not.toContain("faltam");
    expect(text, "a finished mission should show no percentage").not.toMatch(/\d+\s?%/);

    // Hours did not decide it: seconds were logged against a 24-hour minimum.
    assertInDatabase(
      `(select status = 'completed' and completed_at is not null
          from public.missions where user_id = ${OWNED} and title = '${MISSION}')
       and (select coalesce(sum(extract(epoch from ended_at - started_at)), 0) < 3600
          from public.mission_sessions where user_id = ${OWNED})`,
      "the mission should be complete with well under an hour logged",
    );

    // Reopening, and rewriting the record, are refused by the database itself.
    expect(
      refusedByDatabase(
        `update public.missions set status = 'active' where user_id = ${OWNED} and title = '${MISSION}';`,
      ),
    ).toMatch(/RULE-006/);
    expect(
      refusedByDatabase(
        `update public.mission_dod_criteria set satisfied_at = null where user_id = ${OWNED};`,
      ),
    ).toMatch(/RULE-006/);
    expect(
      refusedByDatabase(`delete from public.mission_evidence where user_id = ${OWNED};`),
    ).toMatch(/RULE-006/);
  });
});

test.describe("with an active mission", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");
    runSql(reset(true));
    await signIn(page);
  });

  test("completion is offered only when every criterion is satisfied, and the reason is always visible", async ({
    page,
  }) => {
    await openMission(page);

    const completion = page.getByTestId("completion");
    await expect(completion).toContainText("Ainda em aberto");
    await expect(completion).toContainText(FIRST);
    await expect(completion).toContainText(SECOND);
    await expect(page.getByRole("button", { name: "Concluir missão" })).toHaveCount(0);

    await criterion(page, FIRST)
      .getByRole("button", { name: /Marcar como satisfeito/ })
      .click();
    await expect(criterion(page, FIRST)).toContainText("Satisfeito");
    await expect(completion).not.toContainText(FIRST);
    await expect(completion).toContainText(SECOND);
    await expect(page.getByRole("button", { name: "Concluir missão" })).toHaveCount(0);

    await criterion(page, SECOND)
      .getByRole("button", { name: /Marcar como satisfeito/ })
      .click();
    await expect(completion).toContainText("Todos os critérios estão satisfeitos");
    await expect(page.getByRole("button", { name: "Concluir missão" })).toBeVisible();

    // Flexible while live: a criterion can be opened again, and completion withdraws.
    await criterion(page, SECOND)
      .getByRole("button", { name: /Desmarcar/ })
      .click();
    await expect(page.getByRole("button", { name: "Concluir missão" })).toHaveCount(0);
    await expect(completion).toContainText(SECOND);
  });

  /**
   * The interface only offers completion when its mirror of RULE-008 says yes,
   * so the refusal is provoked the way it would really happen: the page is
   * drawn with everything satisfied, and a criterion reopens underneath it.
   */
  test("the server refuses completion when a criterion reopens underneath the page", async ({
    page,
  }) => {
    runSql(SATISFY_ALL);
    await openMission(page);
    await expect(page.getByRole("button", { name: "Concluir missão" })).toBeVisible();

    runSql(`
      update public.mission_dod_criteria set satisfied_at = null
      where user_id = ${OWNED} and description = '${SECOND}';
    `);

    await page.getByRole("button", { name: "Concluir missão" }).click();

    const block = page.getByTestId("rule-violation");
    await expect(block).toContainText("RULE-008");
    await expect(block).toContainText("critérios de conclusão em aberto");
    await expect(block).toContainText("Por que esta regra existe");

    const blockText = ((await block.textContent()) ?? "").toLowerCase();
    for (const leak of ["ct001", "missions_enforce", "postgres", "raise", "criterios"]) {
      expect(blockText, `refusal leaked SQL: ${blockText}`).not.toContain(leak);
    }

    // The page redraws around the refusal and names what is open now.
    await expect(page.getByTestId("completion")).toContainText(SECOND);

    assertInDatabase(
      `(select status = 'active' from public.missions where user_id = ${OWNED} and title = '${MISSION}')`,
      "the mission should still be active",
    );
    assertInDatabase(
      `exists (select 1 from public.rule_events
                where user_id = ${OWNED} and rule_code = 'RULE-008' and outcome = 'blocked')`,
      "no rule_events row was written for RULE-008",
    );
  });

  /** The failure mode the roadmap names: hours gating completion. */
  test("hours never gate completion: past the target with a criterion open, nothing is offered", async ({
    page,
  }) => {
    runSql(`
      insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
      select user_id, id, now() - interval '5 hours', now() - interval '2 hours', 'manual'
      from public.missions where user_id = ${OWNED} and status = 'active';

      update public.mission_dod_criteria set satisfied_at = now()
      where user_id = ${OWNED} and description = '${FIRST}';
    `);

    await openMission(page);

    await expect(page.getByTestId("rule-102")).toBeVisible();
    await expect(page.getByTestId("completion")).toContainText(SECOND);
    await expect(page.getByRole("button", { name: "Concluir missão" })).toHaveCount(0);
  });

  test("a running session ends when the mission is completed", async ({ page }) => {
    runSql(SATISFY_ALL);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Iniciar sessão" }).click();
    await expect(page.getByTestId("running-session")).toBeVisible();

    await openMission(page);
    await page.getByRole("button", { name: "Concluir missão" }).click();
    await expect(page.getByTestId("mission-completed")).toBeVisible();

    assertInDatabase(
      `(select count(*) = 0 from public.mission_sessions where user_id = ${OWNED} and ended_at is null)
       and (select count(*) = 1 from public.mission_sessions where user_id = ${OWNED} and ended_at is not null)`,
      "the running session should have ended when the mission did",
    );
  });

  /** RULE-103: finishing early means free, not behind. */
  test("the dashboard honours finishing early, and suggests nothing more", async ({ page }) => {
    runSql(`
      ${SATISFY_ALL}
      update public.missions set status = 'completed' where user_id = ${OWNED} and status = 'active';
    `);

    await page.goto("/dashboard");

    const done = page.getByTestId("mission-completed");
    await expect(done).toContainText("MISSÃO CONCLUÍDA");
    await expect(done).toContainText("não há mais nada a fazer aqui");
    await expect(page.getByRole("button", { name: "Iniciar sessão" })).toHaveCount(0);

    const text = (await page.locator("main").textContent()) ?? "";
    for (const nudge of ["Ative um rascunho", "Nenhuma missão ativa", "faltam"]) {
      expect(text, `a nudge appeared after completion: ${nudge}`).not.toContain(nudge);
    }
  });
});
