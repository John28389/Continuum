import { expect, test, type Page } from "@playwright/test";

import { runSql } from "./db";
import { TEST_USER } from "./global-setup";

/**
 * The parking lot: cheap capture, and RULE-007's cycle boundary as the user
 * meets it.
 *
 * The assertion that matters most here is not that the promote button was
 * hidden — it is that the *database* refuses promotion once the active
 * cycle's first mission has been activated, and explains why. The interface
 * offers the button regardless, the same choice already made for RULE-001.
 */
test.describe.configure({ mode: "serial" });

const OWNED = `(select id from auth.users where email = '${TEST_USER.email}')`;

const RESET = `
do $$
declare
  v_user uuid;
  v_direction uuid;
begin
  select id into v_user from auth.users where email = '${TEST_USER.email}';

  delete from public.rule_events where user_id = v_user;
  delete from public.curiosities where user_id = v_user;
  delete from public.missions where user_id = v_user;
  delete from public.cycles where user_id = v_user;
  delete from public.campaigns where user_id = v_user;
  delete from public.directions where user_id = v_user;

  insert into public.directions (user_id, title)
  values (v_user, 'Aumentar valor profissional')
  returning id into v_direction;

  insert into public.campaigns (user_id, direction_id, name, objective, starts_on, ends_on)
  values (v_user, v_direction, 'Web exploitation', 'Competencia pratica', current_date, current_date + 90);

  insert into public.cycles (user_id, label, starts_on, ends_on, status)
  values (v_user, 'Setembro', current_date, current_date + 30, 'active');
end
$$;
`;

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

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Creates and activates a mission, so the cycle's boundary window closes. */
async function createAndActivateMission(page: Page, title: string): Promise<void> {
  await page.goto("/missions/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Por que esta missão").fill("Fixture para fechar a janela de promoção");
  await page.getByLabel("Carga mínima (horas)").fill("10");
  await page.getByLabel("Carga-alvo (horas)").fill("20");
  await page.getByLabel("Critério 1", { exact: true }).fill("Algum resultado observável");
  await page.getByRole("button", { name: "Criar missão" }).click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Ativar missão" }).click();
  await expect(page.getByText("Missão", { exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates shared per-user state");
  runSql(RESET);
  await signIn(page);
});

test("captures a curiosity with only a title, comfortable at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/curiosities");

  await page.getByLabel("Título").fill("Homomorphic encryption");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect(page.getByText("Homomorphic encryption")).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows, "the curiosities page overflows horizontally at 375px").toBe(false);

  assertInDatabase(
    `exists (
       select 1 from public.curiosities
       where user_id = ${OWNED} and title = 'Homomorphic encryption' and state = 'captured'
     )`,
    "the curiosity was not captured with the expected state",
  );
});

test("is reachable from anywhere, with a keyboard shortcut", async ({ page }) => {
  // Not the curiosities page: the point is that capture does not require it.
  await page.goto("/dashboard");

  // The shortcut is a listener attached on hydration. A key pressed before
  // that is lost, and under a cold dev server hydration can land after the
  // page's load event, so wait for the listener rather than race it.
  await expect(page.locator("[data-capture-ready]")).toBeAttached();
  await page.keyboard.press("c");
  await page.getByLabel("Título").fill("Post-quantum signatures");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  // The panel closes itself once capture succeeds.
  await expect(page.getByRole("dialog", { name: "Nova curiosidade" })).toHaveCount(0);

  assertInDatabase(
    `exists (
       select 1 from public.curiosities
       where user_id = ${OWNED} and title = 'Post-quantum signatures'
     )`,
    "the curiosity captured through the global shortcut was not recorded",
  );
});

test("promotes a curiosity into a draft mission at the cycle boundary", async ({ page }) => {
  await page.goto("/curiosities");
  await page.getByLabel("Título").fill("Wireless security");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  const card = page.getByTestId("curiosity-card").filter({ hasText: "Wireless security" });
  await card.getByText("Promover a missão").click();

  await card.getByLabel("Campanha").selectOption({ label: "Web exploitation" });
  await card
    .getByLabel("Por que esta missão")
    .fill("Promovida do estacionamento na virada do ciclo");
  await card.getByLabel("Carga mínima (horas)").fill("10");
  await card.getByLabel("Carga-alvo (horas)").fill("20");
  await card.getByRole("button", { name: "Confirmar promoção" }).click();

  await expect(card.getByText("Escolhida")).toBeVisible();

  assertInDatabase(
    `exists (
       select 1 from public.missions m
       join public.curiosities c on c.promoted_mission_id = m.id
       where m.user_id = ${OWNED} and c.title = 'Wireless security'
         and m.status = 'draft' and m.title = 'Wireless security'
     )`,
    "promotion did not produce a linked draft mission",
  );
});

/**
 * The milestone's central test: the database refuses promotion once the
 * active cycle already has an activated mission, and explains RULE-007 —
 * exactly as a rule violation for a mission already showed for RULE-001.
 */
test("refuses promotion once the active cycle already has an activated mission", async ({
  page,
}) => {
  await createAndActivateMission(page, "Fundamentos de web exploitation");

  await page.goto("/curiosities");
  await page.getByLabel("Título").fill("Too late this cycle");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  const card = page.getByTestId("curiosity-card").filter({ hasText: "Too late this cycle" });
  await card.getByText("Promover a missão").click();

  await card.getByLabel("Campanha").selectOption({ label: "Web exploitation" });
  await card.getByLabel("Por que esta missão").fill("Tentativa fora da janela de promoção");
  await card.getByLabel("Carga mínima (horas)").fill("10");
  await card.getByLabel("Carga-alvo (horas)").fill("20");
  await card.getByRole("button", { name: "Confirmar promoção" }).click();

  const block = card.getByTestId("rule-violation");
  await expect(block).toBeVisible();
  await expect(block).toContainText("RULE-007");

  // Not a stack trace and not a telling-off.
  const text = (await block.textContent()) ?? "";
  for (const leak of ["constraint", "duplicate key", "relation", "postgres", "ct001"]) {
    expect(text.toLowerCase(), `refusal leaked SQL: ${text}`).not.toContain(leak);
  }

  assertInDatabase(
    `(select state from public.curiosities where user_id = ${OWNED} and title = 'Too late this cycle') = 'captured'`,
    "a refused promotion should leave the curiosity captured, not chosen",
  );
});

test("states are filterable, and archiving is a direct action", async ({ page }) => {
  await page.goto("/curiosities");

  await page.getByLabel("Título").fill("Quantum key distribution");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Quantum key distribution")).toBeVisible();

  const card = page.getByTestId("curiosity-card").filter({ hasText: "Quantum key distribution" });
  const cardState = card.getByLabel("Estado");
  const pageFilter = page.locator("#curiosity-state-filter");

  await cardState.selectOption("archived");
  await expect(cardState).toHaveValue("archived");

  await pageFilter.selectOption("captured");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText("Quantum key distribution")).toHaveCount(0);

  await pageFilter.selectOption("archived");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText("Quantum key distribution")).toBeVisible();
});
