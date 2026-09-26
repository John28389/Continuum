import { ptBR } from "@/lib/i18n/pt-BR";

export default function Loading() {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {ptBR.common.loading}
    </p>
  );
}
