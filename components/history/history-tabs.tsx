import Link from "next/link";

import { ptBR } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "timeline", href: "/history" },
  { key: "cycles", href: "/history/cycles" },
  { key: "integrity", href: "/history/integrity" },
] as const;

type Tab = (typeof TABS)[number]["key"];

/** The ways into the record: everything in order, cycle by cycle, or counted. */
export function HistoryTabs({ current }: { current: Tab }) {
  return (
    <nav aria-label={ptBR.history.sections}>
      <ul className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = tab.key === current;

          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {ptBR.history.tabs[tab.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
