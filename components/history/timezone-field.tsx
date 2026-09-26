"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { useHydrated } from "@/components/mission/clock";

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The reader's timezone, for a server that cannot know it.
 *
 * Two jobs. Inside the filter form it rides along as a hidden field, so a
 * submitted date range means the reader's days rather than UTC's. And when the
 * page was reached by a link that filters by date or cycle but carries no
 * timezone — "ver na linha do tempo" from a cycle — the server passes the query
 * it would have wanted, and the browser adds its timezone once, replacing the
 * URL rather than adding a history entry.
 */
export function TimezoneField({ pendingQuery }: { pendingQuery: string | null }) {
  const hydrated = useHydrated();
  const router = useRouter();

  useEffect(() => {
    if (pendingQuery === null) return;

    const query = new URLSearchParams(pendingQuery);
    query.set("tz", browserTimeZone());
    router.replace(`/history?${query.toString()}`, { scroll: false });
  }, [pendingQuery, router]);

  return <input type="hidden" name="tz" value={hydrated ? browserTimeZone() : ""} />;
}
