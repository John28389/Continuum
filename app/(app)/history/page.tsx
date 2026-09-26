import type { Metadata } from "next";
import Link from "next/link";

import { describeEntry } from "@/components/history/describe";
import { HistoryTabs } from "@/components/history/history-tabs";
import { Timeline } from "@/components/history/timeline";
import { TimelineFilters } from "@/components/history/timeline-filters";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listCycles } from "@/lib/domain/cycle";
import { listTimeline, resolveRange, resolveSubjects } from "@/lib/domain/history";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";
import {
  dependsOnTimeZone,
  historyQuery,
  parseHistoryFilters,
  type HistoryCursor,
  type HistoryFilters,
} from "@/lib/validation/history";

export const metadata: Metadata = { title: ptBR.pages.history.title };

const copy = ptBR.history;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function historyHref(filters: HistoryFilters, before: HistoryCursor | null = null): string {
  const query = historyQuery(filters, before).toString();
  return query ? `/history?${query}` : "/history";
}

const pageLinkClass =
  "text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * The record, newest first.
 *
 * Read-only by construction: the only form here is a GET filter, and the
 * tables it reads have no update or delete policy at all. Pages are cut by
 * cursor, so the thousandth page costs what the first does.
 */
export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseHistoryFilters(await searchParams);

  const supabase = await createClient();
  const cycles = await listCycles(supabase);
  const cycle = cycles.find((candidate) => candidate.id === filters.cycleId) ?? null;

  const page = await listTimeline(supabase, {
    type: filters.type,
    range: resolveRange(filters, cycle),
    before: filters.before,
  });
  const subjects = await resolveSubjects(supabase, page.entries);
  const entries = page.entries.map((entry) => {
    return describeEntry(entry, subjects);
  });

  const filtered =
    filters.type !== null || filters.from !== null || filters.to !== null || cycle !== null;
  const firstPage = filters.before === null;
  const pendingQuery =
    dependsOnTimeZone(filters) && !filters.hasTimeZone
      ? historyQuery(filters, filters.before).toString()
      : null;

  return (
    <>
      <PageHeader title={ptBR.pages.history.title} description={ptBR.pages.history.description} />
      <HistoryTabs current="timeline" />

      <p className="max-w-prose text-sm text-muted-foreground">{copy.intro}</p>

      <TimelineFilters
        filters={filters}
        cycles={cycles}
        filtered={filtered}
        pendingQuery={pendingQuery}
      />

      {entries.length === 0 && firstPage && !filtered ? (
        <EmptyState title={copy.none} body={copy.noneBody} />
      ) : null}
      {entries.length === 0 && (filtered || !firstPage) ? (
        <EmptyState title={copy.noMatch} />
      ) : null}

      {entries.length !== 0 ? <Timeline entries={entries} /> : null}

      {page.next !== null || !firstPage ? (
        <nav aria-label={copy.pagination} className="flex flex-wrap justify-between gap-3">
          {firstPage ? (
            <span />
          ) : (
            <Link href={historyHref(filters)} className={pageLinkClass}>
              {copy.newest}
            </Link>
          )}
          {page.next !== null ? (
            <Link href={historyHref(filters, page.next)} className={pageLinkClass}>
              {copy.older}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
