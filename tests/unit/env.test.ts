import { describe, expect, it } from "vitest";

import { readPublicEnv } from "@/lib/env";

const URL = "http://127.0.0.1:54321";

describe("public environment", () => {
  it("accepts the current publishable key name", () => {
    const env = readPublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    });

    expect(env.supabaseUrl).toBe(URL);
    expect(env.supabasePublishableKey).toBe("sb_publishable_example");
  });

  it("accepts the legacy anon key name", () => {
    // Which name a Supabase dashboard shows depends on when the project was
    // created, so both have to work.
    const env = readPublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-jwt-key",
    });

    expect(env.supabasePublishableKey).toBe("legacy-jwt-key");
  });

  it("prefers the publishable key when both are present", () => {
    const env = readPublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "new",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "old",
    });

    expect(env.supabasePublishableKey).toBe("new");
  });

  it("fails loudly when the key is missing, naming what to do", () => {
    // A missing key otherwise surfaces much later as an opaque 401, which is a
    // miserable way to find out a file was never copied.
    expect(() => readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL })).toThrowError(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
    expect(() => readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL })).toThrowError(/\.env\.local/);
  });

  it("rejects a URL that is not a URL", () => {
    expect(() =>
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k",
      }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects an empty environment", () => {
    expect(() => readPublicEnv({})).toThrowError(/Invalid environment configuration/);
  });
});
