import { EnforcementBadge } from "./enforcement-badge";
import { RuleEvents } from "./rule-events";
import { SeverityBadge } from "./severity-badge";
import { ptBR, ruleCopy } from "@/lib/i18n/pt-BR";
import type { DisplayedRule } from "@/lib/rules/rule-display";

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/**
 * One rule, in full: what it says, why it exists, where it bends, and whether
 * it has been doing anything lately.
 *
 * The severity and level come from the database row (see rulesToDisplay); the
 * prose comes from the string map. The card never decides either.
 */
export function RuleCard({ rule }: { rule: DisplayedRule }) {
  const copy = ruleCopy(rule.code);

  return (
    <article
      data-testid="rule-card"
      data-rule={rule.code}
      className="flex flex-col gap-3 rounded-[--radius-base] border border-border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs tracking-wide text-muted-foreground">{rule.code}</span>
          <h3 className="font-medium">{copy.name}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EnforcementBadge enforcement={rule.enforcement} />
          <SeverityBadge severity={rule.severity} />
        </div>
      </div>

      <p className="max-w-prose text-sm">{copy.description}</p>

      <Detail label={ptBR.ruleBlock.why} text={copy.rationale} />
      <Detail label={ptBR.rulesPage.exceptions} text={copy.exceptions} />

      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
          {ptBR.rulesPage.recentEvents}
        </p>
        {rule.recentEvents.length > 0 ? (
          <RuleEvents events={rule.recentEvents} />
        ) : (
          <p className="text-xs text-muted-foreground">{ptBR.rulesPage.noEvents}</p>
        )}
      </div>
    </article>
  );
}
