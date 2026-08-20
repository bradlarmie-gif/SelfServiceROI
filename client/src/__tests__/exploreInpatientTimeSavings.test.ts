import { describe, it, expect } from "vitest";
import {
  deriveInpatientMinutesPerAdmission,
  DEFAULT_EXPLORE_STATE,
  type ExploreState,
} from "@/pages/explore/exploreState";

/**
 * Inpatient time savings is modeled per note type (H&P once per admission + a
 * progress note each day after admission, so it scales with ALOS, + optional
 * consults) and blended to a single minutes-per-admission figure. That blended
 * figure IS minutesSavedPerEncounter for inpatient, so the whole downstream value
 * engine keeps reading one canonical field. These tests guard:
 *   (a) the derivation math + the locked quick-fill numbers,
 *   (b) the discharge summary is NEVER counted (Abridge does not write it yet),
 *   (c) footing: the per-note-type hours shown on screen sum to the hours implied
 *       by the blended figure (display can't disagree with the dollar).
 */

const PRESETS = {
  conservative: { hp: 8, prog: 2 },
  typical: { hp: 12, prog: 3 },
  aggressive: { hp: 16, prog: 5 },
} as const;

function ip(overrides: Partial<ExploreState>): ExploreState {
  return { ...DEFAULT_EXPLORE_STATE, careSetting: "inpatient", ...overrides };
}

describe("inpatient minutes-per-admission derivation", () => {
  it("blends H&P once + progress per day after admission (ALOS - 1)", () => {
    // typical: 12 (H&P) + 3 x (4.5 - 1 = 3.5 days) = 12 + 10.5 = 22.5
    const min = deriveInpatientMinutesPerAdmission(
      ip({ inpatientHpMinutes: 12, inpatientProgressMinutes: 3, inpatientAlos: 4.5 }),
    );
    expect(min).toBeCloseTo(22.5, 5);
  });

  it("matches the locked quick-fill numbers at a 4.5-day stay", () => {
    const alos = 4.5;
    const progressDays = alos - 1; // 3.5
    for (const p of Object.values(PRESETS)) {
      const min = deriveInpatientMinutesPerAdmission(
        ip({ inpatientHpMinutes: p.hp, inpatientProgressMinutes: p.prog, inpatientAlos: alos }),
      );
      expect(min).toBeCloseTo(p.hp + p.prog * progressDays, 5);
    }
    // Explicit expected values so a silent preset change is caught.
    expect(deriveInpatientMinutesPerAdmission(ip({ inpatientHpMinutes: 8, inpatientProgressMinutes: 2, inpatientAlos: 4.5 }))).toBeCloseTo(15, 5);
    expect(deriveInpatientMinutesPerAdmission(ip({ inpatientHpMinutes: 12, inpatientProgressMinutes: 3, inpatientAlos: 4.5 }))).toBeCloseTo(22.5, 5);
    expect(deriveInpatientMinutesPerAdmission(ip({ inpatientHpMinutes: 16, inpatientProgressMinutes: 5, inpatientAlos: 4.5 }))).toBeCloseTo(33.5, 5);
  });

  it("adds consults only when enabled", () => {
    const base = { inpatientHpMinutes: 12, inpatientProgressMinutes: 3, inpatientConsultMinutes: 3, inpatientAlos: 4.5 };
    const off = deriveInpatientMinutesPerAdmission(ip({ ...base, inpatientConsultsEnabled: false }));
    const on = deriveInpatientMinutesPerAdmission(ip({ ...base, inpatientConsultsEnabled: true }));
    expect(off).toBeCloseTo(22.5, 5);
    expect(on).toBeCloseTo(25.5, 5);
  });

  it("never counts the discharge summary (it is not one of the blended inputs)", () => {
    // There is no discharge-summary field; the blend is fully explained by the
    // three modeled note types. A one-day stay (progressDays = 0) with no consults
    // is exactly the H&P, nothing more.
    const min = deriveInpatientMinutesPerAdmission(
      ip({ inpatientHpMinutes: 12, inpatientProgressMinutes: 3, inpatientAlos: 1 }),
    );
    expect(min).toBeCloseTo(12, 5);
  });

  it("clamps progress-note days at zero for degenerate ALOS", () => {
    const min = deriveInpatientMinutesPerAdmission(
      ip({ inpatientHpMinutes: 12, inpatientProgressMinutes: 3, inpatientAlos: 0 }),
    );
    expect(min).toBeCloseTo(12, 5);
  });

  it("foots: the per-note-type hours shown on screen sum to the blended-figure hours", () => {
    // Mirror the EdTimeSavings display math against the engine's single-field math.
    const state = ip({
      inpatientHpMinutes: 12,
      inpatientProgressMinutes: 3,
      inpatientConsultsEnabled: true,
      inpatientConsultMinutes: 3,
      inpatientAlos: 4.5,
      annualEncounters: 12000,
      utilizationPercent: 100,
    });
    const eligible = Math.round(state.annualEncounters * (state.utilizationPercent / 100));
    const blended = deriveInpatientMinutesPerAdmission(state);

    // Display parts (what the customer reads in "how it adds up")
    const progressDays = Math.max(0, state.inpatientAlos - 1);
    const hpHours = Math.round((eligible * state.inpatientHpMinutes) / 60);
    const progHours = Math.round((eligible * state.inpatientProgressMinutes * progressDays) / 60);
    const consultHours = Math.round((eligible * state.inpatientConsultMinutes) / 60);
    const partsTotal = hpHours + progHours + consultHours;

    // Engine single-field math (what the dollars flow from)
    const engineHours = Math.round((blended * eligible) / 60);

    // Same number to the customer's eye (independent rounding tolerance of a few hrs).
    expect(Math.abs(partsTotal - engineHours)).toBeLessThanOrEqual(3);
  });
});
