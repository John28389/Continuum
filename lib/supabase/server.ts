/**
 * Request-scoped server Supabase client.
 *
 * Carries the signed-in user's session, so row level security applies to every
 * query. Queries therefore do not re-implement ownership checks: the database
 * scopes results, and duplicating that in application code would create two
 * sources of truth where one of them is weaker.
 *
 * Created per request rather than shared, because the cookie store belongs to
 * the request.
 */
import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/types";
import { publicEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = publicEnv();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. The proxy refreshes the
          // session on every request, so ignoring this is safe rather than
          // merely convenient.
        }
      },
    },
  });
}

/** The signed-in user, or null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
