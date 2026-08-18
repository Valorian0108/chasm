import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins conditional class names and drops falsy values", () => {
    expect(
      cn("a", false && "b", undefined, ["c", null], { d: true, e: false }),
    ).toBe("a c d");
  });

  it("keeps the last conflicting tailwind utility", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});
