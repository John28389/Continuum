import type { Metadata } from "next";

import { CampaignRow, CreateCampaignForm } from "./campaign-forms";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listCampaigns } from "@/lib/domain/campaign";
import { listActiveDirections } from "@/lib/domain/direction";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.hierarchy.campaign.many };

export default async function CampaignsPage() {
  const supabase = await createClient();
  const [campaigns, directions] = await Promise.all([
    listCampaigns(supabase),
    listActiveDirections(supabase),
  ]);

  return (
    <>
      <PageHeader
        title={ptBR.hierarchy.campaign.many}
        description={ptBR.hierarchy.campaign.description}
      />

      {campaigns.length === 0 ? (
        <EmptyState title={ptBR.hierarchy.campaign.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {campaigns.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} directions={directions} />
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <h2 className="text-sm font-medium">{ptBR.hierarchy.campaign.create}</h2>

        {directions.length === 0 ? (
          <EmptyState title={ptBR.hierarchy.campaign.needsDirection} />
        ) : (
          <CreateCampaignForm directions={directions} />
        )}
      </section>
    </>
  );
}
