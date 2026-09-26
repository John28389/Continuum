/**
 * Next.js 16 renamed the `middleware` convention to `proxy`, including the
 * exported function name. The runtime is Node.js and is not configurable.
 */
import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Without a matcher the proxy runs on every request, including static assets
   * and image optimisation. That would mean an auth round-trip per CSS file,
   * and a redirect rule capable of blocking the stylesheet for the very page it
   * redirects to.
   *
   * The exclusion covers the whole of `_next`, not just `_next/static` and
   * `_next/image`. Framework internals live under that prefix too — the
   * development HMR socket among them — and running an auth redirect across
   * them stops client React hydrating, with no console error to explain it.
   */
  matcher: ["/((?!_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
