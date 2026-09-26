"use client";

import { ptBR } from "@/lib/i18n/pt-BR";

/**
 * Says what happened and that nothing changed. A failed write in this
 * application is always a refused transaction, never a partial one, so
 * reassurance on that point is accurate rather than soothing.
 */
export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{ptBR.common.errorTitle}</h1>
        <p className="text-sm text-muted-foreground">{ptBR.common.errorBody}</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-[--radius-base] border border-border-strong px-4 py-2 text-sm transition-colors hover:bg-muted"
      >
        {ptBR.common.retry}
      </button>
    </div>
  );
}
