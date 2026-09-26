import type { Metadata } from "next";

import { CycleRecords } from "@/components/history/cycle-records";
import { HistoryTabs } from "@/components/history/history-tabs";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listCycleRecords } from "@/lib/domain/history";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.pages.history.title };

const copy = ptBR.history.cycles;

/** Past cycles, and the current one, each with its missions and how they ended. */
export default async function HistoryCyclesPage() {
  const supabase = await createClient();
  const records = await listCycleRecords(supabase);

  return (
    <>
      <PageHeader title={ptBR.pages.history.title} description={ptBR.pages.history.description} />
      <HistoryTabs current="cycles" />

      {records.length === 0 ? (
        <EmptyState title={copy.none} body={copy.noneBody} />
      ) : (
        <CycleRecords records={records} />
      )}
    </>
  );
}
