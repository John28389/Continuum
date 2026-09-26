/**
 * Auth input schemas.
 *
 * Server-side validation. The form may mirror these for a faster message, but
 * the action re-validates: a browser check is a convenience, never a control.
 */
import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().min(1, "required").email("invalid"),
  // Length only. Composition rules belong to whoever set the password, and a
  // sign-in form is the wrong place to relitigate them.
  password: z.string().min(1, "required"),
  next: z.string().optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Where to send someone after signing in.
 *
 * Only same-origin relative paths are honoured. An absolute URL here would make
 * the login form an open redirect: a crafted link could bounce the user to an
 * attacker's page carrying the trust of having just authenticated.
 */
export function safeRedirectPath(next: string | undefined | null, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("://")) return fallback;
  return next;
}
