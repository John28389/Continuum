import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * Sessions: time as an input, visibly subordinate to output.
 *
 * Two properties are proven here that no unit test can reach. That the timer
 * is one action from the dashboard, and that a manually logged time means the
 * instant the person meant — which is why this file runs in São Paulo's
 * timezone and then checks the stored instant in UTC.
 */
test.describe.configure({ mode: "serial" });
test.use({ timezoneId: "America/Sao_Paulo" });

const MISSION = "Fundamentos de web exploitation";
const OWNED = `(select id from auth.users where email = '${TEST_USER.email}')`;

/** An active mission with small loads: minimum one hour, target two. */
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

/**
 * Asserts in SQL and raises there, so a wrong answer fails the run.
 *
 * The message is quoted for SQL: an apostrophe in plain English ("the
 * mission's status") would otherwise end the string literal and turn a failed
 * assertion into a syntax error that says nothing about the product.
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

function sessionCount(where = "true"): string {
  return `(select count(*) from public.mission_sessions where user_id = ${OWNED} and ${where})`;
}

/** Two days ago, as a calendar date: in the past in every timezone on earth. */
function pastDate(): string {
  return new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function openSessions(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: MISSION }).click();
  await page.getByRole("link", { name: "Sessões", exact: true }).click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}\/sessions$/);
}

async function logSession(page: Page, time: string, hours: string, note?: string) {
  await page.getByLabel("Data").fill(pastDate());
  await page.getByLabel("Início").fill(time);
  await page.getByLabel("Duração (horas)").fill(hours);
  if (note) await page.getByLabel("Nota (opcional)").fill(note);
  await page.getByRole("button", { name: "Registrar sessão" }).click();
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");
  runSql(RESET);
  await signIn(page);
});

test("starts a session from the dashboard in one action, and stops it", async ({ page }) => {
  await page.getByRole("button", { name: "Iniciar sessão" }).click();

  // The start time and elapsed minutes appear only after hydration, formatted
  // in the reader's timezone. Visibility alone would pass with a clock that
  // never ticked.
  const running = page.getByTestId("running-session");
  await expect(running).toBeVisible();
  await expect(running).toContainText(/desde \d{2}:\d{2} · 0min/);
  assertInDatabase(`${sessionCount("ended_at is null")} = 1`, "no running session was stored");

  // It survives a reload: the start lives in the database, not in the tab.
  await page.reload();
  await expect(page.getByTestId("running-session")).toBeVisible();

  await page.getByRole("button", { name: "Encerrar sessão" }).click();

  await expect(page.getByRole("button", { name: "Iniciar sessão" })).toBeVisible();
  assertInDatabase(
    `${sessionCount("ended_at is not null")} = 1 and ${sessionCount("ended_at is null")} = 0`,
    "stopping should leave exactly one finished session",
  );
});

/**
 * The timezone test.
 *
 * 09:00 typed in São Paulo is 12:00 UTC. If the conversion happened on the
 * server, or not at all, the stored instant would be 09:00 UTC — three hours
 * off, and invisible until someone's overlap check misfired at midnight.
 */
test("logs a session in the reader's own timezone, and counts it against both loads", async ({
  page,
}) => {
  await openSessions(page);
  await logSession(page, "09:00", "1,5", "Lab 3, SQL injection");

  const list = page.getByTestId("session-list");
  await expect(list).toContainText("1h 30min");
  await expect(list).toContainText("registrada depois");
  await expect(list).toContainText("Lab 3, SQL injection");
  // Shown back in local time, not in UTC.
  await expect(list).toContainText("09:00–10:30");

  assertInDatabase(
    `(select to_char(started_at at time zone 'UTC', 'HH24:MI') = '12:00'
        and ended_at - started_at = interval '90 minutes'
       from public.mission_sessions where user_id = ${OWNED})`,
    "the stored instant is not 09:00 in Sao Paulo",
  );

  const load = page.getByTestId("load-progress");
  await expect(load).toContainText("1,5h");
  await expect(load).toContainText("Métrica de entrada");
  // Past the one-hour minimum, short of the two-hour target.
  await expect(load).toContainText("atingido");
  await expect(page.getByTestId("rule-102")).toHaveCount(0);
});

test("refuses an overlapping session and explains it", async ({ page }) => {
  await openSessions(page);
  await logSession(page, "09:00", "1");
  await expect(page.getByTestId("session-list")).toContainText("1h");

  await logSession(page, "09:30", "1");

  const alert = page.getByRole("alert").filter({ hasText: "sobrepõe" });
  await expect(alert).toContainText("Este período se sobrepõe a outra sessão");

  const text = ((await alert.textContent()) ?? "").toLowerCase();
  for (const leak of ["mission_sessions", "overlap", "23p01", "tstzrange", "postgres"]) {
    expect(text, `refusal leaked SQL: ${text}`).not.toContain(leak);
  }

  assertInDatabase(`${sessionCount()} = 1`, "the overlapping session should not have been stored");
});

/**
 * The interface never offers a second start while one is running, so the
 * refusal is provoked the way it would really happen: the page was rendered
 * with nothing running, and by the time the button is pressed something is.
 */
test("refuses a second running session at the server, not only in the interface", async ({
  page,
}) => {
  await expect(page.getByRole("button", { name: "Iniciar sessão" })).toBeVisible();

  runSql(`
    insert into public.mission_sessions (user_id, mission_id, started_at)
    select user_id, id, now() - interval '10 minutes'
    from public.missions where user_id = ${OWNED} and status = 'active';
  `);

  await page.getByRole("button", { name: "Iniciar sessão" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "sessão" })).toContainText(
    "Já há uma sessão em andamento",
  );
  assertInDatabase(`${sessionCount("ended_at is null")} = 1`, "a second running session exists");
});

/** RULE-102, said plainly where the hours are. */
test("reaching the target load says it does not complete the mission", async ({ page }) => {
  await openSessions(page);
  await logSession(page, "08:00", "2,5");

  const note = page.getByTestId("rule-102");
  await expect(note).toContainText("RULE-102");
  await expect(note).toContainText("a missão não está concluída");

  assertInDatabase(
    `(select status = 'active' and completed_at is null
        from public.missions where user_id = ${OWNED} and title = '${MISSION}')`,
    "RULE-102 broken: logging hours changed the mission's status",
  );

  // Output still leads on the dashboard: nothing is satisfied, whatever the hours say.
  await page.goto("/dashboard");
  await expect(page.getByTestId("criteria-satisfied")).toContainText("0 de 1");
});

test("discards a forgotten timer without recording its time", async ({ page }) => {
  runSql(`
    insert into public.mission_sessions (user_id, mission_id, started_at)
    select user_id, id, now() - interval '20 hours'
    from public.missions where user_id = ${OWNED} and status = 'active';
  `);

  await openSessions(page);
  await expect(page.getByTestId("running-session")).toBeVisible();

  await page.getByRole("button", { name: "Descartar sessão" }).click();

  await expect(page.getByRole("button", { name: "Iniciar sessão" })).toBeVisible();
  assertInDatabase(`${sessionCount()} = 0`, "the discarded session is still stored");
});
