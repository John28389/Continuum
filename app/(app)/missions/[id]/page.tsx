import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivateMission } from "@/components/mission/activate-mission";
import { CompletedState } from "@/components/mission/completed-state";
import { CompletionPanel } from "@/components/mission/completion-panel";
import { EvidenceTrail } from "@/components/mission/evidence-trail";
import { LoadProgressView } from "@/components/mission/load-progress";
import { ReflectionPrompt } from "@/components/mission/reflection-prompt";
import { RuleAdvisory } from "@/components/mission/rule-violation";
import { PageHeader } from "@/components/shell/page-header";
import { ContentClassBadge } from "@/components/ui/content-class";
import { evidenceByCriterion, listEvidence, type EvidenceIndex } from "@/lib/domain/evidence";
import { listNotesForMission } from "@/lib/domain/knowledge";
import { getMission, isActivatable, type DodCriterion } from "@/lib/domain/mission";
import { listSessions, loadProgress, loggedMinutes } from "@/lib/domain/session";
import { ptBR } from "@/lib/i18n/pt-BR";
import { missionMeasurability } from "@/lib/rules/measurability";
import { evidenceTrail } from "@/lib/rules/trail";
import { isTerminal, type MissionStatus } from "@/lib/rules/transitions";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/validation/mission";

export const metadata: Metadata = { title: ptBR.mission.one };

const copy = ptBR.mission;

const linkClass =
  "text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function descriptionOf(criterion: DodCriterion): string {
  return criterion.description;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

/**
 * The Definition of Done, read-only: for a draft not yet started, and for a
 * finished mission whose record is closed. A live mission gets the completion
 * panel instead.
 */
function DodList({
  criteria,
  evidence,
  showState,
}: {
  criteria: DodCriterion[];
  evidence: EvidenceIndex;
  showState: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {criteria.map((criterion) => (
        <li
          key={criterion.id}
          data-testid="criterion"
          className="flex flex-col gap-1 rounded-[--radius-base] border border-border px-4 py-3 text-sm"
        >
          {showState ? (
            <span
              className={cn(
                "font-mono text-[0.6875rem] tracking-wide uppercase",
                criterion.satisfied_at ? "text-success" : "text-muted-foreground",
              )}
            >
              {criterion.satisfied_at ? copy.satisfied : copy.openCriterion}
            </span>
          ) : null}
          <span>{criterion.description}</span>
          {(evidence[criterion.id] ?? []).map((item) => (
            <span key={item.id} className="text-xs text-muted-foreground">
              {ptBR.evidence.linked}
              {": "}
              {item.description}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

/**
 * One mission, in full.
 *
 * Output leads. For a live mission the Definition of Done comes first, with
 * completion beside it, then the evidence and only then the hours — an input
 * metric sits below the thing that actually decides completion. The review,
 * which is how a live mission is left (RULE-004), comes last and collapsed.
 *
 * A completed mission says MISSÃO CONCLUÍDA and stops. Its loads are left out
 * of the facts and its hours shown as a bare record, because "12h of a 24h
 * minimum" beside a finished mission reads as having fallen short, and finishing
 * is finishing (RULE-103). Its notes still show, as part of the record, but no
 * new action is offered beneath the completion.
 */
export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const [mission, sessions, evidence, notes] = await Promise.all([
    getMission(supabase, id),
    listSessions(supabase, id),
    listEvidence(supabase, id),
    listNotesForMission(supabase, id),
  ]);

  // Row level security means "not visible" and "does not exist" are the same
  // answer here, which is the right one to give either way.
  if (!mission) notFound();

  const status = mission.status as MissionStatus;
  const criteria = mission.mission_dod_criteria;
  const measurability = missionMeasurability(criteria.map(descriptionOf));
  const evidenceIndex = evidenceByCriterion(evidence);
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const finished = isTerminal(status);
  const hasNotes = notes.length !== 0;
  const trail = evidenceTrail({
    createdAt: mission.created_at,
    completedAt: mission.completed_at,
    sessions,
    notes,
    evidence,
    criteria,
  });

  return (
    <>
      <PageHeader title={mission.title} description={mission.reason} />

      {isCompleted ? (
        <CompletedState freedom={mission.cycles?.status === "active"} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {isActive ? (
            <ContentClassBadge kind="mission" />
          ) : (
            <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              {ptBR.missionStatus[status]}
            </span>
          )}
        </div>
      )}

      {mission.description ? (
        <p className="max-w-prose text-sm whitespace-pre-line">{mission.description}</p>
      ) : null}

      <section className="grid gap-6 rounded-[--radius-base] border border-border p-4 sm:grid-cols-4">
        <Fact label={copy.campaign} value={mission.campaigns?.name ?? ptBR.common.nothingYet} />
        <Fact label={copy.cycle} value={mission.cycles?.label ?? ptBR.common.nothingYet} />
        {isCompleted ? null : (
          <>
            <Fact
              label={copy.minLoad}
              value={`${formatHours(mission.min_load_minutes)}${copy.hoursShort}`}
            />
            <Fact
              label={copy.targetLoad}
              value={`${formatHours(mission.target_load_minutes)}${copy.hoursShort}`}
            />
          </>
        )}
      </section>

      {finished ? null : (
        <p className="max-w-prose text-xs text-muted-foreground">{copy.loadNote}</p>
      )}

      {isActive ? (
        <CompletionPanel missionId={mission.id} criteria={criteria} evidence={evidenceIndex} />
      ) : (
        <section aria-labelledby="definition-of-done" className="flex flex-col gap-3">
          <h2 id="definition-of-done" className="text-sm font-medium">
            {copy.definitionOfDone}
          </h2>
          <DodList criteria={criteria} evidence={evidenceIndex} showState={finished} />
        </section>
      )}

      {!finished && measurability.needsAdvisory ? <RuleAdvisory ruleCode="RULE-101" /> : null}

      {/* What the mission has left behind so far: output, above the hours that went in. */}
      {status === "draft" ? null : <EvidenceTrail steps={trail} />}

      {status === "draft" ? null : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-4">
            <Link href={`/missions/${mission.id}/evidence`} className={linkClass}>
              {ptBR.evidence.view}
            </Link>
            <Link href={`/missions/${mission.id}/sessions`} className={linkClass}>
              {ptBR.session.view}
            </Link>
          </div>
          <LoadProgressView
            progress={loadProgress(loggedMinutes(sessions), mission)}
            final={!isActive}
          />
        </section>
      )}

      {hasNotes || !finished ? (
        <section aria-labelledby="mission-notes" className="flex flex-col gap-2">
          <h2 id="mission-notes" className="text-sm font-medium">
            {ptBR.knowledge.missionNotes}
          </h2>
          {hasNotes ? (
            <ul data-testid="mission-notes" className="flex flex-col gap-1">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link href={`/knowledge/${note.id}`} className={linkClass}>
                    {note.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {finished ? null : (
            <Link href={`/knowledge/new?mission=${mission.id}`} className={linkClass}>
              {ptBR.knowledge.fromMission}
            </Link>
          )}
        </section>
      ) : null}

      {isActive ? <ReflectionPrompt missionId={mission.id} /> : null}

      {isActivatable(status) ? <ActivateMission missionId={mission.id} /> : null}

      <Link
        href="/missions"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {copy.back}
      </Link>
    </>
  );
}
