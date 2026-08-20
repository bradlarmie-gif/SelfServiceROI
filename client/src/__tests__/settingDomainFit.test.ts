import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { SETTING_META, type SettingKey } from "@/pages/forecast/roiEngine";

/**
 * DOMAIN-FIT guard.
 *
 * One screen renders all four care settings, so a noun hardcoded for the
 * setting the author had in mind reads wrong for the other three: a nursing
 * reader is told "how big is your practice", an inpatient reader is asked
 * about "visits". This is the same class of bug as "Provider Retention"
 * appearing on a nursing screen, and it survives every math and copy check.
 *
 * The fix is to derive the noun from SETTING_META, so this guard has two
 * halves: the metadata must actually distinguish the settings, and the screen
 * must not hardcode a noun that the metadata owns.
 */
const SRC = join(__dirname, "..");
const CALC = "pages/forecast/QuickRoiCalculator.tsx";

const KEYS: SettingKey[] = ["outpatient", "ed", "inpatient", "nursing"];

describe("care-setting metadata carries its own vocabulary", () => {
  it("every setting defines the nouns the screens read from", () => {
    for (const k of KEYS) {
      const m = SETTING_META[k];
      for (const field of ["label", "blurb", "providerWord", "orgWord", "encWord", "visitWord"] as const) {
        expect(m[field], `${k}.${field} is missing`).toBeTruthy();
      }
    }
  });

  it("nursing is not described as a physician practice", () => {
    expect(SETTING_META.nursing.orgWord).not.toBe("practice");
    expect(SETTING_META.nursing.providerWord).toBe("nurses");
    // nursing counts care events, never office visits
    expect(SETTING_META.nursing.encWord).not.toMatch(/^visits$/);
  });

  it("outpatient is described in visits, not hospital encounters", () => {
    expect(SETTING_META.outpatient.encWord).toBe("visits");
    expect(SETTING_META.outpatient.orgWord).toBe("practice");
  });
});

describe("the calculator screen does not hardcode a setting's nouns", () => {
  const src = readFileSync(join(SRC, CALC), "utf8");
  // strip comments so prose about the design does not trip the scan
  const code = src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");

  // Literals that belong to exactly one setting. Each must come from
  // SETTING_META instead, or it will be wrong for the other three.
  const BANNED: { text: string; why: string }[] = [
    { text: "your practice", why: "nursing reads 'unit', ED and inpatient read 'group' (use meta.orgWord)" },
    { text: "Practice name", why: "the label is derived from meta.orgWord" },
    { text: "Abridge encounters", why: "outpatient counts visits, nursing counts care events (use meta.encWord)" },
    { text: "more of their visits", why: "not every setting counts visits (use meta.encWord)" },
  ];

  for (const { text, why } of BANNED) {
    it(`does not hardcode "${text}"`, () => {
      const lines = code.split("\n")
        .map((l, i) => ({ n: i + 1, l }))
        .filter(({ l }) => l.includes(text));
      expect(lines.map((x) => `${CALC}:${x.n} ${x.l.trim().slice(0, 100)}`), why).toEqual([]);
    });
  }
});
