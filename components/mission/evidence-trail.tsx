"use client";

import Link from "next/link";

import { useHydrated } from "./clock";
import { ptBR } from "@/lib/i18n/pt-BR";
import type { TrailStep } from "@/lib/rules/trail";
import { cn } from "@/lib/utils";

const copy = ptBR.trail;

const WHEN = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function Artifact({ step }: { step: TrailStep }) {
  if (!step.artifact) return null;

  return step.artifact.href ? (
    <Link
      href={step.artifact.href}
      className="self-start text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {step.artifact.text}
    </Link>
  ) : (
    <p className="max-w-prose text-sm break-words">{step.artifact.text}</p>
  );
}

/**
 * The Trail of Evidence: the steps this mission has reached, and what each one
 * left behind.
 *
 * Output reads as output — a discovery's title, the evidence's own words — and
 * the one step about effort is drawn quieter, with no duration. A client
 * component only because dates belong to the reader's timezone.
 */
export function EvidenceTrail({ steps }: { steps: readonly TrailStep[] }) {
  const hydrated = useHydrated();

  return (
    <section aria-labelledby="evidence-trail" className="flex flex-col gap-3">
      <h2 id="evidence-trail" className="text-sm font-medium">
        {copy.title}
      </h2>
      <ol data-testid="evidence-trail" className="ml-1 flex flex-col border-l border-border">
        {steps.map((step) => (
          <li
            key={step.key}
            data-step={step.key}
            data-kind={step.kind}
            className="relative flex flex-col gap-0.5 pb-4 pl-5 last:pb-0"
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1.5 -left-[5px] size-2.5 rounded-full",
                step.kind === "effort" ? "bg-border-strong" : "bg-foreground",
              )}
            />
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={cn(
                  "text-sm",
                  step.kind === "effort" ? "text-muted-foreground" : "font-medium",
                )}
              >
                {copy.steps[step.key]}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {hydrated ? WHEN.format(Date.parse(step.at)) : null}
              </span>
            </p>
            <Artifact step={step} />
          </li>
        ))}
      </ol>
    </section>
  );
}
