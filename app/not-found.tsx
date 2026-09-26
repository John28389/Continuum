import Link from "next/link";

import { ptBR } from "@/lib/i18n/pt-BR";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{ptBR.common.notFoundTitle}</h1>
      <p className="text-sm text-muted-foreground">{ptBR.common.notFoundBody}</p>
      <Link href="/dashboard" className="self-start text-sm underline underline-offset-4">
        {ptBR.common.backToDashboard}
      </Link>
    </main>
  );
}
