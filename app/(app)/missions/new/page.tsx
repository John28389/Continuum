import type { Metadata } from "next";
import Link from "next/link";

import { MissionForm } from "@/components/mission/mission-form";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listCampaigns, type Campaign } from "@/lib/domain/campaign";
import { getActiveCycle } from "@/lib/domain/cycle";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.mission.createTitle };

/** An archived campaign is history. A new mission cannot be attached to one. */
function isOpen(campaign: Campaign): boolean {
  return campaign.status !== "archived";
}

/**
 * A mission needs somewhere to belong and a cycle to live in.
 *
 * When either is missing the page says so and points at the fix, rather than
 * offering a form that could only fail. Both are preconditions the database
 * would refuse anyway — the composite foreign keys and RULE-005 — so this is
 * the interface being clear, not the interface being the rule.
 */
export default async function NewMissionPage() {
  const supabase = await createClient();
  const [campaigns, cycle] = await Promise.all([listCampaigns(supabase), getActiveCycle(supabase)]);

  const openCampaigns = campaigns.filter(isOpen);

  return (
    <>
      <PageHeader title={ptBR.mission.createTitle} description={ptBR.mission.createDescription} />

      {!cycle ? (
        <EmptyState title={ptBR.mission.needsCycle} body={ptBR.hierarchy.cycle.noneBody} />
      ) : null}

      {cycle && openCampaigns.length === 0 ? (
        <EmptyState title={ptBR.mission.needsCampaign} />
      ) : null}

      {cycle && openCampaigns.length > 0 ? (
        <MissionForm campaigns={openCampaigns} cycle={cycle} />
      ) : null}

      <Link
        href="/missions"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {ptBR.mission.back}
      </Link>
    </>
  );
}
