import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LoadProgressView } from "@/components/mission/load-progress";
import { SessionList } from "@/components/mission/session-list";
import { SessionLogForm } from "@/components/mission/session-log-form";
import { SessionTimer } from "@/components/mission/session-timer";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getMission } from "@/lib/domain/mission";
import {
  getRunningSession,
  listSessions,
  loadProgress,
  loggedMinutes,
  type MissionSession,
} from "@/lib/domain/session";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.session.title };

const copy = ptBR.session;

function hasFinished(sessions: MissionSession[]): boolean {
  return sessions.some((session) => session.ended_at !== null);
}

/**
 * A mission's sessions: the timer, the record, and a way to log what the timer
 * missed.
 *
 * Only an active mission offers the timer and the form. A draft was never
 * committed to, and says so; a finished mission's record is closed, and its
 * hours are shown as a bare record — no minimum, no target, nothing "missing".
 * The database refuses writes to both regardless.
 */
export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const [mission, sessions, running] = await Promise.all([
    getMission(supabase, id),
    listSessions(supabase, id),
    getRunningSession(supabase),
  ]);

  if (!mission) notFound();

  const isActive = mission.status === "active";
  const runningHere = running?.mission_id === mission.id ? running : null;

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />

      <Link
        href={`/missions/${mission.id}`}
        className="text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {mission.title}
      </Link>

      {isActive ? <SessionTimer missionId={mission.id} running={runningHere} detailed /> : null}
      {mission.status === "draft" ? (
        <p className="text-sm text-muted-foreground">{copy.onlyActive}</p>
      ) : null}

      <LoadProgressView
        progress={loadProgress(loggedMinutes(sessions), mission)}
        final={!isActive}
      />

      <section className="flex flex-col gap-3">
        {hasFinished(sessions) ? (
          <SessionList sessions={sessions} />
        ) : (
          <EmptyState title={copy.none} body={copy.noneBody} />
        )}
      </section>

      {isActive ? (
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">{copy.logTitle}</h2>
            <p className="text-xs text-muted-foreground">{copy.logDescription}</p>
          </div>
          <SessionLogForm missionId={mission.id} />
        </section>
      ) : null}
    </>
  );
}
