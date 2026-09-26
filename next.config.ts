import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,

  /**
   * Development only. Next treats `127.0.0.1` and `localhost` as different
   * origins and blocks cross-origin requests for `_next` dev resources. The
   * end-to-end tests address the server by IP, which is more deterministic than
   * a hostname that may resolve to ::1, so without this the client bundle never
   * loads and nothing hydrates — silently, with no browser console error.
   */
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
