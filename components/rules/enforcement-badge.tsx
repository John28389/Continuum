import { ptBR } from "@/lib/i18n/pt-BR";
import type { RuleEnforcement } from "@/lib/rules/registry";
import { cn } from "@/lib/utils";

/**
 * Three enforcement levels, three unmistakable looks.
 *
 * HARD is solid, because the database refuses and nothing gets past it. SOFT is
 * outlined in the warning colour: permitted, but it will ask. ADVISORY is dashed
 * and quiet — the same visual language as the advisory note on a mission — so
 * that a suggestion never reads with the weight of a guarantee.
 */
const STYLES: Record<RuleEnforcement, string> = {
  HARD: "border-foreground bg-foreground text-background",
  SOFT: "border-warning text-warning",
  ADVISORY: "border-dashed border-border-strong text-muted-foreground",
};

export function EnforcementBadge({ enforcement }: { enforcement: RuleEnforcement }) {
  return (
    <span
      data-testid="enforcement-badge"
      data-enforcement={enforcement}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] tracking-wide uppercase",
        STYLES[enforcement],
      )}
    >
      {ptBR.enforcement[enforcement]}
    </span>
  );
}
