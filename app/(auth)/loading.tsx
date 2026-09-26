import { ptBR } from "@/lib/i18n/pt-BR";

export default function AuthLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-16">
      <p role="status" className="text-sm text-muted-foreground">
        {ptBR.common.loading}
      </p>
    </main>
  );
}
