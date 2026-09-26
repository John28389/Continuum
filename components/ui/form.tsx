import { cn } from "@/lib/utils";

/**
 * Small form primitives.
 *
 * Deliberately not a component library. These wrap native elements so that
 * every form in the application shares one focus ring, one border treatment and
 * one label association, without adding a dependency for four elements.
 */

// focus-within as well as focus-visible: a date input keeps focus in its inner
// day, month and year fields, so the input itself never matches :focus-visible
// and would otherwise show no focus at all.
export const controlClass =
  "w-full rounded-[--radius-base] border border-border-strong bg-surface-raised px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-within:ring-2 focus-within:ring-ring disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "danger" }) {
  return (
    <button
      {...props}
      className={cn(
        "rounded-[--radius-base] px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
        variant === "primary" && "bg-mission text-mission-foreground",
        variant === "quiet" && "border border-border-strong hover:bg-muted",
        variant === "danger" && "text-danger hover:bg-danger/10",
        className,
      )}
    />
  );
}

/**
 * A refused write, explained.
 *
 * `role="alert"` so it is announced: a rule that blocks an action silently is
 * indistinguishable from a broken button.
 */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p role="alert" className="max-w-prose text-sm text-danger">
      {message}
    </p>
  );
}
