import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Regression guard for the "can't clear the field" bug.
 *
 * A raw `<input type="number" value={n} onChange={parseFloat(e)||N}>` re-coerces
 * the empty string to a number on every keystroke, so the field can never be
 * emptied to retype. Every numeric entry the partner touches must go through
 * <NumberField> / <FormattedNumberInput> instead. `type="range"` sliders are fine.
 */
const SRC = join(__dirname, "..");

const INPUT_SURFACE = [
  "pages/forecast/QuickRoiCalculator.tsx",
];

describe("ROI Calculator never uses raw type=number inputs", () => {
  it("finds the files it claims to check (sanity)", () => {
    const missing = INPUT_SURFACE.filter((rel) => !existsSync(join(SRC, rel)));
    expect(missing, `Guard points at files that no longer exist:\n${missing.join("\n")}`).toEqual([]);
  });

  for (const rel of INPUT_SURFACE) {
    it(`${rel} has no raw <input type="number">`, () => {
      const src = readFileSync(join(SRC, rel), "utf8");
      expect(
        src.includes('type="number"'),
        `${rel} still has a raw type="number" input, route it through <NumberField> so it can be cleared`,
      ).toBe(false);
    });
  }
});
