import { ptBR } from "@/lib/i18n/pt-BR";
import type { RuleSeverity } from "@/lib/rules/registry";
import { cn } from "@/lib/utils";

/**
 * Severity, stated quietly.
 *
 * Deliberately not colour-coded like an alert. Severity says how much a rule
 * matters to the product, not how alarmed the reader should be, and a page of
 * red badges would read as a list of threats rather than a list of promises.
 */
const STYLES: Record<RuleSeverity, string> = {
  critical: "font-medium text-foreground",
  high: "text-foreground",
  medium: "text-muted-foreground",
  low: "text-muted-foreground",
};

export function SeverityBadge({ severity }: { severity: RuleSeverity }) {
  return (
    <span
      data-testid="severity-badge"
      className={cn("font-mono text-[0.6875rem] tracking-wide uppercase", STYLES[severity])}
    >
      {ptBR.rulesPage.severity}
      {": "}
      {ptBR.severity[severity]}
    </span>
  );
}
