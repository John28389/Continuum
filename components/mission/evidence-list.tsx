import type { MissionEvidence } from "@/lib/domain/evidence";
import { ptBR } from "@/lib/i18n/pt-BR";

/**
 * Defence in depth for the one piece of user input this page makes clickable.
 * The database and the schema both refuse anything but http and https; this
 * refuses to render anything else as a link even if one somehow got through.
 */
const SAFE_URL = /^https?:\/\//i;

function descriptionsById(criteria: { id: string; description: string }[]): Map<string, string> {
  return new Map(criteria.map((criterion) => [criterion.id, criterion.description]));
}

/** What the mission produced, with the criterion each piece speaks to. */
export function EvidenceList({
  evidence,
  criteria,
}: {
  evidence: MissionEvidence[];
  criteria: { id: string; description: string }[];
}) {
  const described = descriptionsById(criteria);

  return (
    <ul data-testid="evidence-list" className="flex flex-col gap-2">
      {evidence.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-1 rounded-[--radius-base] border border-border px-4 py-3"
        >
          <p className="text-sm whitespace-pre-line">{item.description}</p>
          {item.url && SAFE_URL.test(item.url) ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm break-all underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {item.url}
            </a>
          ) : null}
          {item.criterion_id && described.has(item.criterion_id) ? (
            <p className="text-xs text-muted-foreground">
              {ptBR.mission.criterion}
              {": "}
              {described.get(item.criterion_id)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
