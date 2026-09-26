import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("harness smoke", () => {
  it("runs the unit test runner", () => {
    expect(true).toBe(true);
  });

  it("resolves the @/ path alias and merges conflicting Tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
