"use client";

import { ptBR } from "@/lib/i18n/pt-BR";

/**
 * The same honest error as inside the application, for the sign-in page.
 *
 * Without it an error here fell through to the framework's default page, in
 * English and outside the product's voice. Nothing is written before sign-in,
 * so "nothing was changed" is true here as well.
 */
export default function AuthError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-6 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{ptBR.common.errorTitle}</h1>
        <p className="text-sm text-muted-foreground">{ptBR.common.errorBody}</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="self-start rounded-[--radius-base] border border-border-strong px-4 py-2 text-sm transition-colors hover:bg-muted"
      >
        {ptBR.common.retry}
      </button>
    </main>
  );
}
