/**
 * Browser Supabase client.
 *
 * Reads only. No client component writes to Supabase — writes go through server
 * actions so that validation cannot drift into the browser, where it is
 * advisory at best.
 */
import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/types";
import { publicEnv } from "@/lib/env";

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = publicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
