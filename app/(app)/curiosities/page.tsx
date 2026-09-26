import type { Metadata } from "next";

import { CuriosityList } from "@/components/curiosity/curiosity-list";
import { QuickCapture } from "@/components/curiosity/quick-capture";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, controlClass } from "@/components/ui/form";
import { listCampaigns, type Campaign } from "@/lib/domain/campaign";
import { listCuriosities } from "@/lib/domain/curiosity";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";
import { CURIOSITY_STATES, type CuriosityState } from "@/lib/validation/curiosity";

export const metadata: Metadata = { title: ptBR.pages.curiosities.title };

const copy = ptBR.curiosity;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function asState(value: string): CuriosityState | null {
  return CURIOSITY_STATES.find((state) => state === value) ?? null;
}

function isOpen(campaign: Campaign): boolean {
  return campaign.status !== "archived";
}

function matchesState(curiosity: { state: string }, filterState: CuriosityState | null): boolean {
  return filterState === null || curiosity.state === filterState;
}

/**
 * The parking lot in full — the one place the whole list is allowed to show.
 * The dashboard gets a count only (M12's acceptance criterion 3); detail
 * belongs here.
 */
export default async function CuriositiesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filterState = asState(single(params.state));

  const supabase = await createClient();
  const [curiosities, campaigns] = await Promise.all([
    listCuriosities(supabase),
    listCampaigns(supabase),
  ]);

  const openCampaigns = campaigns.filter(isOpen);
  const hasCuriosities = curiosities.length !== 0;
  const found = curiosities.filter((curiosity) => {
    return matchesState(curiosity, filterState);
  });
  const nothingFound = hasCuriosities && found.length === 0;

  return (
    <>
      <PageHeader
        title={ptBR.pages.curiosities.title}
        description={ptBR.pages.curiosities.description}
      />

      <section className="rounded-[--radius-base] border border-border p-4">
        <QuickCapture />
      </section>

      {hasCuriosities ? null : <EmptyState title={copy.none} body={copy.noneBody} />}

      {hasCuriosities ? (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="curiosity-state-filter" className="text-sm font-medium">
              {copy.filterLabel}
            </label>
            <select
              id="curiosity-state-filter"
              name="state"
              defaultValue={filterState ?? ""}
              className={controlClass}
            >
              <option value="">{copy.filterAll}</option>
              {CURIOSITY_STATES.map((state) => (
                <option key={state} value={state}>
                  {ptBR.curiosityState[state]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="quiet">
            {copy.filterApply}
          </Button>
        </form>
      ) : null}

      {nothingFound ? <EmptyState title={copy.noMatch} /> : null}

      {found.length !== 0 ? <CuriosityList curiosities={found} campaigns={openCampaigns} /> : null}
    </>
  );
}
