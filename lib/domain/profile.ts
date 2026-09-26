import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

/**
 * Ensures the signed-in user has a profile row.
 *
 * Run as the user, through an ordinary insert that row level security checks,
 * rather than by the usual SECURITY DEFINER trigger on auth.users. That keeps
 * the schema's count of privileged functions at zero, which is what lets the
 * migration guard treat "no SECURITY DEFINER" as a bright line instead of a
 * list of blessed exceptions.
 *
 * ON CONFLICT DO NOTHING, so it is a single idempotent statement rather than a
 * read followed by a conditional write, which would race with itself across
 * concurrent requests.
 */
export async function ensureProfile(supabase: SupabaseClient<Database>, user: User): Promise<void> {
  await supabase
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
}
