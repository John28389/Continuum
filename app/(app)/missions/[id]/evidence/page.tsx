import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EvidenceForm } from "@/components/mission/evidence-form";
import { EvidenceList } from "@/components/mission/evidence-list";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listEvidence } from "@/lib/domain/evidence";
import { getMission } from "@/lib/domain/mission";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.evidence.title };

const copy = ptBR.evidence;

/**
 * What a mission produced.
 *
 * Only an active mission offers the form. A draft has produced nothing it was
 * committed to, and a finished mission's record is closed; the database refuses
 * both regardless (RULE-006 for the latter), and this page simply does not offer
 * what cannot succeed.
 */
export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const [mission, evidence] = await Promise.all([
    getMission(supabase, id),
    listEvidence(supabase, id),
  ]);

  if (!mission) notFound();

  const isActive = mission.status === "active";

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />

      <Link
        href={`/missions/${mission.id}`}
        className="text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {mission.title}
      </Link>

      <section className="flex flex-col gap-3">
        {evidence.length === 0 ? (
          <EmptyState title={copy.none} body={copy.noneBody} />
        ) : (
          <EvidenceList evidence={evidence} criteria={mission.mission_dod_criteria} />
        )}
      </section>

      {isActive ? (
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="text-sm font-medium">{copy.add}</h2>
          <EvidenceForm missionId={mission.id} criteria={mission.mission_dod_criteria} />
        </section>
      ) : null}
    </>
  );
}
