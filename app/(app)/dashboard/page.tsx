import type { Metadata } from "next";
import Link from "next/link";

import { ActiveCycle, OpenCycleForm } from "./_components/cycle-status";
import { CompletedState } from "@/components/mission/completed-state";
import { LoadProgressView } from "@/components/mission/load-progress";
import { MissionCard } from "@/components/mission/mission-card";
import { SessionTimer } from "@/components/mission/session-timer";
import { PageHeader } from "@/components/shell/page-header";
import { ContentClassBadge } from "@/components/ui/content-class";
import { EmptyState } from "@/components/ui/empty-state";
import { countOpenCuriosities } from "@/lib/domain/curiosity";
import { cycleProgress, getActiveCycle } from "@/lib/domain/cycle";
import {
  getActiveMission,
  getCompletedMissionInCycle,
  type ActiveMission,
  type MissionWithCampaign,
} from "@/lib/domain/mission";
import {
  getRunningSession,
  listSessions,
  loadProgress,
  loggedMinutes,
  type LoadProgress,
  type MissionSession,
} from "@/lib/domain/session";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.pages.dashboard.title };

/** Today, and the last day of the current month, as YYYY-MM-DD. */
function defaultCyclePeriod() {
  const now = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  return {
    label: new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(now),
    start: iso(now),
    end: iso(endOfMonth),
  };
}

function satisfiedCount(mission: ActiveMission): number {
  return mission.mission_dod_criteria.filter((c) => c.satisfied_at !== null).length;
}

/**
 * The current mission, in the order that keeps hours honest.
 *
 * Output first — how much of the Definition of Done is satisfied. Then the
 * timer, because starting a session has to be one action from here. Then hours,
 * last and in the neutral chrome, because they are an input.
 */
function CurrentMission({
  mission,
  running,
  progress,
}: {
  mission: ActiveMission;
  running: MissionSession | null;
  progress: LoadProgress;
}) {
  return (
    <div className="flex flex-col gap-3">
      <MissionCard mission={mission} emphasis />
      <p data-testid="criteria-satisfied" className="text-sm">
        {satisfiedCount(mission)} {ptBR.mission.of} {mission.mission_dod_criteria.length}{" "}
        {ptBR.mission.criteriaSatisfied}
      </p>
      <SessionTimer missionId={mission.id} running={running} />
      <LoadProgressView progress={progress} />
    </div>
  );
}

/**
 * The cycle's mission, finished — and nothing else.
 *
 * With no active mission the dashboard could fall back to its empty state, and
 * that state invites the person to activate something. After a completion that
 * would be the system manufacturing work (RULE-103). So the honest answer to
 * "what am I doing now" is shown instead: this is done, and the rest of the
 * cycle is free.
 */
function FinishedMission({ mission, freedom }: { mission: MissionWithCampaign; freedom: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <CompletedState freedom={freedom} />
      <MissionCard mission={mission} />
    </div>
  );
}

const shortcutClass =
  "text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * The four shortcuts, without repeating any.
 *
 * Starting a session is already one action inside the current mission, and
 * parking a curiosity is the capture control on every screen (and the C key).
 * The two that had nowhere to live are here. Recording a discovery belongs to
 * a live mission only: after completion it would be the system suggesting more
 * work (RULE-103), so it disappears with the mission.
 */
function Shortcuts({ missionId }: { missionId: string | null }) {
  return (
    <nav
      aria-label={ptBR.dashboard.shortcuts}
      className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6"
    >
      {missionId ? (
        <Link href={`/knowledge/new?mission=${missionId}&type=discovery`} className={shortcutClass}>
          {ptBR.dashboard.recordDiscovery}
        </Link>
      ) : null}
      <Link href="/rules" className={shortcutClass}>
        {ptBR.dashboard.openRules}
      </Link>
    </nav>
  );
}

/**
 * The dashboard answers five questions: what am I doing now, how much have I
 * done, what is left, what next, and what should I ignore for now.
 *
 * Its contents are a closed list — current mission, cycle status, a curiosity
 * count, and shortcuts. Detail belongs on the secondary pages.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const [cycle, mission, running, curiosityCount] = await Promise.all([
    getActiveCycle(supabase),
    getActiveMission(supabase),
    getRunningSession(supabase),
    countOpenCuriosities(supabase),
  ]);
  // Plain values where there is nothing to fetch: Promise.all passes them through.
  const [sessions, finished] = await Promise.all([
    mission ? listSessions(supabase, mission.id) : [],
    !mission && cycle ? getCompletedMissionInCycle(supabase, cycle.id) : null,
  ]);
  const progress = cycle ? cycleProgress(cycle) : null;
  const defaults = defaultCyclePeriod();

  return (
    <>
      <PageHeader
        title={ptBR.pages.dashboard.title}
        description={ptBR.pages.dashboard.description}
      />

      <section className="flex flex-col gap-3" aria-labelledby="current-mission">
        <div className="flex items-center gap-3">
          <h2 id="current-mission" className="text-sm font-medium">
            {ptBR.mission.current}
          </h2>
          <ContentClassBadge kind="mission" />
        </div>
        {mission ? (
          <CurrentMission
            mission={mission}
            running={running?.mission_id === mission.id ? running : null}
            progress={loadProgress(loggedMinutes(sessions), mission)}
          />
        ) : null}
        {!mission && finished ? (
          <FinishedMission mission={finished} freedom={!progress?.hasEnded} />
        ) : null}
        {!mission && !finished ? (
          <EmptyState title={ptBR.mission.noneActive} body={ptBR.mission.noneActiveBody} />
        ) : null}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="cycle-status">
        <h2 id="cycle-status" className="text-sm font-medium">
          {ptBR.hierarchy.cycle.one}
        </h2>

        {cycle && progress ? (
          <ActiveCycle cycle={cycle} progress={progress} />
        ) : (
          <div className="flex flex-col gap-4">
            <EmptyState title={ptBR.hierarchy.cycle.none} body={ptBR.hierarchy.cycle.noneBody} />
            <OpenCycleForm
              defaultLabel={defaults.label}
              defaultStart={defaults.start}
              defaultEnd={defaults.end}
            />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="curiosities-summary">
        <div className="flex items-center gap-3">
          <h2 id="curiosities-summary" className="text-sm font-medium">
            {ptBR.pages.curiosities.title}
          </h2>
          <ContentClassBadge kind="curiosity" />
        </div>
        <Link
          href="/curiosities"
          className="text-sm text-curiosity underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {curiosityCount} {ptBR.curiosity.dashboardCount}
        </Link>
      </section>

      <Shortcuts missionId={mission?.id ?? null} />
    </>
  );
}
