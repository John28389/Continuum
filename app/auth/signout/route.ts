import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * POST, not GET: a link prefetch or a stray image request must never be able to
 * sign someone out.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Local scope, not the default global one. Signing out on the desktop should
  // not also end the session on the phone — the same account is expected to be
  // open in more than one place. The default revokes every refresh token the
  // user holds anywhere.
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}
