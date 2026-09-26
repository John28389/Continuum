import type { Metadata } from "next";

import { RuleCard } from "@/components/rules/rule-card";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listRecentRuleEvents, listRules } from "@/lib/domain/rules";
import { ptBR } from "@/lib/i18n/pt-BR";
import { groupByEnforcement, rulesToDisplay } from "@/lib/rules/rule-display";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.pages.rules.title };

const copy = ptBR.rulesPage;

/**
 * What the system guarantees, and why.
 *
 * Read from the `rules` table, so the page can only describe protections the
 * database actually holds: a rule missing from the table, or marked inactive,
 * is not shown as if it were enforced. Grouped by what a rule does when it
 * applies — blocks, asks, or advises — because that is the difference the
 * reader most needs to see.
 */
export default async function RulesPage() {
  const supabase = await createClient();
  const [rows, events] = await Promise.all([listRules(supabase), listRecentRuleEvents(supabase)]);
  const sections = groupByEnforcement(rulesToDisplay(rows, events));

  return (
    <>
      <PageHeader title={ptBR.pages.rules.title} description={ptBR.pages.rules.description} />

      <p className="max-w-prose text-sm text-muted-foreground">{copy.intro}</p>

      {sections.length === 0 ? <EmptyState title={copy.none} body={copy.noneBody} /> : null}

      {sections.map((section) => (
        <section
          key={section.enforcement}
          aria-labelledby={`rules-${section.enforcement}`}
          className="flex flex-col gap-3"
        >
          <h2 id={`rules-${section.enforcement}`} className="text-sm font-medium">
            {copy.sections[section.enforcement]}
          </h2>
          <div className="flex flex-col gap-3">
            {section.rules.map((rule) => (
              <RuleCard key={rule.code} rule={rule} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
