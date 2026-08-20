import { describe, it, expect } from "vitest";
import {
  computeAllDriverValues,
  computeAllDriverCalcSummaries,
} from "@/lib/exploreDriverCalcs";
import {
  DEFAULT_EXPLORE_STATE,
  type ExploreState,
} from "@/pages/explore/exploreState";

/**
 * Reconciliation guardrail for the OP / ED / IP narrative PDF
 * (`ExploreNarrativePDF.tsx`).
 *
 * Mirrors `nursingPdfReconciliation.test.ts` but for every quantified driver
 * in the Outpatient, ED, and Inpatient quadrants.
 *
 * Each driver renders two things derived from the same engine state:
 *
 *   - a headline `value` (computed by `computeAllDriverValues`)
 *   - a `calcSummary` formula string of the form
 *       "<A> × <B%> × <C> × $<D>/unit × <E>%"
 *     (computed by `computeAllDriverCalcSummaries`)
 *
 * The user-visible promise of the PDF is that the printed multiplicands
 * actually multiply out to the headline value. Snapshot tests can only lock
 * in the printed *strings* — not whether the math is internally consistent.
 *
 * For every quantified driver below we:
 *   1. call the engine helper to obtain `value`
 *   2. call the formatter helper to obtain `calcSummary`
 *   3. parse all numeric multiplicands out of `calcSummary`
 *   4. assert their product is within a small currency tolerance of `value`
 *
 * If a future change to the engine helper adds a new haircut or factor
 * without updating the printed formula (or vice versa), this test fails
 * with the message: "PDF formula no longer matches engine value".
 */

// Allow either $50 absolute slack or 0.5% relative slack to absorb the
// rounding-of-intermediate-multiplicands artifacts that fmtN/fmtNd/fmt$
// introduce when the formatter prints a rounded sub-total (e.g. recovered
// visits or cath-days) that the engine kept unrounded internally.
function tolerance(value: number): number {
  return Math.max(50, Math.abs(value) * 0.005);
}

/**
 * Parse the multiplicands out of a printed calcSummary string and return
 * their product.
 *
 * Token semantics:
 *   - "$1,234" or "$1,234.56" → numeric value 1234[.56]
 *   - "12.5%" → 0.125
 *   - "30,000" or "0.4" or "1.8" → the bare number
 *
 * The first numeric occurrence in each token (split by "×") is used. This
 * mirrors how readers read the formula left-to-right: "<5,000> recovered
 * visits × <18>% admit rate × $<8,000>/admit × <40>% realization".
 */
function parseFormulaProduct(calcSummary: string): number {
  const tokens = calcSummary.split("×").map((t) => t.trim());
  let product = 1;
  for (const token of tokens) {
    // Strip explanatory parentheticals like "(65% of 15,000 MA pts)" or
    // "(65%→70%)" — the multiplicand is always the leading figure, and the
    // parenthetical often contains an unrelated % that must not be matched.
    const cleaned = token.replace(/\([^)]*\)/g, " ");
    const dollarMatch = cleaned.match(/\$([\d,]+(?:\.\d+)?)/);
    const ppMatch = cleaned.match(/(-?[\d,]+(?:\.\d+)?)\s*pp\b/);
    const percentMatch = cleaned.match(/(-?[\d,]+(?:\.\d+)?)\s*%/);
    const bareMatch = cleaned.match(/(-?[\d,]+(?:\.\d+)?)/);

    let factor: number | null = null;
    if (dollarMatch) {
      factor = Number(dollarMatch[1].replace(/,/g, ""));
    } else if (ppMatch) {
      // "percentage points" (e.g. "+5pp Abridge uplift") → 0.05
      factor = Number(ppMatch[1].replace(/,/g, "")) / 100;
    } else if (percentMatch) {
      factor = Number(percentMatch[1].replace(/,/g, "")) / 100;
    } else if (bareMatch) {
      factor = Number(bareMatch[1].replace(/,/g, ""));
    }

    if (factor === null || Number.isNaN(factor)) {
      throw new Error(
        `parseFormulaProduct: could not parse multiplicand from token "${token}" in formula "${calcSummary}"`,
      );
    }
    product *= factor;
  }
  return product;
}

function assertReconciles(
  driverId: string,
  value: number | undefined,
  calcSummary: string | undefined,
) {
  if (value === undefined) {
    throw new Error(`engine produced no value for driver "${driverId}"`);
  }
  if (calcSummary === undefined) {
    throw new Error(`engine produced no calcSummary for driver "${driverId}"`);
  }
  const printed = parseFormulaProduct(calcSummary);
  const tol = tolerance(value);
  const diff = Math.abs(printed - value);
  expect(
    diff <= tol,
    `PDF formula no longer matches engine value for "${driverId}":\n` +
      `  printed formula:        ${calcSummary}\n` +
      `  printed multiplicands product: ${printed.toFixed(2)}\n` +
      `  engine value:           ${value}\n` +
      `  abs diff:               ${diff.toFixed(2)}  (tolerance ${tol.toFixed(2)})`,
  ).toBe(true);
}

// ─── Setting baselines ───────────────────────────────────────────────────

const opBase: ExploreState = {
  ...DEFAULT_EXPLORE_STATE,
  careSetting: "outpatient",
  retentionMode: "counted",
  numberOfProviders: 50,
  annualEncounters: 100_000,
  utilizationPercent: 80,
};

const edBase: ExploreState = {
  ...DEFAULT_EXPLORE_STATE,
  careSetting: "ed",
  retentionMode: "counted",
  numberOfProviders: 30,
  annualEncounters: 60_000,
  utilizationPercent: 100,
};

const ipBase: ExploreState = {
  ...DEFAULT_EXPLORE_STATE,
  careSetting: "inpatient",
  retentionMode: "counted",
  numberOfProviders: 25,
  annualEncounters: 12_000,
  utilizationPercent: 100,
};

const TOTAL_HOURS_SAVED = 50 * 4 * 48; // 4 hrs / provider / wk × 48 wks

// ─── Tests ──────────────────────────────────────────────────────────────

describe("Explore OP/ED/IP PDF reconciliation — engine math vs. printed formula", () => {
  // ── Outpatient ───────────────────────────────────────────────────────
  describe("Outpatient quadrants", () => {
    it("Capacity / patientAccess: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...opBase,
        timeDriverInputs: {
          ...opBase.timeDriverInputs,
          patientAccessEnabled: true,
          accessProviders: 50,
          capacityRealizationPercent: 25,
          visitDuration: 30,
          revenuePerVisit: 200,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles("patientAccess", values.patientAccess, summaries.patientAccess);
    });

    it("Workforce / providerWellbeing: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...opBase,
        timeDriverInputs: {
          ...opBase.timeDriverInputs,
          wellbeingEnabled: true,
          calculateRetentionValue: true,
          annualTurnoverRate: 8,
          burnoutRelatedTurnover: 40,
          replacementCost: 400_000,
          retentionImpactScenario: "typical",
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles("providerWellbeing", values.providerWellbeing, summaries.providerWellbeing);
    });

    it("Workforce / physicianLocumAgency: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...opBase,
        timeDriverInputs: {
          ...opBase.timeDriverInputs,
          wellbeingEnabled: true,
          calculateRetentionValue: true,
          annualTurnoverRate: 8,
          burnoutRelatedTurnover: 40,
          replacementCost: 400_000,
          retentionImpactScenario: "typical",
          physicianAgencyEnabled: true,
          physicianAgencyWeeksPerVacancy: 16,
          physicianAgencyWeeklyPremium: 5_000,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles(
        "physicianLocumAgency",
        values.physicianLocumAgency,
        summaries.physicianLocumAgency,
      );
    });

    it("Revenue / wrvu: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...opBase,
        docQualityInputs: {
          ...opBase.docQualityInputs,
          wrvuEnabled: true,
          wrvuScenario: "typical",
          currentWrvu: 1.8,
          conversionFactor: 33,
          wrvuRealization: 75,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles("wrvu", values.wrvu, summaries.wrvu);
    });

    it("Revenue / hccCapture: printed multiplicands reconcile to engine value", () => {
      // The engine reads dq.hccPlans[], NOT top-level panelSize/gapRate/etc. — so
      // those fields were ignored and this test used to silently pin the default
      // seed plan. Configure an explicit non-default plan so it exercises a real
      // scenario.
      const state: ExploreState = {
        ...opBase,
        docQualityInputs: {
          ...opBase.docQualityInputs,
          hccEnabled: true,
          avgHccs: 0.6,
          hccRealization: 40,
          hccPlans: [{
            id: "plan-test",
            planType: "medicare_advantage",
            name: "Medicare Advantage",
            panelSize: 1200,
            valuePerHcc: 1400,
            gapRate: 55,
            currentRecaptureRate: 60,
            uplift: "typical",
            netNewEnabled: false,
            netNewDiscoveryRate: 3,
            netNewAvgConditions: 1.2,
          }],
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      // Guard against the regression itself: a configured plan must produce value.
      expect(values.hccCapture).toBeGreaterThan(0);
      assertReconciles("hccCapture", values.hccCapture, summaries.hccCapture);
    });

    it("Revenue / denialPrevention: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...opBase,
        docQualityInputs: {
          ...opBase.docQualityInputs,
          denialsEnabled: true,
          denialsScenario: "typical",
          denialRate: 8,
          unappealableRate: 30,
          avgClaimValue: 200,
          denialsRealization: 60,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles(
        "denialPrevention",
        values.denialPrevention,
        summaries.denialPrevention,
      );
    });
  });

  // ── ED ───────────────────────────────────────────────────────────────
  describe("ED quadrants", () => {
    it("Capacity / lwbsRecovery: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...edBase,
        timeDriverInputs: {
          ...edBase.timeDriverInputs,
          edLwbsEnabled: true,
          edLwbsRate: 3,
          edLwbsReduction: 10,
          edRevenuePerVisit: 480,
          edLwbsRealization: 75,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles("lwbsRecovery", values.lwbsRecovery, summaries.lwbsRecovery);
    });

    it("Capacity / admissionCapture: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...edBase,
        timeDriverInputs: {
          ...edBase.timeDriverInputs,
          edLwbsEnabled: true,
          edLwbsRate: 3,
          edLwbsReduction: 10,
          edRevenuePerVisit: 480,
          edLwbsRealization: 75,
          edThroughputEnabled: true,
          edAdmissionRate: 18,
          edAdmissionRevenue: 8_000,
          edAdmissionRealization: 40,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles(
        "admissionCapture",
        values.admissionCapture,
        summaries.admissionCapture,
      );
    });

    it("Workforce / providerWellbeing (ED): printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...edBase,
        timeDriverInputs: {
          ...edBase.timeDriverInputs,
          wellbeingEnabled: true,
          calculateRetentionValue: true,
          annualTurnoverRate: 10,
          burnoutRelatedTurnover: 50,
          replacementCost: 350_000,
          retentionImpactScenario: "typical",
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles(
        "providerWellbeing",
        values.providerWellbeing,
        summaries.providerWellbeing,
      );
    });

    it("Revenue / edEmLevel: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...edBase,
        docQualityInputs: {
          ...edBase.docQualityInputs,
          wrvuEnabled: true,
          wrvuScenario: "typical",
          currentWrvu: 4.0,
          conversionFactor: 36,
          wrvuRealization: 70,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles("edEmLevel", values.edEmLevel, summaries.edEmLevel);
    });

    it("Revenue / denialPrevention (ED): printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...edBase,
        docQualityInputs: {
          ...edBase.docQualityInputs,
          denialsEnabled: true,
          denialsScenario: "typical",
          denialRate: 10,
          unappealableRate: 35,
          avgClaimValue: 480,
          denialsRealization: 65,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles(
        "denialPrevention",
        values.denialPrevention,
        summaries.denialPrevention,
      );
    });
  });

  // ── Inpatient ────────────────────────────────────────────────────────
  describe("Inpatient quadrants", () => {
    it("Workforce / providerWellbeing (IP): printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...ipBase,
        timeDriverInputs: {
          ...ipBase.timeDriverInputs,
          wellbeingEnabled: true,
          calculateRetentionValue: true,
          annualTurnoverRate: 8,
          burnoutRelatedTurnover: 45,
          replacementCost: 300_000,
          retentionImpactScenario: "typical",
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles(
        "providerWellbeing",
        values.providerWellbeing,
        summaries.providerWellbeing,
      );
    });

    it("Revenue / drgAccuracy: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...ipBase,
        docQualityInputs: {
          ...ipBase.docQualityInputs,
          ipDrgEnabled: true,
          ipDrgScenario: "typical",
          ipDrgAtRiskRate: 18,
          ipDrgWeightIncrease: 0.4,
          ipDrgBasePayment: 6_000,
          ipDrgRealization: 65,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles("drgAccuracy", values.drgAccuracy, summaries.drgAccuracy);
    });

    it("Revenue / obsDefense: printed multiplicands reconcile to engine value", () => {
      const state: ExploreState = {
        ...ipBase,
        docQualityInputs: {
          ...ipBase.docQualityInputs,
          ipObsDefenseEnabled: true,
          ipObsDefenseDenialRate: 5,
          ipObsDefenseRevenueDelta: 5_000,
          ipObsDefensePreventableScenario: 'typical',
          ipObsDefenseRealization: 50,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      assertReconciles("obsDefense", values.obsDefense, summaries.obsDefense);
    });

  });

  // ── Drift detection sanity check ─────────────────────────────────────
  describe("drift detection", () => {
    it("fails with a clear message when the printed formula does not match engine value", () => {
      // Construct an artificial scenario: simulate an engine drift by
      // computing the real engine value and a tampered formula and assert
      // the helper raises the documented error message.
      const state: ExploreState = {
        ...opBase,
        docQualityInputs: {
          ...opBase.docQualityInputs,
          wrvuEnabled: true,
          wrvuScenario: "typical",
          currentWrvu: 1.8,
          conversionFactor: 33,
          wrvuRealization: 75,
        },
      };
      const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
      const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
      // Tamper: drop the trailing share multiplier from the printed formula.
      // The customer-facing word for it is "counted" (the attribution vs
      // conversion vs realization distinction now lives in a plain-English
      // reason line, not in three different words in the math). Accept the
      // older spellings too so this guard keeps working either way.
      const tamperRe = /×\s*\d+%\s*(counted|attribution|realization|conversion)/;
      const original = summaries.wrvu ?? "";
      expect(original, "the printed wRVU formula no longer carries a share multiplier, so this guard can no longer construct a drift").toMatch(tamperRe);
      const tampered = original.replace(tamperRe, "");
      expect(() =>
        assertReconciles("wrvu (tampered)", values.wrvu, tampered),
      ).toThrow(/PDF formula no longer matches engine value/);
    });
  });
});
