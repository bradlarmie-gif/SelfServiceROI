import { describe, it, expect } from "vitest";
import {
  computeAllDriverValues,
  computeAllDriverCalcSummaries,
  computeExploreTotals,
} from "@/lib/exploreDriverCalcs";
import { EXPLORE_DRIVERS } from "@/lib/exploreDrivers";
import { DEFAULT_EXPLORE_STATE, type ExploreState, type ExploreCareSetting } from "@/pages/explore/exploreState";

/**
 * LAYER 1 of the Explore integrity harness — MATH (the "Finance believes it" gate).
 *
 * EXHAUSTIVE: for every care setting, every one of the 2^N on/off combinations
 * of that setting's quantified drivers is generated and checked. For each combo:
 *
 *   (a) Reconciliation: the sum of every driver's engine value equals the
 *       engine's own total (no value is dropped, none is double-counted).
 *   (b) Formula fidelity: every enabled driver's printed calcSummary — the math
 *       chain the PDF renders — multiplies back to that driver's value. This is
 *       the CFO's "reproduce the number from what's on the page" test.
 *   (c) No phantom value: disabled / qualitative drivers contribute nothing.
 *
 * Reuses the token-parsing + tolerance logic proven in
 * exploreNarrativePdfReconciliation.test.ts.
 */

function tolerance(value: number): number {
  return Math.max(50, Math.abs(value) * 0.005);
}

function parseFormulaProduct(calcSummary: string): number {
  const tokens = calcSummary.replace(/\s*\|\s*/g, " × ").split("×").map((t) => t.trim());
  let product = 1;
  for (const token of tokens) {
    const cleaned = token.replace(/\([^)]*\)/g, " ");
    const dollarMatch = cleaned.match(/\$([\d,]+(?:\.\d+)?)/);
    const ppMatch = cleaned.match(/(-?[\d,]+(?:\.\d+)?)\s*pp\b/);
    const percentMatch = cleaned.match(/(-?[\d,]+(?:\.\d+)?)\s*%/);
    const bareMatch = cleaned.match(/(-?[\d,]+(?:\.\d+)?)/);
    let factor: number | null = null;
    if (dollarMatch) factor = Number(dollarMatch[1].replace(/,/g, ""));
    else if (ppMatch) factor = Number(ppMatch[1].replace(/,/g, "")) / 100;
    else if (percentMatch) factor = Number(percentMatch[1].replace(/,/g, "")) / 100;
    else if (bareMatch) factor = Number(bareMatch[1].replace(/,/g, ""));
    if (factor === null || Number.isNaN(factor)) return NaN;
    // Per-1,000 rate tokens ("2.5/1k HAPI", "2/1,000 sepsis") are rates per
    // thousand — divide by 1,000. ($…/case, $…/unit are dollar tokens, no /1k.)
    if (!dollarMatch && (/\/\s*1k\b/i.test(cleaned) || /\/\s*1,?000\b/.test(cleaned))) {
      factor /= 1000;
    }
    product *= factor;
  }
  return product;
}

const TOTAL_HOURS_SAVED = 50 * 4 * 48;

// Bases primed so an enabled driver actually produces a value off DEFAULT inputs.
const BASES: Record<ExploreCareSetting, ExploreState> = {
  outpatient: {
    ...DEFAULT_EXPLORE_STATE,
    careSetting: "outpatient",
    numberOfProviders: 50,
    annualEncounters: 100_000,
    utilizationPercent: 80,
    // HCC panelSize is a SCALE input, blank (0) by default under scale-gating.
    // Feed it explicitly so every HCC on/off combo produces a value and its
    // printed formula is still asserted (do NOT weaken the fuzz — just supply scale).
    docQualityInputs: {
      ...DEFAULT_EXPLORE_STATE.docQualityInputs,
      hccPlans: DEFAULT_EXPLORE_STATE.docQualityInputs.hccPlans.map((p) => ({ ...p, panelSize: 300 })),
    },
  },
  ed: { ...DEFAULT_EXPLORE_STATE, careSetting: "ed", numberOfProviders: 30, annualEncounters: 60_000, utilizationPercent: 100 },
  inpatient: { ...DEFAULT_EXPLORE_STATE, careSetting: "inpatient", numberOfProviders: 25, annualEncounters: 12_000, utilizationPercent: 100 },
  nursing: {
    ...DEFAULT_EXPLORE_STATE,
    careSetting: "nursing",
    numberOfProviders: 300,
    annualEncounters: 100_000,
    utilizationPercent: 100,
    nursingStaffedBeds: 200,
    nursingOccupancyRate: 80,
  },
};

function withDrivers(base: ExploreState, keys: string[], onSet: Set<string>): ExploreState {
  const td = { ...(base.timeDriverInputs as Record<string, unknown>), calculateRetentionValue: true } as Record<string, unknown>;
  const dq = { ...(base.docQualityInputs as Record<string, unknown>) } as Record<string, unknown>;
  for (const k of keys) {
    td[k] = onSet.has(k);
    dq[k] = onSet.has(k);
  }
  return { ...base, timeDriverInputs: td as ExploreState["timeDriverInputs"], docQualityInputs: dq as ExploreState["docQualityInputs"] };
}

const SETTINGS: ExploreCareSetting[] = ["outpatient", "ed", "inpatient", "nursing"];

describe("Explore MATH integrity — exhaustive over every driver on/off combination", () => {
  for (const setting of SETTINGS) {
    const drivers = EXPLORE_DRIVERS.filter((d) => d.settings.includes(setting) && d.visibility === "quantified");
    const keys = drivers.map((d) => d.enabledStateKey);
    const N = drivers.length;
    const combos = 2 ** N;
    const fired = new Set<string>();

    it(`${setting}: ${combos} combinations reconcile + formulas reproduce values`, () => {
      for (let mask = 0; mask < combos; mask++) {
        const onSet = new Set<string>();
        drivers.forEach((d, i) => {
          if (mask & (1 << i)) onSet.add(d.enabledStateKey);
        });
        const state = withDrivers(BASES[setting], keys, onSet);
        const values = computeAllDriverValues(state, TOTAL_HOURS_SAVED);
        const summaries = computeAllDriverCalcSummaries(state, TOTAL_HOURS_SAVED);
        const totals = computeExploreTotals(state, TOTAL_HOURS_SAVED);

        // (a) reconciliation: sum of all driver values === engine total
        const sum = Object.values(values).reduce((s, v) => s + (v || 0), 0);
        const total = totals.totalAnnualValue;
        expect(
          Math.abs(sum - total) <= tolerance(total) + 5,
          `[${setting} mask ${mask}] sum of driver values ${sum} != engine total ${total}`,
        ).toBe(true);

        // (b) formula fidelity for each enabled quantified driver with value
        for (const d of drivers) {
          if (!onSet.has(d.enabledStateKey)) continue;
          const v = values[d.id];
          const summary = summaries[d.id];
          if (!v || v <= 0 || !summary) continue;
          fired.add(d.id);
          const printed = parseFormulaProduct(summary);
          expect(
            !Number.isNaN(printed) && Math.abs(printed - v) <= tolerance(v),
            `[${setting} mask ${mask}] "${d.id}" formula "${summary}" → ${printed}, engine value ${v}`,
          ).toBe(true);
        }

        // (c) disabled quantified drivers contribute nothing
        for (const d of drivers) {
          if (onSet.has(d.enabledStateKey)) continue;
          expect(values[d.id] || 0, `[${setting} mask ${mask}] disabled "${d.id}" leaked value`).toBe(0);
        }
      }
      // eslint-disable-next-line no-console
      console.log(`  ${setting}: ${combos} combos ✓ · formula-checked drivers: ${[...fired].join(", ") || "(none fired — priming gap)"}`);
    });
  }
});
