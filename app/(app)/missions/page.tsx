import type { Metadata } from "next";
import Link from "next/link";

import { MissionCard } from "@/components/mission/mission-card";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listMissions, type MissionWithCampaign } from "@/lib/domain/mission";
import { ptBR } from "@/lib/i18n/pt-BR";
import { isTerminal, type MissionStatus } from "@/lib/rules/transitions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.pages.missions.title };

/** Active, still being planned, and over with. Nothing is hidden. */
function groupMissions(missions: MissionWithCampaign[]) {
  return {
    active: missions.filter((m) => m.status === "active"),
    drafts: missions.filter((m) => m.status === "draft"),
    closed: missions.filter((m) => isTerminal(m.status as MissionStatus)),
  };
}

function Section({ title, missions }: { title: string; missions: MissionWithCampaign[] }) {
  if (missions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="flex flex-col gap-3">
        {missions.map((mission) => (
          <li key={mission.id}>
            <MissionCard mission={mission} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The mission list, grouped by what it is reasonable to do next.
 *
 * The active mission sits alone at the top with the mission content class, and
 * nothing else on the page carries that weight — a list where a parked draft
 * reads as urgently as the thing being worked on is the flattening this product
 * exists to prevent. Closed missions stay visible: they are the record.
 */
export default async function MissionsPage() {
  const supabase = await createClient();
  const missions = await listMissions(supabase);

  const { active, drafts, closed } = groupMissions(missions);

  return (
    <>
      <PageHeader
        title={ptBR.pages.missions.title}
        description={ptBR.pages.missions.description}
        action={
          <Link
            href="/missions/new"
            className="rounded-[--radius-base] bg-mission px-4 py-2 text-sm font-medium text-mission-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {ptBR.mission.create}
          </Link>
        }
      />

      {missions.length === 0 ? (
        <EmptyState title={ptBR.mission.none} body={ptBR.mission.noneBody} />
      ) : null}

      {active.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">{ptBR.mission.current}</h2>
          {active.map((mission) => (
            <MissionCard key={mission.id} mission={mission} emphasis />
          ))}
        </section>
      ) : null}

      <Section title={ptBR.mission.drafts} missions={drafts} />
      <Section title={ptBR.mission.closed} missions={closed} />
    </>
  );
}
