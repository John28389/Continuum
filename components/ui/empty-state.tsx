/**
 * The honest state for an area with nothing in it yet.
 *
 * Says so plainly rather than filling the space with skeletons or
 * encouragement. An empty parking lot is not a problem to be solved.
 */
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-[--radius-base] border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body ? <p className="mt-1 text-sm">{body}</p> : null}
    </div>
  );
}
