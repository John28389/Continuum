"use client";

import Link from "next/link";

import { groupByDay, type DescribedEntry } from "./describe";
import { useHydrated } from "@/components/mission/clock";
import { ptBR } from "@/lib/i18n/pt-BR";

const DAY = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function dayOf(createdAt: string): string {
  return DAY.format(Date.parse(createdAt));
}

function Subject({ entry }: { entry: DescribedEntry }) {
  if (!entry.subject) return null;

  return entry.href ? (
    <Link
      href={entry.href}
      className="self-start text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {entry.subject}
    </Link>
  ) : (
    <p className="text-sm">{entry.subject}</p>
  );
}

function Entry({ entry, time }: { entry: DescribedEntry; time: string | null }) {
  return (
    <li
      data-testid="timeline-entry"
      data-kind={entry.kind}
      data-key={entry.key}
      className="grid grid-cols-[3rem_1fr] gap-x-3 py-3"
    >
      <span className="pt-0.5 font-mono text-xs text-muted-foreground">{time}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
            {ptBR.history.kinds[entry.kind]}
          </span>
          <span className="text-sm font-medium">{entry.headline}</span>
        </p>
        <Subject entry={entry} />
        {entry.detail ? <p className="text-xs text-muted-foreground">{entry.detail}</p> : null}
        {entry.quote ? (
          <blockquote className="max-w-prose border-l-2 border-border pl-3 text-sm break-words text-muted-foreground">
            {entry.quote}
          </blockquote>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The record, a day at a time.
 *
 * A client component only because days and times belong to the reader's
 * timezone, which the server does not know. Before hydration the entries
 * render as one list without times; afterwards they are grouped under the day
 * they happened, as everywhere since M10.
 */
export function Timeline({ entries }: { entries: readonly DescribedEntry[] }) {
  const hydrated = useHydrated();
  const groups = hydrated ? groupByDay(entries, dayOf) : [{ day: "", entries: [...entries] }];

  return (
    <div data-testid="timeline" className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.day || "all"} className="flex flex-col">
          {group.day ? (
            <h2 className="border-b border-border pb-2 text-sm font-medium first-letter:uppercase">
              {group.day}
            </h2>
          ) : null}
          <ol className="flex flex-col divide-y divide-border">
            {group.entries.map((entry) => (
              <Entry
                key={entry.key}
                entry={entry}
                time={hydrated ? TIME.format(Date.parse(entry.createdAt)) : null}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
