import Link from "next/link";

import { TimezoneField } from "./timezone-field";
import { Button, controlClass } from "@/components/ui/form";
import type { Cycle } from "@/lib/domain/cycle";
import { ptBR } from "@/lib/i18n/pt-BR";
import { HISTORY_TYPES, type HistoryFilters } from "@/lib/validation/history";

const copy = ptBR.history;

/**
 * Type, dates and cycle, as a plain GET form.
 *
 * Filtering works before hydration and the URL can be kept. Submitting starts
 * again from the newest entry, because the form carries no cursor.
 */
export function TimelineFilters({
  filters,
  cycles,
  filtered,
  pendingQuery,
}: {
  filters: HistoryFilters;
  cycles: readonly Cycle[];
  filtered: boolean;
  pendingQuery: string | null;
}) {
  return (
    <form
      method="get"
      action="/history"
      aria-label={copy.filters}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="history-type" className="text-sm font-medium">
          {copy.type}
        </label>
        <select
          id="history-type"
          name="type"
          defaultValue={filters.type ?? ""}
          className={controlClass}
        >
          <option value="">{copy.allTypes}</option>
          {HISTORY_TYPES.map((type) => (
            <option key={type} value={type}>
              {copy.types[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="history-from" className="text-sm font-medium">
          {copy.from}
        </label>
        <input
          id="history-from"
          name="from"
          type="date"
          defaultValue={filters.from ?? ""}
          className={controlClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="history-to" className="text-sm font-medium">
          {copy.to}
        </label>
        <input
          id="history-to"
          name="to"
          type="date"
          defaultValue={filters.to ?? ""}
          className={controlClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="history-cycle" className="text-sm font-medium">
          {copy.cycle}
        </label>
        <select
          id="history-cycle"
          name="cycle"
          defaultValue={filters.cycleId ?? ""}
          className={controlClass}
        >
          <option value="">{copy.allCycles}</option>
          {cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.label}
            </option>
          ))}
        </select>
      </div>

      <TimezoneField pendingQuery={pendingQuery} />

      <Button type="submit" variant="quiet">
        {copy.apply}
      </Button>

      {filtered ? (
        <Link
          href="/history"
          className="py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {copy.clear}
        </Link>
      ) : null}
    </form>
  );
}
