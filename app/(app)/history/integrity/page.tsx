import type { Metadata } from "next";

import { HistoryTabs } from "@/components/history/history-tabs";
import { IntegrityView } from "@/components/history/integrity-record";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getIntegrity } from "@/lib/domain/integrity";
import { ptBR } from "@/lib/i18n/pt-BR";
import { concludedMissions } from "@/lib/rules/integrity";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.pages.history.title };

const copy = ptBR.integrity;

/** Mission Integrity: counts, each one traceable to the timeline. Computed on every visit. */
export default async function HistoryIntegrityPage() {
  const supabase = await createClient();
  const record = await getIntegrity(supabase);

  const nothingRecorded =
    concludedMissions(record) === 0 &&
    record.reviewsKept === 0 &&
    record.impulseAttemptsBlocked === 0;

  return (
    <>
      <PageHeader title={ptBR.pages.history.title} description={ptBR.pages.history.description} />
      <HistoryTabs current="integrity" />

      <p className="max-w-prose text-sm text-muted-foreground">{copy.intro}</p>

      {nothingRecorded ? (
        <EmptyState title={copy.none} body={copy.noneBody} />
      ) : (
        <IntegrityView record={record} />
      )}
    </>
  );
}
