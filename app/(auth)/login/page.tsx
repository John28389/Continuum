import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import { ptBR } from "@/lib/i18n/pt-BR";

export const metadata: Metadata = { title: ptBR.auth.signIn };

export default async function LoginPage({
  searchParams,
}: {
  // Search params are async in this version of Next.
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {ptBR.auth.title}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{ptBR.auth.subtitle}</h1>
      </header>

      <LoginForm next={next} />
    </main>
  );
}
