/**
 * Validated environment access.
 *
 * Parsed once, through Zod, so that a missing or malformed variable fails
 * immediately with a readable message. Without this, an absent key surfaces
 * much later as an opaque 401 from Supabase, which is a genuinely confusing
 * way to discover that a file was never copied.
 *
 * The public and server halves are deliberately separate. Anything reachable
 * from the browser must carry the `NEXT_PUBLIC_` prefix, and that prefix is a
 * disclosure rather than a naming convention: it means the value is compiled
 * into the bundle. Nothing sensitive may have it.
 */

import { z } from "zod";

/**
 * Supabase is migrating from the legacy JWT-shaped `anon` key to
 * `sb_publishable_…`. Both are accepted by the client libraries, and which one
 * a dashboard shows depends on when the project was created, so both variable
 * names are read and either value works.
 */
const publicSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url("must be a full URL, e.g. http://127.0.0.1:54321"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  })
  .transform((raw, ctx) => {
    const key = raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? raw.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!key) {
      ctx.addIssue({
        code: "custom",
        message:
          "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY). Copy .env.example to .env.local and fill it in.",
        path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      });
      return z.NEVER;
    }

    return { supabaseUrl: raw.NEXT_PUBLIC_SUPABASE_URL, supabasePublishableKey: key };
  });

export type PublicEnv = z.infer<typeof publicSchema>;

/**
 * Reads the public environment.
 *
 * The properties are listed literally rather than looped over because Next
 * inlines `process.env.NEXT_PUBLIC_*` at build time by static analysis; a
 * dynamic lookup would compile to undefined in the browser.
 */
export function readPublicEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): PublicEnv {
  const parsed = publicSchema.safeParse(source);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration.\n${detail}`);
  }

  return parsed.data;
}

let cached: PublicEnv | undefined;

/** Memoised public environment. */
export function publicEnv(): PublicEnv {
  cached ??= readPublicEnv();
  return cached;
}
