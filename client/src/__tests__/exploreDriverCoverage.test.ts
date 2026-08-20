import { describe, it, expect } from "vitest";
import { DEFAULT_EXPLORE_STATE, type ExploreState } from "@/pages/explore/exploreState";
import { computeAllDriverValues } from "@/lib/exploreDriverCalcs";
import { EXPLORE_DRIVERS, type ExploreSetting } from "@/lib/exploreDrivers";
import { engineKeyForDriver } from "@/lib/exploreDriverKeys";

/**
 * Coverage invariant (see
 * docs/superpowers/plans/2026-07-23-explore-one-source-of-truth.md, Task 5).
 *
 * Task 1's resolver test (`exploreDriverKeys.test.ts`) proves every
 * REGISTERED driver's engine key resolves to a real, positive value — i.e.
 * no card can read `undefined`/stale math. This test closes the other
 * direction: it proves the engine has no key that is computed but never
 * claimed by the registry — the "computed but never surfaced" orphan class.
 * Two assertions:
 *
 *   1. Forward — for a maximal, all-drivers-enabled `ExploreState` per care
 *      setting, every key `computeAllDriverValues` emits maps back (via
 *      `engineKeyForDriver`) to EXACTLY ONE `EXPLORE_DRIVERS` entry whose
 *      `settings` includes that setting.
 *   2. Reverse — every `quantified` `EXPLORE_DRIVERS` entry resolves (via
 *      `engineKeyForDriver`) to a key the engine actually emits for that
 *      setting.
 *
 * No jsdom / React-render test infra exists in this repo (see Task 1's
 * note), so this is a unit-level guard over the engine's output object and
 * the registry data, not a rendered-card test.
 *
 * Note: the quantified inpatient CDI dollar driver (`ipCdi`, formerly keyed
 * to an engine result of the same name as the fewer-queries-avoided figure)
 * was removed as a product decision — avoided CDI queries aren't cash unless
 * CDI staff headcount is cut, and it double-counted with `drgAccuracy`. The
 * engine no longer emits that key at all, so there is no exception to carve
 * out here; the invariant now holds with zero exceptions. The qualitative
 * CDI signal drivers (`ipCdiQueryRate`/`ipCdiQueryTrend`, `opCdiQueryTrend`)
 * are unaffected — they were never quantified dollar drivers and are not
 * part of this coverage check.
 */
const PROFORMA_ONLY_KEYS = new Set<string>();

function quantifiedDriversFor(setting: ExploreSetting) {
  return EXPLORE_DRIVERS.filter(
    (d) => d.visibility === "quantified" && d.settings.includes(setting),
  );
}

/** All EXPLORE_DRIVERS entries (any visibility) for `setting` whose engine key resolves to `key`. */
function driversMappingTo(setting: ExploreSetting, key: string) {
  return EXPLORE_DRIVERS.filter(
    (d) => d.settings.includes(setting) && engineKeyForDriver(d.id, setting) === key,
  );
}

// Maximal per-setting fixtures — every quantified driver for that setting
// enabled with realistic non-zero inputs. Mirrors the fixtures in
// exploreDriverKeys.test.ts (Task 1) so both tests exercise the same "every
// driver on" state.

const outpatientState = {
  ...DEFAULT_EXPLORE_STATE,
  careSetting: "outpatient",
  numberOfProviders: 100,
  annualEncounters: 200_000,
  utilizationPercent: 80,
  timeDriverInputs: {
    ...DEFAULT_EXPLORE_STATE.timeDriverInputs,
    patientAccessEnabled: true,
    accessProviders: 100,
    capacityRealizationPercent: 25,
    visitDuration: 30,
    revenuePerVisit: 200,
    wellbeingEnabled: true,
    calculateRetentionValue: true,
    annualTurnoverRate: 6,
    burnoutRelatedTurnover: 40,
    replacementCost: 400_000,
    retentionImpactScenario: "typical",
    physicianAgencyEnabled: true,
    physicianAgencyWeeksPerVacancy: 16,
    physicianAgencyWeeklyPremium: 5_000,
    scribeCostReductionEnabled: true,
    scribeBillingMode: "position",
    scribeHeadcount: 10,
    scribePositionsEliminated: 5,
    scribeCostPerPosition: 35_000,
  },
  docQualityInputs: {
    ...DEFAULT_EXPLORE_STATE.docQualityInputs,
    wrvuEnabled: true,
    wrvuScenario: "typical",
    currentWrvu: 1.8,
    conversionFactor: 33,
    wrvuRealization: 75,
    hccEnabled: true,
    denialsEnabled: true,
    denialsScenario: "typical",
    medNecessityDenialRate: 3,
    avgClaimValue: 200,
    denialsRealization: 60,
  },
} as ExploreState;

const edState = {
  ...DEFAULT_EXPLORE_STATE,
  careSetting: "ed",
  numberOfProviders: 60,
  annualEncounters: 120_000,
  utilizationPercent: 100,
  timeDriverInputs: {
    ...DEFAULT_EXPLORE_STATE.timeDriverInputs,
    edLwbsEnabled: true,
    edLwbsRate: 3,
    edLwbsReduction: 20,
    edRevenuePerVisit: 350,
    edLwbsRealization: 85,
    edThroughputEnabled: true,
    edAdmissionRate: 15,
    edAdmissionRevenue: 8_000,
    edAdmissionRealization: 75,
    wellbeingEnabled: true,
    calculateRetentionValue: true,
    annualTurnoverRate: 6,
    burnoutRelatedTurnover: 40,
    replacementCost: 400_000,
    retentionImpactScenario: "typical",
    physicianAgencyEnabled: true,
    physicianAgencyWeeksPerVacancy: 16,
    physicianAgencyWeeklyPremium: 5_000,
    scribeCostReductionEnabled: true,
    scribeBillingMode: "position",
    scribeHeadcount: 10,
    scribePositionsEliminated: 5,
    scribeCostPerPosition: 35_000,
  },
  docQualityInputs: {
    ...DEFAULT_EXPLORE_STATE.docQualityInputs,
    wrvuEnabled: true,
    wrvuScenario: "typical",
    currentWrvu: 1.8,
    conversionFactor: 33,
    wrvuRealization: 75,
    denialsEnabled: true,
    denialsScenario: "typical",
    medNecessityDenialRate: 3,
    avgClaimValue: 200,
    denialsRealization: 60,
  },
} as ExploreState;

const inpatientState = {
  ...DEFAULT_EXPLORE_STATE,
  careSetting: "inpatient",
  numberOfProviders: 40,
  annualEncounters: 20_000,
  utilizationPercent: 60,
  timeDriverInputs: {
    ...DEFAULT_EXPLORE_STATE.timeDriverInputs,
    wellbeingEnabled: true,
    calculateRetentionValue: true,
    ipAnnualTurnoverRate: 10,
    ipBurnoutRelatedTurnover: 45,
    ipReplacementCost: 400_000,
    retentionImpactScenario: "typical",
    // physicianLocumAgency is no longer registered for inpatient (settings:
    // ['outpatient','ed'] only) — Incremental Staffing Avoided replaced it as
    // the inpatient Workforce P&L-displacement driver. Do NOT enable
    // physicianAgencyEnabled here: the engine still computes the key for any
    // physician setting (isPhysician gate), so leaving it on would emit an
    // orphan key with no inpatient card to claim it.
    ipIncrementalStaffingEnabled: true,
    ipStaffingCurrentSpend: 500_000,
    ipStaffingReductionPct: 15,
  },
  docQualityInputs: {
    ...DEFAULT_EXPLORE_STATE.docQualityInputs,
    ipDrgEnabled: true,
    ipDrgScenario: "typical",
    ipDrgAtRiskRate: 8,
    ipDrgWeightIncrease: 0.3,
    ipDrgBasePayment: 12_000,
    ipDrgRealization: 60,
    // Status / Medical Necessity Denials (obsDefense) new chain — base is
    // TOTAL admissions, not a documented slice. See exploreDriverCalcs.ts.
    ipObsDefenseEnabled: true,
    ipObsDenialRate: 5,
    ipObsAllowedPerCase: 10_000,
    ipObsNotRecoveredPct: 30,
    ipObsDocMaterialPct: 40,
    ipObsAbridgeOpportunityPct: 75,
    ipObsAbridgeImpactPct: 40,
  },
} as ExploreState;

const nursingState = {
  ...DEFAULT_EXPLORE_STATE,
  careSetting: "nursing",
  numberOfProviders: 300,
  nursingStaffedBeds: 300,
  nursingOccupancyRate: 85,
  timeDriverInputs: {
    ...DEFAULT_EXPLORE_STATE.timeDriverInputs,
    nursingRetentionEnabled: true,
    nursingTurnoverRate: 30,
    nursingReplacementCost: 60_000,
    retentionImpactScenario: "typical",
    nursingAgencyEnabled: true,
    nursingAgencyWeeksPerVacancy: 12,
    nursingAgencyWeeklyPremium: 2_500,
    nursingOtEnabled: true,
    nursingOtHoursPerNurseWeek: 4,
    nursingOtReductionPercent: 15,
    nursingOtHourlyRate: 62,
  },
  docQualityInputs: {
    ...DEFAULT_EXPLORE_STATE.docQualityInputs,
    nursingHapiEnabled: true,
    nursingHapiRate: 2.5,
    nursingHapiPreventionRate: 6.5,
    nursingHapiCost: 25_000,
    nursingFallsEnabled: true,
    nursingFallsRate: 3.5,
    nursingFallsPreventionRate: 10,
    nursingFallsCost: 6_500,
    nursingCautiEnabled: true,
    nursingCautiUtilizationRatio: 30,
    nursingCautiRate: 1.8,
    nursingCautiPreventionRate: 12,
    nursingCautiCost: 13_000,
    nursingClabsiEnabled: true,
    nursingClabsiUtilizationRatio: 20,
    nursingClabsiRate: 0.8,
    nursingClabsiPreventionRate: 8,
    nursingClabsiCost: 20_000,
    nursingSepsisEnabled: true,
    nursingSepsisRatePerThousand: 2.0,
    nursingSepsisCurrentCompliance: 75,
    nursingSepsisDocLagPercent: 30,
    nursingSepsisExcessCostPerCase: 3_500,
    nursingSepsisRealization: 60,
  },
} as ExploreState;

const FIXTURES: Record<ExploreSetting, { state: ExploreState; hours: number }> = {
  outpatient: { state: outpatientState, hours: 8_000 },
  ed: { state: edState, hours: 5_000 },
  inpatient: { state: inpatientState, hours: 0 },
  nursing: { state: nursingState, hours: 0 },
};

function assertForwardCoverage(setting: ExploreSetting) {
  const { state, hours } = FIXTURES[setting];
  const values = computeAllDriverValues(state, hours);
  const emittedKeys = Object.keys(values);
  expect(emittedKeys.length).toBeGreaterThan(0);
  for (const key of emittedKeys) {
    if (PROFORMA_ONLY_KEYS.has(key)) continue;
    const matches = driversMappingTo(setting, key).filter((d) => d.visibility === "quantified");
    expect(
      matches.length,
      `${setting}: engine emitted "${key}" (value ${values[key]}) but ${matches.length} ` +
        `quantified EXPLORE_DRIVERS entries map to it (expected exactly 1): ` +
        `[${matches.map((d) => d.id).join(", ")}]. If this is 0, it is a NEW orphan — ` +
        `either register a driver whose engineKeyForDriver resolves to "${key}", or add ` +
        `"${key}" to PROFORMA_ONLY_KEYS with a comment explaining why it has no Explore card.`,
    ).toBe(1);
  }
}

function assertReverseCoverage(setting: ExploreSetting) {
  const { state, hours } = FIXTURES[setting];
  const values = computeAllDriverValues(state, hours);
  const drivers = quantifiedDriversFor(setting);
  expect(drivers.length).toBeGreaterThan(0);
  for (const driver of drivers) {
    const key = engineKeyForDriver(driver.id, setting);
    expect(
      key in values,
      `${setting}/${driver.id}: engineKeyForDriver resolved to "${key}", but the engine did ` +
        `not emit that key at all for a maximal (all-drivers-enabled) state. A registered, ` +
        `quantified driver must always resolve to a key the engine can produce.`,
    ).toBe(true);
  }
}

describe("Explore driver coverage invariant — forward: every engine key maps to exactly one registered driver", () => {
  it("outpatient", () => assertForwardCoverage("outpatient"));
  it("ed", () => assertForwardCoverage("ed"));
  it("inpatient", () => assertForwardCoverage("inpatient"));
  it("nursing", () => assertForwardCoverage("nursing"));
});

describe("Explore driver coverage invariant — reverse: every quantified driver resolves to a key the engine emits", () => {
  it("outpatient", () => assertReverseCoverage("outpatient"));
  it("ed", () => assertReverseCoverage("ed"));
  it("inpatient", () => assertReverseCoverage("inpatient"));
  it("nursing", () => assertReverseCoverage("nursing"));
});

describe("Explore driver coverage invariant — the exception set is empty", () => {
  it("there is NO engine key without a registered driver, across all four settings", () => {
    const settings: ExploreSetting[] = ["outpatient", "ed", "inpatient", "nursing"];
    const trulyUnmapped = new Set<string>();
    for (const setting of settings) {
      const { state, hours } = FIXTURES[setting];
      const values = computeAllDriverValues(state, hours);
      for (const key of Object.keys(values)) {
        const matches = driversMappingTo(setting, key).filter((d) => d.visibility === "quantified");
        if (matches.length === 0) trulyUnmapped.add(key);
      }
    }
    // If this fails, a NEW accidental orphan has appeared — do not paper over
    // it by re-adding an exception; register the missing EXPLORE_DRIVERS
    // entry instead (or gate the engine emission).
    expect(trulyUnmapped).toEqual(PROFORMA_ONLY_KEYS);
  });
});
