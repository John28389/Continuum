import { ptBR, ruleCopy } from "@/lib/i18n/pt-BR";
import type { RuleCode } from "@/lib/rules/registry";

/**
 * A refusal, explained.
 *
 * The product's position is that a blocked action is the system doing its job,
 * so the block has to be worth reading: which rule applied, what it refused,
 * why that rule exists at all, and — supplied by the caller, because it depends
 * on the situation — what the legitimate way forward is.
 *
 * `role="alert"` so the refusal is announced. A rule that blocks silently is
 * indistinguishable from a broken button.
 *
 * Never a stack trace, never a SQLSTATE, never a reproach.
 */
export function RuleViolation({
  ruleCode,
  alternative,
}: {
  ruleCode: RuleCode;
  alternative?: React.ReactNode;
}) {
  const copy = ruleCopy(ruleCode);

  return (
    <div
      role="alert"
      data-testid="rule-violation"
      className="flex flex-col gap-4 rounded-[--radius-base] border border-warning/50 bg-warning/5 p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs tracking-wide text-warning">{ruleCode}</span>
        <p className="font-medium">{copy.name}</p>
      </div>

      <p className="max-w-prose text-sm">{copy.blocked}</p>

      <div className="flex flex-col gap-1">
        <p className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
          {ptBR.ruleBlock.why}
        </p>
        <p className="max-w-prose text-sm text-muted-foreground">{copy.rationale}</p>
      </div>

      {alternative ? (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
            {ptBR.ruleBlock.alternative}
          </p>
          {alternative}
        </div>
      ) : null}
    </div>
  );
}

/**
 * An advisory, which never blocks.
 *
 * Visually quieter than a refusal on purpose. RULE-101 asks a question about
 * prose; presenting it with the same weight as a hard rule would teach the user
 * to read every rule as noise, and would be the first step towards the advisory
 * hardening into a gate.
 */
export function RuleAdvisory({ ruleCode }: { ruleCode: RuleCode }) {
  const copy = ruleCopy(ruleCode);

  return (
    <div
      data-testid="rule-advisory"
      className="flex flex-col gap-2 rounded-[--radius-base] border border-border bg-muted/50 p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs tracking-wide text-muted-foreground">{ruleCode}</span>
        <p className="text-sm font-medium">{ptBR.ruleBlock.advisory}</p>
      </div>

      <p className="max-w-prose text-sm">{copy.blocked}</p>
      <p className="max-w-prose text-xs text-muted-foreground">{ptBR.ruleBlock.advisoryNote}</p>
    </div>
  );
}
