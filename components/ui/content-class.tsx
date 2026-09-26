import { cn } from "@/lib/utils";
import { ptBR } from "@/lib/i18n/pt-BR";

/**
 * The four content classes.
 *
 * A mission, a maintenance task, a curiosity and leisure must never read as
 * equally urgent — that flattening is the failure this product exists to
 * prevent. Encoding them as one component with reserved colours means a future
 * screen cannot accidentally give a parked idea the same weight as the thing
 * actually being worked on.
 *
 * These colours are for content. Navigation and chrome stay neutral, so that
 * mission-level emphasis means something when it appears.
 */
export type ContentClass = keyof typeof ptBR.contentClass;

const STYLES: Record<ContentClass, string> = {
  mission: "bg-mission-subtle text-mission border-mission/30",
  maintenance: "bg-maintenance-subtle text-maintenance border-maintenance/30",
  curiosity: "bg-curiosity-subtle text-curiosity border-curiosity/30",
  leisure: "bg-leisure-subtle text-leisure border-leisure/30",
};

export function ContentClassBadge({ kind, className }: { kind: ContentClass; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] tracking-wide uppercase",
        STYLES[kind],
        className,
      )}
    >
      {ptBR.contentClass[kind]}
    </span>
  );
}
