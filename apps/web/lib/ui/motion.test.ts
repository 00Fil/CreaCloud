import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { motionBootstrap, normalizeMotion } from "./motion";

describe("motion preferences", () => {
  it.each([
    [null, "system"],
    ["off", "off"],
    ["system", "system"],
    ["invalid", "system"],
  ])("normalizes %s", (value, expected) => {
    expect(normalizeMotion(value)).toBe(expected);
    const document = {
      documentElement: { dataset: {} as Record<string, string> },
    };
    runInNewContext(motionBootstrap, {
      document,
      localStorage: { getItem: () => value },
    });
    expect(document.documentElement.dataset.motion).toBe(expected);
  });
  it("does not fail when storage is blocked", () => {
    const document = {
      documentElement: { dataset: {} as Record<string, string> },
    };
    runInNewContext(motionBootstrap, {
      document,
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(document.documentElement.dataset.motion).toBe("system");
  });
});
