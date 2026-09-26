import { redirect } from "next/navigation";

import { GlobalCapture } from "@/components/curiosity/global-capture";
import { AppNav } from "@/components/shell/app-nav";
import { ensureProfile } from "@/lib/domain/profile";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";

/**
 * Every route in this group requires a session.
 *
 * The proxy already redirects unauthenticated requests; this is the second
 * layer. If a matcher change ever stopped covering a path, the page would fail
 * closed rather than render someone else's data.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await ensureProfile(supabase, user);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#content"
        className="sr-only bg-surface-raised focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-[--radius-base] focus:px-4 focus:py-2 focus:shadow-lg focus-visible:ring-2 focus-visible:ring-ring"
      >
        {ptBR.shell.skipToContent}
      </a>

      <AppNav />

      <div className="min-w-0 flex-1">
        <main
          id="content"
          className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-8 md:px-8 md:py-12"
        >
          {children}
        </main>
      </div>

      <GlobalCapture />
    </div>
  );
}
