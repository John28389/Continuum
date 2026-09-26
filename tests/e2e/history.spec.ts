import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * History: the record, read back.
 *
 * What only a browser against the real database can show: that three tables
 * merge into one timeline, that the filters narrow it by the reader's own
 * days, that a cursor steps through a page boundary falling in the middle of
 * one transaction's rows without losing or repeating any, and that nothing on
 * the page offers to change what it shows.
 */
test.describe.configure({ mode: "serial" });

const DONE = "Mapear a superfície de ataque";
const ENDED = "Automatizar o reconhecimento";
const CURRENT = "Fundamentos de web exploitation";
const JUSTIFICATION = "A ferramenta que a missão pressupunha foi descontinuada pelo fornecedor.";

/**
 * A closed August with one mission completed and one ended by review, and a
 * current September with an active mission, a parked curiosity and one rule
 * block. August's decisions are moved thirty days back, where they happened.
 *
 * Sixteen entries: fourteen audit events, one review, one rule event.
 */
const RESET = `
do $$
declare
  v_user uuid;
  v_direction uuid;
  v_campaign uuid;
  v_august uuid;
  v_september uuid;
  v_done uuid;
  v_ended uuid;
  v_current uuid;
begin
  select id into v_user from auth.users where email = '${TEST_USER.email}';

  delete from public.rule_events where user_id = v_user;
  delete from public.curiosities where user_id = v_user;
  delete from public.missions where user_id = v_user;
  delete from public.cycles where user_id = v_user;
  delete from public.campaigns where user_id = v_user;
  delete from public.directions where user_id = v_user;
  -- Only a fixture can do this: no policy lets the application delete the record.
  delete from public.audit_events where user_id = v_user;

  insert into public.directions (user_id, title)
  values (v_user, 'Aumentar valor profissional')
  returning id into v_direction;

  insert into public.campaigns (user_id, direction_id, name, objective, starts_on, ends_on)
  values (v_user, v_direction, 'Web exploitation', 'Competencia pratica', current_date - 60, current_date + 30)
  returning id into v_campaign;

  insert into public.cycles (user_id, label, starts_on, ends_on, status)
  values (v_user, 'Agosto', current_date - 45, current_date - 16, 'active')
  returning id into v_august;

  insert into public.missions
    (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
  values (v_user, v_august, v_campaign, '${DONE}', 'Saber onde procurar', 60, 120)
  returning id into v_done;
  insert into public.mission_dod_criteria (user_id, mission_id, description)
  values (v_user, v_done, 'Inventario de vinte alvos');
  update public.missions set status = 'active' where id = v_done;
  update public.mission_dod_criteria set satisfied_at = now() where mission_id = v_done;
  update public.missions set status = 'completed' where id = v_done;

  insert into public.missions
    (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
  values (v_user, v_august, v_campaign, '${ENDED}', 'Ganhar tempo no reconhecimento', 60, 120)
  returning id into v_ended;
  insert into public.mission_dod_criteria (user_id, mission_id, description)
  values (v_user, v_ended, 'Pipeline rodando sem intervencao');
  update public.missions set status = 'active' where id = v_ended;
  insert into public.mission_reviews (user_id, mission_id, reason_category, justification, outcome)
  values (v_user, v_ended, 'premise_changed', '${JUSTIFICATION}', 'abandoned');
  update public.missions set status = 'abandoned' where id = v_ended;

  update public.cycles set status = 'closed', closed_at = now() where id = v_august;

  insert into public.cycles (user_id, label, starts_on, ends_on, status)
  values (v_user, 'Setembro', current_date - 15, current_date + 15, 'active')
  returning id into v_september;

  insert into public.missions
    (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
  values (v_user, v_september, v_campaign, '${CURRENT}', 'Fechar a distancia entre ler e encontrar', 60, 120)
  returning id into v_current;
  insert into public.mission_dod_criteria (user_id, mission_id, description)
  values (v_user, v_current, 'Reproduzir oito labs sem walkthrough');
  update public.missions set status = 'active' where id = v_current;

  insert into public.curiosities (user_id, title) values (v_user, 'Fuzzing de protocolos');

  insert into public.rule_events (user_id, rule_code, outcome, context)
  values (v_user, 'RULE-001', 'blocked',
          jsonb_build_object('action', 'mission.activate', 'mission_id', v_current));

  update public.audit_events set created_at = now() - interval '30 days'
   where user_id = v_user and entity_id in (v_august, v_done, v_ended);
  update public.mission_reviews set created_at = now() - interval '30 days'
   where mission_id = v_ended;
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

test("the timeline reads back every kind of decision, newest first", async ({ page }) => {
  await page.goto("/history");

  const timeline = page.getByTestId("timeline");
  await expect(timeline).toContainText("Missão criada");
  await expect(timeline).toContainText("Missão ativada");
  await expect(timeline).toContainText("Missão concluída");
  await expect(timeline).toContainText("Missão encerrada");
  await expect(timeline).toContainText("Revisão registrada");
  await expect(timeline).toContainText("A premissa mudou · Decisão: Encerrar");
  await expect(timeline).toContainText(JUSTIFICATION);
  await expect(timeline).toContainText("Curiosidade guardada");
  await expect(timeline).toContainText("RULE-001 · Bloqueou · Ativar missão");
  await expect(timeline).toContainText("Ciclo encerrado");

  const entries = page.getByTestId("timeline-entry");
  await expect(entries).toHaveCount(16);
  // Today's entries first; August's last, ending with the review that was
  // recorded in the same transaction as the exit it justified.
  await expect(entries.first()).not.toContainText(DONE);
  await expect(entries.last()).toHaveAttribute("data-kind", "review");

  // Two days, grouped under their headings once the reader's timezone is known.
  await expect(timeline.getByRole("heading")).toHaveCount(2);
});

test("filters by type, with reviews read alongside missions", async ({ page }) => {
  await page.goto("/history");

  await page.getByLabel("Tipo").selectOption({ label: "Curiosidades" });
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/type=curiosity/);

  const entries = page.getByTestId("timeline-entry");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toHaveAttribute("data-kind", "curiosity");

  await page.getByLabel("Tipo").selectOption({ label: "Missões e revisões" });
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/type=mission/);
  await expect(entries).toHaveCount(9);
  await expect(page.locator('[data-testid="timeline-entry"][data-kind="curiosity"]')).toHaveCount(
    0,
  );
});

test("filters by date range, in the reader's own days", async ({ page }) => {
  await page.goto("/history");

  await page.getByLabel("De", { exact: true }).fill(day(-40));
  await page.getByLabel("Até", { exact: true }).fill(day(-20));
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/tz=/);

  const timeline = page.getByTestId("timeline");
  await expect(timeline).toContainText(DONE);
  await expect(timeline).not.toContainText(CURRENT);
  // August: the cycle opened and closed, three events per mission, one review.
  await expect(page.getByTestId("timeline-entry")).toHaveCount(9);
});

test("past cycles show their missions and how each ended, and open their slice of the timeline", async ({
  page,
}) => {
  await page.goto("/history");
  await page.getByRole("link", { name: "Ciclos", exact: true }).click();
  await expect(page).toHaveURL(/\/history\/cycles$/);

  const august = page.getByTestId("cycle-record").filter({ hasText: "Agosto" });
  await expect(august).toContainText("Encerrado");
  await expect(august).toContainText(DONE);
  await expect(august).toContainText("Concluída");
  await expect(august).toContainText(ENDED);
  await expect(august).toContainText("Encerrada · A premissa mudou");

  const september = page.getByTestId("cycle-record").filter({ hasText: "Setembro" });
  await expect(september).toContainText("Em andamento");
  await expect(september).toContainText(CURRENT);

  await august.getByRole("link", { name: "Ver na linha do tempo" }).click();

  // The link carries no timezone; the browser adds its own, once.
  await expect(page).toHaveURL(/cycle=[0-9a-f-]{36}&tz=/);
  await expect(page.getByLabel("Ciclo", { exact: true })).not.toHaveValue("");

  const timeline = page.getByTestId("timeline");
  await expect(timeline).toContainText(DONE);
  await expect(timeline).toContainText(ENDED);
  await expect(timeline).not.toContainText(CURRENT);
});

test("pages through a long record by cursor, losing and repeating nothing", async ({ page }) => {
  // Forty captures in one statement share one instant, so the first page ends
  // in the middle of a tie and the second must start inside it.
  runSql(`
    insert into public.curiosities (user_id, title)
    select u.id, 'Ideia ' || n
      from auth.users u, generate_series(1, 40) as n
     where u.email = '${TEST_USER.email}';
  `);

  await page.goto("/history");

  const entries = page.getByTestId("timeline-entry");
  const keys = () => entries.evaluateAll((items) => items.map((item) => item.dataset.key));

  await expect(entries).toHaveCount(30);
  const first = await keys();

  await page.getByRole("link", { name: "Registros anteriores" }).click();
  await expect(page).toHaveURL(/before=/);
  await expect(entries).toHaveCount(26);
  const second = await keys();

  await expect(page.getByRole("link", { name: "Registros anteriores" })).toHaveCount(0);
  expect(new Set([...first, ...second]).size).toBe(56);

  await page.getByRole("link", { name: "Voltar aos mais recentes" }).click();
  await expect(entries).toHaveCount(30);
});

test("the record offers no way to change it", async ({ page }) => {
  const main = page.getByRole("main");

  await page.goto("/history");
  await expect(page.getByTestId("timeline")).toBeVisible();
  // The filter is the only control, and it only reads.
  await expect(main.getByRole("button")).toHaveCount(1);
  await expect(main.getByRole("button", { name: "Filtrar" })).toBeVisible();
  await expect(main.locator("form")).toHaveCount(1);
  await expect(main.locator("form")).toHaveAttribute("method", "get");

  await page.goto("/history/cycles");
  await expect(page.getByTestId("cycle-record").first()).toBeVisible();
  await expect(main.getByRole("button")).toHaveCount(0);
  await expect(main.locator("form")).toHaveCount(0);
});
