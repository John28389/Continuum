import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * Mission Integrity and the Trail of Evidence.
 *
 * Integrity has to come out of the database as counts, each traceable to the
 * record; the trail has to show what a mission left behind and nothing it did
 * not reach. Both are computed on every visit and stored nowhere, so what is
 * asserted here is the reading of rows the SQL suite already protects.
 */
test.describe.configure({ mode: "serial" });

const DONE = "Mapear a superfície de ataque";
const ENDED = "Automatizar o reconhecimento";
const DISCOVERY = "Subdomínios esquecidos respondem com a mesma página";
const EVIDENCE = "Inventário com vinte e três alvos publicado no repositório";

/**
 * One mission carried to completion, leaving a session, a discovery and a
 * piece of evidence on the way; one reviewed and kept, then ended on a changed
 * premise; one rule block, and one advisory that must not be counted as one.
 */
const RESET = `
do $$
declare
  v_user uuid;
  v_direction uuid;
  v_campaign uuid;
  v_cycle uuid;
  v_done uuid;
  v_first uuid;
  v_ended uuid;
begin
  select id into v_user from auth.users where email = '${TEST_USER.email}';

  delete from public.rule_events where user_id = v_user;
  delete from public.knowledge_notes where user_id = v_user;
  delete from public.curiosities where user_id = v_user;
  delete from public.missions where user_id = v_user;
  delete from public.cycles where user_id = v_user;
  delete from public.campaigns where user_id = v_user;
  delete from public.directions where user_id = v_user;

  insert into public.directions (user_id, title)
  values (v_user, 'Aumentar valor profissional')
  returning id into v_direction;

  insert into public.campaigns (user_id, direction_id, name, objective, starts_on, ends_on)
  values (v_user, v_direction, 'Web exploitation', 'Competencia pratica', current_date - 10, current_date + 80)
  returning id into v_campaign;

  insert into public.cycles (user_id, label, starts_on, ends_on, status)
  values (v_user, 'Setembro', current_date - 10, current_date + 20, 'active')
  returning id into v_cycle;

  insert into public.missions
    (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
  values (v_user, v_cycle, v_campaign, '${DONE}', 'Saber onde procurar', 60, 120)
  returning id into v_done;
  insert into public.mission_dod_criteria (user_id, mission_id, description, position)
  values (v_user, v_done, 'Inventario de vinte alvos', 0)
  returning id into v_first;
  insert into public.mission_dod_criteria (user_id, mission_id, description, position)
  values (v_user, v_done, 'Relatorio de superficie publicado', 1);
  update public.missions set status = 'active' where id = v_done;

  insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
  values (v_user, v_done, now() - interval '3 hours', now() - interval '2 hours', 'manual');
  insert into public.knowledge_notes (user_id, title, content, note_type, mission_id)
  values (v_user, '${DISCOVERY}', 'Tres respondiam com a mesma pagina de erro.', 'discovery', v_done);
  insert into public.mission_evidence (user_id, mission_id, criterion_id, description)
  values (v_user, v_done, v_first, '${EVIDENCE}');
  update public.mission_dod_criteria set satisfied_at = now() where mission_id = v_done;
  update public.missions set status = 'completed' where id = v_done;

  insert into public.missions
    (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
  values (v_user, v_cycle, v_campaign, '${ENDED}', 'Ganhar tempo no reconhecimento', 60, 120)
  returning id into v_ended;
  insert into public.mission_dod_criteria (user_id, mission_id, description)
  values (v_user, v_ended, 'Pipeline rodando sem intervencao');
  update public.missions set status = 'active' where id = v_ended;
  insert into public.mission_reviews (user_id, mission_id, reason_category, justification, outcome)
  values (v_user, v_ended, 'scope_error', 'O escopo foi revisto e continua cabendo no ciclo.', 'kept');
  insert into public.mission_reviews (user_id, mission_id, reason_category, justification, outcome)
  values (v_user, v_ended, 'premise_changed', 'A ferramenta que a missao pressupunha foi descontinuada.', 'abandoned');
  update public.missions set status = 'abandoned' where id = v_ended;

  insert into public.rule_events (user_id, rule_code, outcome) values
    (v_user, 'RULE-001', 'blocked'),
    (v_user, 'RULE-101', 'advised');
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

async function trailSteps(page: Page): Promise<(string | undefined)[]> {
  const steps = page.getByTestId("evidence-trail").locator("li");
  await expect(steps.first()).toBeVisible();
  return steps.evaluateAll((items) => items.map((item) => item.dataset.step));
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");
  runSql(RESET);
  await signIn(page);
});

test("integrity is counts of what was recorded, each traceable to the timeline", async ({
  page,
}) => {
  await page.goto("/history");
  await page.getByRole("link", { name: "Integridade", exact: true }).click();
  await expect(page).toHaveURL(/\/history\/integrity$/);

  const count = (key: string) =>
    page.locator(`[data-testid="integrity-count"][data-key="${key}"] dd`);
  await expect(count("completed")).toHaveText("1");
  await expect(count("revised")).toHaveText("0");
  await expect(count("abandoned")).toHaveText("1");
  await expect(count("reviews-kept")).toHaveText("1");
  // RULE-001 held a line; RULE-101 only advised, and is not counted.
  await expect(count("blocked")).toHaveText("1");

  const category = (key: string) =>
    page.locator(`[data-testid="integrity-category"][data-key="${key}"]`);
  await expect(category("premise_changed")).toContainText("1");
  await expect(category("scope_error")).toContainText("1");
  await expect(page.getByTestId("integrity-category")).toHaveCount(2);

  // Read-only, and no score in sight.
  const main = page.getByRole("main");
  await expect(main.getByRole("button")).toHaveCount(0);
  await expect(main).not.toContainText("%");

  await page.getByRole("link", { name: "Ver regras na linha do tempo" }).click();
  await expect(page).toHaveURL(/type=rule/);
  await expect(page.getByTestId("timeline-entry")).toHaveCount(2);
});

test("the trail of a completed mission shows what it left behind", async ({ page }) => {
  await page.goto("/missions");
  await page.getByRole("link", { name: DONE }).click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);

  expect(await trailSteps(page)).toEqual([
    "created",
    "first_session",
    "first_discovery",
    "first_evidence",
    "halfway",
    "definition_of_done",
    "completed",
  ]);

  const trail = page.getByTestId("evidence-trail");
  await expect(trail.getByRole("link", { name: DISCOVERY })).toHaveAttribute(
    "href",
    /\/knowledge\/[0-9a-f-]{36}$/,
  );
  await expect(trail).toContainText(EVIDENCE);
  // The effort is on the trail, but as effort: drawn quieter, and with no hours.
  await expect(trail.locator('[data-step="first_session"]')).toHaveAttribute("data-kind", "effort");
  await expect(trail).not.toContainText(/\d+\s?(h|min)\b/);
});

test("a mission ended early shows only the steps it reached", async ({ page }) => {
  await page.goto("/missions");
  await page.getByRole("link", { name: ENDED }).click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);

  expect(await trailSteps(page)).toEqual(["created"]);
});
