import Link from "next/link";

import { ptBR } from "@/lib/i18n/pt-BR";
import { REVIEW_REASON_CATEGORIES, type IntegrityRecord } from "@/lib/rules/integrity";

const copy = ptBR.integrity;

const linkClass =
  "self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function Count({ id, label, value }: { id: string; label: string; value: number }) {
  return (
    <div
      data-testid="integrity-count"
      data-key={id}
      className="flex flex-col gap-1 rounded-[--radius-base] border border-border p-4"
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-mono text-2xl">{value}</dd>
    </div>
  );
}

function Categories({ record }: { record: IntegrityRecord }) {
  const given = REVIEW_REASON_CATEGORIES.filter((category) => {
    return record.reviewsByCategory[category] > 0;
  });

  if (given.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.noReviews}</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {given.map((category) => (
        <li
          key={category}
          data-testid="integrity-category"
          data-key={category}
          className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
        >
          <span>{ptBR.reviewCategory[category]}</span>
          <span className="font-mono">{record.reviewsByCategory[category]}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Mission Integrity, as counts and history.
 *
 * No score, level, streak or badge, and no ratio either: "one of three"
 * becomes a percentage in the reader's head and then a thing to raise. Every
 * figure links to the part of the timeline it came from, so each one can be
 * checked against what actually happened.
 */
export function IntegrityView({ record }: { record: IntegrityRecord }) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="integrity-missions" className="flex flex-col gap-3">
        <h2 id="integrity-missions" className="text-sm font-medium">
          {copy.missions}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Count id="completed" label={copy.completed} value={record.missionsCompleted} />
          <Count id="revised" label={copy.revised} value={record.missionsRevised} />
          <Count id="abandoned" label={copy.abandoned} value={record.missionsAbandoned} />
        </dl>
      </section>

      <section aria-labelledby="integrity-reviews" className="flex flex-col gap-3">
        <h2 id="integrity-reviews" className="text-sm font-medium">
          {copy.reviews}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Count id="reviews-kept" label={copy.reviewsKept} value={record.reviewsKept} />
        </dl>
        <h3 className="text-sm text-muted-foreground">{copy.byCategory}</h3>
        <Categories record={record} />
        <Link href="/history?type=mission" className={linkClass}>
          {copy.viewMissions}
        </Link>
      </section>

      <section aria-labelledby="integrity-rules" className="flex flex-col gap-3">
        <h2 id="integrity-rules" className="text-sm font-medium">
          {copy.rules}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Count id="blocked" label={copy.blocked} value={record.impulseAttemptsBlocked} />
        </dl>
        <p className="max-w-prose text-xs text-muted-foreground">{copy.blockedHint}</p>
        <Link href="/history?type=rule" className={linkClass}>
          {copy.viewRules}
        </Link>
      </section>
    </div>
  );
}
