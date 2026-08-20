import { describe, it, expect } from "vitest";
import {
  calcHapi,
  calcFalls,
  calcCauti,
  calcClabsi,
  calcSepsis,
} from "@/lib/nursingQualityCalcs";
import {
  computeAllDriverValues,
  computeAllDriverCalcSummaries,
} from "@/lib/exploreDriverCalcs";
import {
  DEFAULT_EXPLORE_STATE,
  type ExploreState,
} from "@/pages/explore/exploreState";

/**
 * Reconciliation guardrail for the Mercy Nursing Value Assessment PDF.
 *
 * The PDF prints a per-driver "math text" of the form:
 *
 *   <events> × <prevention%> × <cost>/event   →   $value
 *
 * The on-page `value` is computed by the engine in ExploreModel.tsx via the
 * shared helpers in @/lib/nursingQualityCalcs. These tests assert that for
 * every quantified nursing-quality driver, the multiplicands the PDF prints
 * actually multiply out to the engine `value`.
 *
 * If the engine adds a new field (e.g. a per-driver realization haircut, a
 * sub-population adjustment, or a separate "preventable share" multiplier),
 * the helper output will diverge from the printed multiplicands and these
 * tests will fail — forcing the PDF text and NursingPDFInput shape to be
 * brought back in lockstep.
 */

const CLOSE = 5; // currency tolerance ($) for floating-point round-trip

describe("Nursing PDF reconciliation — engine math vs. printed formula", () => {
  // Representative Mercy-style inpatient unit: 350 staffed beds × 82% occupancy
  const patientDays = 350 * (82 / 100) * 365; // ≈ 104,755

  it("HAPI: printed multiplicands reconcile to engine value", () => {
    const inputs = { patientDays, rate: 2.5, preventionPct: 6.5, cost: 25_000 };
    const r = calcHapi(inputs);

    // Printed PDF formula: events × preventionPct% × cost
    const printed = r.events * (inputs.preventionPct / 100) * inputs.cost;

    expect(r.value).toBeCloseTo(printed, 2);
    expect(r.events).toBeCloseTo((patientDays / 1000) * inputs.rate, 5);
  });

  it("Falls: printed multiplicands reconcile to engine value", () => {
    const inputs = { patientDays, rate: 3.5, preventionPct: 10, cost: 6_500 };
    const r = calcFalls(inputs);

    const printed = r.events * (inputs.preventionPct / 100) * inputs.cost;

    expect(r.value).toBeCloseTo(printed, 2);
  });

  it("CAUTI: cath-days × rate × prevention × cost reconciles to engine value", () => {
    const inputs = {
      patientDays,
      utilizationPct: 30,
      rate: 1.8,
      preventionPct: 12,
      cost: 13_000,
    };
    const r = calcCauti(inputs);

    expect(r.catheterDays).toBeCloseTo(patientDays * (inputs.utilizationPct / 100), 5);
    expect(r.events).toBeCloseTo((r.catheterDays / 1000) * inputs.rate, 5);

    const printed = r.events * (inputs.preventionPct / 100) * inputs.cost;
    expect(r.value).toBeCloseTo(printed, 2);
  });

  it("CLABSI: line-days × rate × prevention × cost reconciles to engine value", () => {
    const inputs = {
      patientDays,
      utilizationPct: 20,
      rate: 0.8,
      preventionPct: 8,
      cost: 20_000,
    };
    const r = calcClabsi(inputs);

    expect(r.lineDays).toBeCloseTo(patientDays * (inputs.utilizationPct / 100), 5);
    expect(r.events).toBeCloseTo((r.lineDays / 1000) * inputs.rate, 5);

    const printed = r.events * (inputs.preventionPct / 100) * inputs.cost;
    expect(r.value).toBeCloseTo(printed, 2);
  });

  it("Sepsis: cases × non-comp × doc-lag × cost × realization reconciles to engine value", () => {
    const inputs = {
      patientDays,
      ratePerThousand: 2.0,
      currentCompliancePct: 75,
      docLagPct: 30,
      excessCostPerCase: 3_500,
      realizationPct: 60,
    };
    const r = calcSepsis(inputs);

    expect(r.complianceGapPct).toBe(25);
    expect(r.events).toBeCloseTo((patientDays / 1000) * inputs.ratePerThousand, 5);
    expect(r.nonCompliant).toBeCloseTo(r.events * 0.25, 5);
    expect(r.docLagCases).toBeCloseTo(r.nonCompliant * 0.3, 5);

    // Printed PDF formula:
    //   sepsisCases × complianceGapPct% × docLagPct% × cost/case × realization%
    const printed =
      r.events *
      (r.complianceGapPct / 100) *
      (inputs.docLagPct / 100) *
      inputs.excessCostPerCase *
      (inputs.realizationPct / 100);

    expect(r.value).toBeCloseTo(printed, 2);
  });

  it("Sepsis: clamps non-compliance to 0 when current compliance ≥ 100%", () => {
    const r = calcSepsis({
      patientDays,
      ratePerThousand: 2.0,
      currentCompliancePct: 105,
      docLagPct: 30,
      excessCostPerCase: 3_500,
      realizationPct: 60,
    });
    expect(r.complianceGapPct).toBe(0);
    expect(r.value).toBe(0);
  });

  // Parse multiplicands left-to-right (mirrors how a reader scans the
  // formula). Each "×"-separated token contributes its first numeric
  // value, with "$X" treated as a dollar amount and "X%" as X/100.
  const productOfPrintedFormula = (summary: string): number => {
    const tokens = summary.split("×").map((t) => t.trim());
    let printed = 1;
    for (const token of tokens) {
      const dollarMatch = token.match(/\$([\d,]+(?:\.\d+)?)/);
      const percentMatch = token.match(/(-?[\d,]+(?:\.\d+)?)\s*%/);
      const bareMatch = token.match(/(-?[\d,]+(?:\.\d+)?)/);
      let factor: number;
      if (dollarMatch) {
        factor = Number(dollarMatch[1].replace(/,/g, ""));
      } else if (percentMatch) {
        factor = Number(percentMatch[1].replace(/,/g, "")) / 100;
      } else if (bareMatch) {
        factor = Number(bareMatch[1].replace(/,/g, ""));
      } else {
        throw new Error(`could not parse multiplicand from token "${token}"`);
      }
      printed *= factor;
    }
    return printed;
  };

  it("nursingAgency: printed multiplicands reconcile to engine value (low retained nurses)", () => {
    // Construct a deliberately small "retained nurses" scenario so the
    // sub-total rounds aggressively (e.g. 0.16 → "0.2") under the old
    // `${fmtNd(retained)} retained × ...` formatter. The full-factor
    // breakdown should still reconcile within tolerance to the engine
    // value, which is computed from the unrounded retained × wks × premium
    // product in `computeAllDriverValues`.
    const state: ExploreState = {
      ...DEFAULT_EXPLORE_STATE,
      careSetting: "nursing",
      retentionMode: "counted",
      numberOfProviders: 4,
      timeDriverInputs: {
        ...DEFAULT_EXPLORE_STATE.timeDriverInputs,
        nursingRetentionEnabled: true,
        nursingTurnoverRate: 10,
        retentionImpactScenario: "typical", // 15% nursing impact
        nursingReplacementCost: 60_000,
        nursingAgencyEnabled: true,
        nursingAgencyWeeksPerVacancy: 12,
        nursingAgencyWeeklyPremium: 2_500,
      },
    };

    const values = computeAllDriverValues(state, 0);
    const summaries = computeAllDriverCalcSummaries(state, 0);

    const summary = summaries.nursingAgency ?? "";
    expect(summary).not.toMatch(/retained\b/);

    const printed = productOfPrintedFormula(summary);
    const engineValue = values.nursingAgency ?? 0;
    const tol = Math.max(5, Math.abs(engineValue) * 0.005);
    expect(Math.abs(printed - engineValue)).toBeLessThanOrEqual(tol);
  });

  it("nursingRetention: printed multiplicands reconcile to engine value", () => {
    // Same low-headcount scenario as the nursingAgency case so that any
    // future "retained nurses" rounding regression in the printed formula
    // (e.g. 0.16 → "0.2") would inflate the printed product noticeably
    // versus the engine's unrounded retained × replacement product.
    const state: ExploreState = {
      ...DEFAULT_EXPLORE_STATE,
      careSetting: "nursing",
      retentionMode: "counted",
      numberOfProviders: 4,
      timeDriverInputs: {
        ...DEFAULT_EXPLORE_STATE.timeDriverInputs,
        nursingRetentionEnabled: true,
        nursingTurnoverRate: 10,
        retentionImpactScenario: "typical", // 15% nursing impact
        nursingReplacementCost: 60_000,
      },
    };

    const values = computeAllDriverValues(state, 0);
    const summaries = computeAllDriverCalcSummaries(state, 0);

    const summary = summaries.nursingRetention ?? "";
    expect(summary).not.toMatch(/retained\b/);

    const printed = productOfPrintedFormula(summary);
    const engineValue = values.nursingRetention ?? 0;
    const tol = Math.max(5, Math.abs(engineValue) * 0.005);
    expect(Math.abs(printed - engineValue)).toBeLessThanOrEqual(tol);
  });

  it("nursingOvertime: printed multiplicands reconcile to engine value", () => {
    // A representative inpatient-nursing OT scenario. Uses a fractional
    // OT-hours-per-nurse-week input (1.5) to ensure the printed token
    // preserves the decimal — any silent integer rounding would diverge
    // from the engine product by 33%.
    const state: ExploreState = {
      ...DEFAULT_EXPLORE_STATE,
      careSetting: "nursing",
      retentionMode: "counted",
      numberOfProviders: 120,
      timeDriverInputs: {
        ...DEFAULT_EXPLORE_STATE.timeDriverInputs,
        nursingOtEnabled: true,
        nursingOtHoursPerNurseWeek: 1.5,
        nursingOtReductionPercent: 40,
        nursingOtHourlyRate: 75,
      },
    };

    const values = computeAllDriverValues(state, 0);
    const summaries = computeAllDriverCalcSummaries(state, 0);

    const summary = summaries.nursingOvertime ?? "";
    const printed = productOfPrintedFormula(summary);
    const engineValue = values.nursingOvertime ?? 0;
    const tol = Math.max(5, Math.abs(engineValue) * 0.005);
    expect(Math.abs(printed - engineValue)).toBeLessThanOrEqual(tol);
  });

  it("End-to-end: rounding the helper value matches the engine's Math.round(value)", () => {
    // Mirrors how ExploreModel.tsx writes allDriverValues.nursingHapi.
    const r = calcHapi({ patientDays, rate: 2.5, preventionPct: 6.5, cost: 25_000 });
    const enginePersisted = Math.round(r.value);
    // Re-derive from the same input fields the PDF carries:
    const printedAndRounded = Math.round(
      ((patientDays / 1000) * 2.5) * (6.5 / 100) * 25_000,
    );
    expect(Math.abs(enginePersisted - printedAndRounded)).toBeLessThanOrEqual(CLOSE);
  });
});
