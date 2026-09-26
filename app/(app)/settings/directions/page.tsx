import type { Metadata } from "next";

import { CreateDirectionForm, DirectionRow } from "./direction-forms";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listDirections } from "@/lib/domain/direction";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.hierarchy.direction.many };

export default async function DirectionsPage() {
  const supabase = await createClient();
  const directions = await listDirections(supabase);

  return (
    <>
      <PageHeader
        title={ptBR.hierarchy.direction.many}
        description={ptBR.hierarchy.direction.description}
      />

      {directions.length === 0 ? (
        <EmptyState title={ptBR.hierarchy.direction.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {directions.map((direction) => (
            <DirectionRow key={direction.id} direction={direction} />
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <h2 className="text-sm font-medium">{ptBR.hierarchy.direction.create}</h2>
        <CreateDirectionForm />
      </section>
    </>
  );
}
