import { describe, it, expect } from "vitest";
import { DEFAULT_EXPLORE_STATE, type ExploreState } from "@/pages/explore/exploreState";
import { computeAllDriverValues } from "@/lib/exploreDriverCalcs";
import { EXPLORE_DRIVERS, type ExploreSetting } from "@/lib/exploreDrivers";
import { engineKeyForDriver } from "@/lib/exploreDriverKeys";

/**
 * Resolver guard (see docs/superpowers/plans/2026-07-23-explore-one-source-of-truth.md,
 * Task 1). The repo has no jsdom / React-render test infra, so this can't be a
 * per-card render test. Instead: for each care setting, build a maximal
 * `ExploreState` with every quantified driver registered for that setting
 * enabled with realistic non-zero inputs, run the canonical engine, and assert
 * `engineKeyForDriver(id, setting)` resolves to a key the engine actually
 * emitted with a value > 0. Any card that reads
 * `computeAllDriverValues(...)[engineKeyForDriver(id, setting)]` is therefore
 * guaranteed to display a real number, not `undefined`/0/stale local math.
 */

function quantifiedDriversFor(setting: ExploreSetting) {
  return EXPLORE_DRIVERS.filter(
    (d) => d.visibility === "quantified" && d.settings.includes(setting),
  );
}

function assertAllResolve(setting: ExploreSetting, state: ExploreState, hours: number) {
  const values = computeAllDriverValues(state, hours);
  const drivers = quantifiedDriversFor(setting);
  expect(drivers.length).toBeGreaterThan(0);
  for (const driver of drivers) {
    const key = engineKeyForDriver(driver.id, setting);
    expect(
      values[key],
      `${setting}/${driver.id}: engineKeyForDriver resolved to "${key}", but the engine did not emit a positive value for it (got ${values[key]})`,
    ).toBeGreaterThan(0);
  }
}

describe("engineKeyForDriver — every registered quantified driver resolves to a real engine value", () => {
  it("outpatient: patientAccess, providerWellbeing, physicianLocumAgency, scribeCostReduction, wrvu, hccCapture, denialPrevention", () => {
    const state = {
      ...DEFAULT_EXPLORE_STATE,
      careSetting: "outpatient",
      retentionMode: "counted",
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
        // panelSize is a SCALE input (blank by default now) — feed it explicitly
        // so HCC produces a positive value for the resolve check.
        hccPlans: DEFAULT_EXPLORE_STATE.docQualityInputs.hccPlans.map(p => ({ ...p, panelSize: 300 })),
        denialsEnabled: true,
        denialsScenario: "typical",
        medNecessityDenialRate: 3,
        avgClaimValue: 200,
        denialsRealization: 60,
      },
    } as ExploreState;

    assertAllResolve("outpatient", state, 8_000);
  });

  it("ed: lwbsRecovery, admissionCapture, providerWellbeing, physicianLocumAgency, scribeCostReduction, edEmLevel, denialPrevention", () => {
    const state = {
      ...DEFAULT_EXPLORE_STATE,
      careSetting: "ed",
      retentionMode: "counted",
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

    assertAllResolve("ed", state, 5_000);
  });

  it("inpatient: providerWellbeing, incrementalStaffing, drgAccuracy, obsDefense", () => {
    const state = {
      ...DEFAULT_EXPLORE_STATE,
      careSetting: "inpatient",
      retentionMode: "counted",
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
        // physicianLocumAgency is registered for outpatient/ed only now;
        // inpatient's Workforce P&L-displacement driver is Incremental
        // Staffing Avoided.
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

    assertAllResolve("inpatient", state, 0);
  });

  it("nursing: nursingRetention, nursingAgency, nursingOvertime, nursingHapi, nursingFalls, nursingCauti, nursingClabsi, nursingSepsis", () => {
    const state = {
      ...DEFAULT_EXPLORE_STATE,
      careSetting: "nursing",
      retentionMode: "counted",
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

    assertAllResolve("nursing", state, 0);
  });
});
