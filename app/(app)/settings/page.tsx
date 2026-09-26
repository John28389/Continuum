import type { Metadata } from "next";

import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { ptBR } from "@/lib/i18n/pt-BR";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ptBR.pages.settings.title };

const AREAS = [
  {
    href: "/settings/directions",
    label: ptBR.hierarchy.direction.many,
    description: ptBR.hierarchy.direction.description,
  },
  {
    href: "/settings/campaigns",
    label: ptBR.hierarchy.campaign.many,
    description: ptBR.hierarchy.campaign.description,
  },
] as const;

export default async function SettingsPage() {
  const user = await getUser();

  return (
    <>
      <PageHeader title={ptBR.pages.settings.title} description={ptBR.pages.settings.description} />

      <ul className="flex flex-col gap-3">
        {AREAS.map((area) => (
          <li key={area.href}>
            <Link
              href={area.href}
              className="flex flex-col gap-1 rounded-[--radius-base] border border-border p-4 transition-colors hover:bg-muted"
            >
              <span className="font-medium">{area.label}</span>
              <span className="text-sm text-muted-foreground">{area.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-start gap-4 border-t border-border pt-8">
        <p className="text-sm text-muted-foreground">
          {ptBR.auth.signedInAs}{" "}
          <span data-testid="user-email" className="font-mono text-foreground">
            {user?.email}
          </span>
        </p>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-[--radius-base] border border-border-strong px-4 py-2 text-sm transition-colors hover:bg-muted"
          >
            {ptBR.auth.signOut}
          </button>
        </form>
      </div>
    </>
  );
}
