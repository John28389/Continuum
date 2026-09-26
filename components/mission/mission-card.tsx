import Link from "next/link";

import { ContentClassBadge } from "@/components/ui/content-class";
import type { MissionWithCampaign } from "@/lib/domain/mission";
import { ptBR } from "@/lib/i18n/pt-BR";
import type { MissionStatus } from "@/lib/rules/transitions";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/validation/mission";

const copy = ptBR.mission;

/**
 * Loads, as two named figures.
 *
 * Never one bar and never one percentage: a single number would have to be a
 * ratio against the target, and a ratio against the target is precisely the
 * "more hours is better" reading the product refuses. Minimum and target are
 * shown side by side, both as plain hours, neither as progress.
 */
function Load({ label, minutes }: { label: string; minutes: number }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-mono text-sm">
        {formatHours(minutes)}
        {copy.hoursShort}
      </span>
    </div>
  );
}

export function MissionCard({
  mission,
  emphasis = false,
}: {
  mission: MissionWithCampaign;
  emphasis?: boolean;
}) {
  const status = mission.status as MissionStatus;

  return (
    <article
      data-testid="mission-card"
      className={cn(
        "flex flex-col gap-3 rounded-[--radius-base] border p-4",
        emphasis ? "border-mission/40 bg-mission-subtle/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href={`/missions/${mission.id}`}
            className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {mission.title}
          </Link>
          {mission.campaigns ? (
            <p className="text-sm text-muted-foreground">{mission.campaigns.name}</p>
          ) : null}
        </div>

        {emphasis ? (
          <ContentClassBadge kind="mission" />
        ) : (
          <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            {ptBR.missionStatus[status]}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-6">
        <Load label={copy.minLoad} minutes={mission.min_load_minutes} />
        <Load label={copy.targetLoad} minutes={mission.target_load_minutes} />
      </div>
    </article>
  );
}
