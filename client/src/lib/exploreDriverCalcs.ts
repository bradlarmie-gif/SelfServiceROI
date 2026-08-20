import {
  calcHapi,
  calcFalls,
  calcCauti,
  calcClabsi,
  calcSepsis,
} from "@/lib/nursingQualityCalcs";
import type { ExploreState } from "@/pages/explore/exploreState";
import { EXPLORE_DRIVERS, type ExploreQuadrant } from "@/lib/exploreDrivers";
import { physicianRetentionRates, nursingRetentionRates } from "@/lib/retentionScenarios";

/**
 * Pure helpers that compute every quantified Explore driver's:
 *
 *   1. Engine value (the rounded $ figure shown in the headline)
 *   2. Printed `calcSummary` formula string (the "A × B × C × $D × E%" line
 *      rendered on the PDF)
 *
 * Extracting both into pure functions has two benefits:
 *
 *   - `ExploreModel.tsx` and `ExplorePDFExport`/`ExploreNarrativePDF.tsx` can
 *     share one source of truth, eliminating the risk that one is updated
 *     without the other.
 *   - Tests (see `client/src/__tests__/exploreNarrativePdfReconciliation.test.ts`)
 *     can call them directly with a synthetic `ExploreState` and assert that
 *     parsing the printed formula's multiplicands reconciles to the engine
 *     value within a small currency tolerance.
 *
 * Nursing-quality math is delegated to the shared helpers in
 * `@/lib/nursingQualityCalcs` (which are independently covered by
 * `nursingPdfReconciliation.test.ts`); the OP / ED / IP math is inlined here
 * to mirror the original ExploreModel logic exactly.
 */

// Exported scenario constants — the single source every surface (engine, proforma
// drawer recompute, cards) must import, so a hand-copied map can never drift again.
export const IP_DRG_PROTECT_SCENARIOS: Record<string, number> = {
  conservative: 15,
  typical: 20,
  aggressive: 25,
};
export const HCC_UPLIFT_SCENARIOS: Record<string, number> = {
  conservative: 3,
  typical: 5,
  optimistic: 10,
};
export const IP_OBS_PREVENTABLE_SCENARIOS: Record<string, number> = {
  conservative: 25,
  typical: 40,
  aggressive: 55,
};

// Canonical wRVU lift scenarios — single source of truth for both the headline
// engine and the per-screen Revenue breakdown / driver card.
export const wrvuScenariosFor = (isED: boolean, customPct?: number): Record<string, number> =>
  isED
    ? { conservative: 1, typical: 3, aggressive: 6, custom: customPct ?? 5 }
    : { conservative: 2, typical: 5, aggressive: 9, custom: customPct ?? 5 };

export const denialsScenariosFor = (isED: boolean, customPct?: number): Record<string, number> =>
  isED
    ? { conservative: 15, typical: 30, aggressive: 50, custom: customPct ?? 25 }
    : { conservative: 25, typical: 50, aggressive: 75, custom: customPct ?? 25 };

const fmtN = (n: number) => Math.round(n).toLocaleString();
const fmtNd = (n: number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
const fmt$ = (n: number) => `$${Math.round(n).toLocaleString()}`;

/**
 * Retention lens resolver. Retention (the replacement-cost dollar) counts
 * toward the ROI only when the user has explicitly flipped it on; the default
 * (unset) is "tracked" — shown as signals, kept out of every total. Single
 * source so the engine, the recap, the proforma snapshot and the PDFs agree.
 */
export function retentionIsCounted(state: ExploreState): boolean {
  return state.retentionMode === "counted";
}

export function computeAllDriverValues(
  state: ExploreState,
  totalHoursSaved: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  const td = state.timeDriverInputs as any;
  const dq = state.docQualityInputs as any;
  const setting = state.careSetting;
  const eligibleEncounters = Math.round(
    state.annualEncounters * (state.utilizationPercent / 100),
  );
  const isED = setting === "ed";
  const isIP = setting === "inpatient";
  const isOP = setting === "outpatient";
  const isNursing = setting === "nursing";
  const isPhysician = isOP || isED || isIP;

  // ─── Capacity ───
  if (isOP && td.patientAccessEnabled) {
    const eff = Math.min(
      td.accessProviders || state.numberOfProviders,
      state.numberOfProviders,
    );
    const hrsPerProvWk =
      state.numberOfProviders > 0
        ? totalHoursSaved / state.numberOfProviders / 48
        : 0;
    const reinvest = (td.capacityRealizationPercent ?? 25) / 100;
    const visitHrs = (td.visitDuration ?? 30) / 60;
    // Observed override (ROI calc, live partner): the rep enters the added
    // visits/provider they actually see, so we count that directly instead of
    // deriving it from an assumed reinvest %. Explore leaves the override unset
    // and keeps the reinvest-driven model.
    const visitsPerWk =
      td.patientAccessVisitsPerProvWk && td.patientAccessVisitsPerProvWk > 0
        ? td.patientAccessVisitsPerProvWk
        : visitHrs > 0
          ? Math.round((hrsPerProvWk * reinvest / visitHrs) * 10) / 10
          : 0;
    result.patientAccess = Math.round(
      visitsPerWk * eff * 48 * td.revenuePerVisit,
    );
  }
  if (isED && td.edLwbsEnabled) {
    const lwbs = state.annualEncounters * (td.edLwbsRate / 100);
    const recovered = lwbs * (td.edLwbsReduction / 100);
    result.lwbsRecovery = Math.round(
      recovered * td.edRevenuePerVisit * (td.edLwbsRealization / 100),
    );
    if (td.edThroughputEnabled) {
      const adm = recovered * (td.edAdmissionRate / 100);
      result.admissionCapture = Math.round(
        adm * td.edAdmissionRevenue * (td.edAdmissionRealization / 100),
      );
    }
  }
  // ─── Workforce ───
  const RETENTION_SCENARIOS_PHYSICIAN = physicianRetentionRates(td.retentionCustomPercent ?? 10);
  const RETENTION_SCENARIOS_NURSING = nursingRetentionRates(td.retentionCustomPercent ?? 10);
  if (isPhysician && td.wellbeingEnabled && td.calculateRetentionValue) {
    // Inpatient uses hospitalist-specific turnover/replacement inputs (the
    // fields the IP wellbeing card lets the user edit); other physician
    // settings use the generic fields. Mirrors exploreQuadrantValues.
    const turnover = (isIP ? td.ipAnnualTurnoverRate : td.annualTurnoverRate) / 100;
    const burnout = (isIP ? td.ipBurnoutRelatedTurnover : td.burnoutRelatedTurnover) / 100;
    const impact =
      RETENTION_SCENARIOS_PHYSICIAN[td.retentionImpactScenario] / 100;
    const retained = state.numberOfProviders * turnover * burnout * impact;
    result.providerWellbeing = Math.round(retained * (isIP ? td.ipReplacementCost : td.replacementCost));
    if (td.physicianAgencyEnabled) {
      result.physicianLocumAgency = Math.round(
        retained *
          td.physicianAgencyWeeksPerVacancy *
          td.physicianAgencyWeeklyPremium,
      );
    }
  }
  if (isNursing && td.nursingRetentionEnabled) {
    const turnover = td.nursingTurnoverRate / 100;
    const impact =
      RETENTION_SCENARIOS_NURSING[td.retentionImpactScenario] / 100;
    const burnoutDep = state.numberOfProviders * turnover * ((td.nursingBurnoutRelatedTurnover ?? 40) / 100);
    const retained = burnoutDep * impact;
    result.nursingRetention = Math.round(retained * td.nursingReplacementCost);
    if (td.nursingAgencyEnabled) {
      result.nursingAgency = Math.round(
        retained *
          td.nursingAgencyWeeksPerVacancy *
          td.nursingAgencyWeeklyPremium,
      );
    }
  }
  // Retention lens: unless retention is flipped to "counted", keep the soft
  // replacement-cost dollar out of every total (it renders as signals instead).
  // This is the single gate point — computeExploreTotals, the quadrant
  // breakdowns and the proforma snapshot all read these values.
  //
  // Agency/locum is real P&L displacement, BUT it is priced on the SAME retained
  // count the retention model produces (retained × weeks × premium). If retention
  // is only tracked (a signal the customer chose not to dollarize), a counted
  // agency dollar derived from that same count is the retention dollar wearing a
  // different hat — an over-claim a CFO catches. So gate it by the same lens:
  // agency counts only when retention counts. Scribe is independent displacement
  // (not derived from retention), so it stays counted.
  if (!retentionIsCounted(state)) {
    if (result.providerWellbeing !== undefined) result.providerWellbeing = 0;
    if (result.nursingRetention !== undefined) result.nursingRetention = 0;
    if (result.physicianLocumAgency !== undefined) result.physicianLocumAgency = 0;
    if (result.nursingAgency !== undefined) result.nursingAgency = 0;
  }
  if (isNursing && td.nursingOtEnabled) {
    const otHrs =
      td.nursingOtHoursPerNurseWeek *
      (td.nursingOtReductionPercent / 100) *
      state.numberOfProviders *
      52;
    result.nursingOvertime = Math.round(otHrs * td.nursingOtHourlyRate);
  }
  if ((isOP || isED) && td.scribeCostReductionEnabled) {
    if (td.scribeBillingMode === 'hourly') {
      const costPerVisit = (td.scribeHourlyRate || 0) * ((td.scribeMinutesPerNote || 0) / 60);
      const scribedVisits = state.annualEncounters * ((td.scribeCoveragePercent || 0) / 100);
      result.scribeCostReduction = Math.round(costPerVisit * scribedVisits * ((td.scribeVisitPercentEliminated || 0) / 100));
    } else {
      const eliminated = Math.min(td.scribePositionsEliminated || 0, td.scribeHeadcount || 0);
      result.scribeCostReduction = Math.round(eliminated * (td.scribeCostPerPosition || 0));
    }
  }
  // Incremental Staffing Avoided (inpatient). Independent P&L displacement:
  // the customer's current annual incremental-staffing spend (locum, moonlighting,
  // overtime, extra shifts) times the share Abridge can take off it. NOT derived
  // from the retention count, so it is not gated by the retention lens above.
  if (isIP && td.ipIncrementalStaffingEnabled) {
    result.incrementalStaffing = Math.round(
      (td.ipStaffingCurrentSpend || 0) * ((td.ipStaffingReductionPct || 0) / 100),
    );
  }

  // ─── Revenue ───
  const wrvuScenarios = wrvuScenariosFor(isED, dq.wrvuCustomPercent);
  const denialsScenarios = denialsScenariosFor(isED, dq.denialsCustomPercent);

  if (dq.wrvuEnabled && (isOP || isED)) {
    const lift = (dq.currentWrvu * wrvuScenarios[dq.wrvuScenario]) / 100;
    const value =
      eligibleEncounters * lift * dq.conversionFactor * (dq.wrvuRealization / 100);
    // wRVU / E&M is fee-for-service revenue: under a pure-risk contract there is
    // no per-encounter uplift to bill, so OP wRVU is absent (ED E&M is unaffected
    // by payment model). Gating here — the source of truth — keeps the card, the
    // ROI total, and the PDF from disagreeing (the OP revenue screen hides the
    // wRVU card under "risk" the same way).
    if (isED) result.edEmLevel = Math.round(value);
    else if (state.paymentModel !== "risk") result.wrvu = Math.round(value);
  }
  if (dq.hccEnabled && isOP && state.paymentModel !== "ffs") {
    // HCC recapture is risk-adjustment revenue: under pure fee-for-service there
    // is no risk-adjusted payment, so it is absent (the OP revenue screen hides
    // the HCC card under "ffs" the same way — gate the value so the ROI total
    // never carries a dollar the screen doesn't show).
    // Clean recapture model (no gapRate, no hidden discovery rate):
    // per plan: members × (avg documented conditions/member × recapture-rate lift
    // + newly identified/member) × $/HCC, then one global realization (RADV survival).
    // The build line in EdRevenue reproduces this exactly.
    const upliftMap = HCC_UPLIFT_SCENARIOS;
    let totalGross = 0;
    for (const plan of dq.hccPlans) {
      const members = state.numberOfProviders * plan.panelSize;
      const upliftPp = plan.uplift === 'custom' ? (plan.upliftCustomPp ?? 5) : (upliftMap[plan.uplift] ?? 5);
      const effectiveUplift = Math.min(upliftPp, Math.max(0, 100 - plan.currentRecaptureRate));
      const recaptured = members * dq.avgHccs * (effectiveUplift / 100);
      const newlyIdentified = members * (plan.netNewAvgConditions ?? 0);
      totalGross += (recaptured + newlyIdentified) * plan.valuePerHcc;
    }
    result.hccCapture = Math.round(totalGross * (dq.hccRealization / 100));
  }
  if (dq.denialsEnabled && (isOP || isED)) {
    const prev = denialsScenarios[dq.denialsScenario] / 100;
    // Claims are entered by the user (they are not the same as encounters); fall
    // back to the Abridge-enabled encounters only when nothing has been entered.
    const claimsBase = dq.denialsAnnualClaims > 0 ? dq.denialsAnnualClaims : eligibleEncounters;
    const medNecessityDenials = claimsBase * (dq.medNecessityDenialRate / 100);
    result.denialPrevention = Math.round(
      medNecessityDenials * prev * dq.avgClaimValue * (dq.denialsRealization / 100),
    );
  }
  if (isIP && dq.ipDrgEnabled) {
    // DRG query-funnel model, anchored on the CDI QUERY as the evidence of a gap.
    // A query means a trained reviewer flagged a documentation deficiency. Of the
    // queries issued, the CDI team converts some to a DRG change (respond × change)
    // — that is theirs. Abridge's value is the FLAGGED-BUT-LOST: queries that die
    // with no response or a response that doesn't stick. A complete note at the
    // point of care carries the acuity the query was chasing, so those land at the
    // right DRG without waiting on a query. Only real, evidenced gaps; one end
    // haircut (audit survival).
    const drgQueried = eligibleEncounters * (dq.ipDrgCdiReviewRate / 100) * (dq.ipDrgQueryRate / 100);
    const drgChanged = drgQueried * (dq.ipDrgResponseRate / 100) * (dq.ipDrgChangeRate / 100);
    const drgLost = Math.max(0, drgQueried - drgChanged);
    // ONE lever: the durable share Abridge captures (lands up front AND holds up
    // under audit, folded together). No separate audit multiplier — the capture
    // rate is the whole conservatism.
    const drgAbridgeCases = drgLost * (dq.ipDrgUpfrontCapture / 100);
    result.drgAccuracy = Math.round(drgAbridgeCases * dq.ipDrgWeightGain * dq.ipDrgBaseRate);
  }
  if (isIP && dq.ipObsDefenseEnabled) {
    // Status / Medical Necessity Denials. Base is TOTAL admissions (not the
    // documented slice): a payer can downgrade any admission. The chain narrows
    // from every admission to the durable Abridge dollar, each factor a real
    // lever the CFO can see: denied share -> allowed $/case -> not recovered ->
    // documentation is a material factor -> Abridge is in the workflow -> Abridge
    // moves it. The Abridge-opportunity factor is the coverage proxy (Abridge is
    // not in every workflow), so this does not also multiply by utilization.
    const denials = state.annualEncounters * (dq.ipObsDenialRate / 100);
    const gross =
      denials *
      dq.ipObsAllowedPerCase *
      (dq.ipObsNotRecoveredPct / 100) *
      (dq.ipObsDocMaterialPct / 100);
    result.obsDefense = Math.round(
      gross * (dq.ipObsAbridgeOpportunityPct / 100) * (dq.ipObsAbridgeImpactPct / 100),
    );
  }

  // ─── Quality (Nursing only quantified) ───
  // Math is delegated to the shared helpers in @/lib/nursingQualityCalcs
  // so the engine, the live UI, and the printed PDF stay in lockstep.
  if (isNursing) {
    const patientDays =
      state.nursingStaffedBeds * (state.nursingOccupancyRate / 100) * 365;
    if (dq.nursingHapiEnabled) {
      result.nursingHapi = Math.round(
        calcHapi({
          patientDays,
          rate: dq.nursingHapiRate,
          preventionPct: dq.nursingHapiPreventionRate,
          cost: dq.nursingHapiCost,
        }).value,
      );
    }
    if (dq.nursingFallsEnabled) {
      result.nursingFalls = Math.round(
        calcFalls({
          patientDays,
          rate: dq.nursingFallsRate,
          preventionPct: dq.nursingFallsPreventionRate,
          cost: dq.nursingFallsCost,
        }).value,
      );
    }
    if (dq.nursingCautiEnabled) {
      result.nursingCauti = Math.round(
        calcCauti({
          patientDays,
          utilizationPct: dq.nursingCautiUtilizationRatio,
          rate: dq.nursingCautiRate,
          preventionPct: dq.nursingCautiPreventionRate,
          cost: dq.nursingCautiCost,
        }).value,
      );
    }
    if (dq.nursingClabsiEnabled) {
      result.nursingClabsi = Math.round(
        calcClabsi({
          patientDays,
          utilizationPct: dq.nursingClabsiUtilizationRatio,
          rate: dq.nursingClabsiRate,
          preventionPct: dq.nursingClabsiPreventionRate,
          cost: dq.nursingClabsiCost,
        }).value,
      );
    }
    if (dq.nursingSepsisEnabled) {
      result.nursingSepsis = Math.round(
        calcSepsis({
          patientDays,
          ratePerThousand: dq.nursingSepsisRatePerThousand,
          currentCompliancePct: dq.nursingSepsisCurrentCompliance,
          docLagPct: dq.nursingSepsisDocLagPercent,
          excessCostPerCase: dq.nursingSepsisExcessCostPerCase,
          realizationPct: dq.nursingSepsisRealization,
        }).value,
      );
    }
  }

  return result;
}

export function computeAllDriverCalcSummaries(
  state: ExploreState,
  totalHoursSaved: number,
): Record<string, string> {
  const out: Record<string, string> = {};
  const td = state.timeDriverInputs as any;
  const dq = state.docQualityInputs as any;
  const setting = state.careSetting;
  const eligibleEncounters = Math.round(
    state.annualEncounters * (state.utilizationPercent / 100),
  );
  const isED = setting === "ed";
  const isIP = setting === "inpatient";
  const isOP = setting === "outpatient";
  const isNursing = setting === "nursing";
  const isPhysician = isOP || isED || isIP;

  // Capacity
  if (isOP && td.patientAccessEnabled) {
    const eff = Math.min(
      td.accessProviders || state.numberOfProviders,
      state.numberOfProviders,
    );
    const hrsPerProvWk =
      state.numberOfProviders > 0
        ? totalHoursSaved / state.numberOfProviders / 48
        : 0;
    const reinvest = (td.capacityRealizationPercent ?? 25) / 100;
    const visitHrs = (td.visitDuration ?? 30) / 60;
    // Observed override (ROI calc, live partner): the rep enters the added
    // visits/provider they actually see, so we count that directly instead of
    // deriving it from an assumed reinvest %. Explore leaves the override unset
    // and keeps the reinvest-driven model.
    const visitsPerWk =
      td.patientAccessVisitsPerProvWk && td.patientAccessVisitsPerProvWk > 0
        ? td.patientAccessVisitsPerProvWk
        : visitHrs > 0
          ? Math.round((hrsPerProvWk * reinvest / visitHrs) * 10) / 10
          : 0;
    out.patientAccess = `${fmtN(eff)} providers × ${fmtNd(visitsPerWk)} visits/wk × 48 wks × ${fmt$(td.revenuePerVisit)}/visit`;
  }
  if (isED && td.edLwbsEnabled) {
    out.lwbsRecovery = `${fmtN(state.annualEncounters)} ED visits × ${td.edLwbsRate}% LWBS × ${td.edLwbsReduction}% reduction × ${fmt$(td.edRevenuePerVisit)}/visit × ${td.edLwbsRealization}% counted`;
    if (td.edThroughputEnabled) {
      const recovered = Math.round(
        state.annualEncounters * (td.edLwbsRate / 100) * (td.edLwbsReduction / 100),
      );
      out.admissionCapture = `${fmtN(recovered)} recovered visits × ${td.edAdmissionRate}% admit rate × ${fmt$(td.edAdmissionRevenue)}/admit × ${td.edAdmissionRealization}% counted`;
    }
  }

  // Workforce
  const CS_RETENTION_PHYSICIAN = physicianRetentionRates(td.retentionCustomPercent ?? 10);
  const CS_RETENTION_NURSING = nursingRetentionRates(td.retentionCustomPercent ?? 10);
  if (isPhysician && td.wellbeingEnabled && td.calculateRetentionValue) {
    const impactPct =
      CS_RETENTION_PHYSICIAN[td.retentionImpactScenario] ?? 0;
    // Inpatient prints its hospitalist-specific fields so the formula keeps
    // multiplying out to the engine value (which now uses them too).
    const wbTurnover = isIP ? td.ipAnnualTurnoverRate : td.annualTurnoverRate;
    const wbBurnout = isIP ? td.ipBurnoutRelatedTurnover : td.burnoutRelatedTurnover;
    const wbReplacement = isIP ? td.ipReplacementCost : td.replacementCost;
    out.providerWellbeing = `${fmtN(state.numberOfProviders)} providers × ${wbTurnover}% turnover × ${wbBurnout}% burnout × ${impactPct}% impact × ${fmt$(wbReplacement)}/replacement`;
    if (td.physicianAgencyEnabled) {
      // Print the full factor breakdown rather than a precomputed
      // `${fmtNd(retained)} retained` token. Rounding the retained-providers
      // sub-total to one decimal (e.g. 0.16 → "0.2") would silently inflate
      // the printed math by ~25% versus the engine value. Breaking the
      // formula down keeps the printed multiplicands in lockstep with the
      // engine's unrounded retained × weeks × premium product.
      out.physicianLocumAgency = `${fmtN(state.numberOfProviders)} providers × ${wbTurnover}% turnover × ${wbBurnout}% burnout × ${impactPct}% impact × ${td.physicianAgencyWeeksPerVacancy} wks/vacancy × ${fmt$(td.physicianAgencyWeeklyPremium)}/wk`;
    }
  }
  if (isNursing && td.nursingRetentionEnabled) {
    const impactPct =
      CS_RETENTION_NURSING[td.retentionImpactScenario] ?? 0;
    out.nursingRetention = `${fmtN(state.numberOfProviders)} nurses × ${td.nursingTurnoverRate}% turnover × ${td.nursingBurnoutRelatedTurnover ?? 40}% burnout × ${impactPct}% impact × ${fmt$(td.nursingReplacementCost)}/replacement`;
    if (td.nursingAgencyEnabled) {
      // Print the full factor breakdown rather than a precomputed
      // `${fmtNd(retained)} retained` token. Rounding the retained-nurses
      // sub-total to one decimal (e.g. 0.16 → "0.2") would silently inflate
      // the printed math by ~25% versus the engine value. Breaking the
      // formula down keeps the printed multiplicands in lockstep with the
      // engine's unrounded retained × weeks × premium product.
      out.nursingAgency = `${fmtN(state.numberOfProviders)} nurses × ${td.nursingTurnoverRate}% turnover × ${td.nursingBurnoutRelatedTurnover ?? 40}% burnout × ${impactPct}% impact × ${td.nursingAgencyWeeksPerVacancy} wks/vacancy × ${fmt$(td.nursingAgencyWeeklyPremium)}/wk`;
    }
  }
  if (isNursing && td.nursingOtEnabled) {
    out.nursingOvertime = `${fmtN(state.numberOfProviders)} nurses × ${td.nursingOtHoursPerNurseWeek} overtime ${td.nursingOtHoursPerNurseWeek === 1 ? "hour" : "hours"} a week × ${td.nursingOtReductionPercent}% reduction × 52 weeks × ${fmt$(td.nursingOtHourlyRate)} an hour`;
  }
  if (isIP && td.ipIncrementalStaffingEnabled) {
    out.incrementalStaffing = `${fmt$(td.ipStaffingCurrentSpend || 0)} current incremental-staffing spend × ${td.ipStaffingReductionPct}% reduction with Abridge`;
  }

  // Revenue
  const wrvuScenarios = wrvuScenariosFor(isED, dq.wrvuCustomPercent);
  const denialsScenarios = denialsScenariosFor(isED, dq.denialsCustomPercent);

  if (dq.wrvuEnabled && (isOP || isED)) {
    const liftPct = wrvuScenarios[dq.wrvuScenario] ?? 0;
    // Show the conversion factor at its true precision (e.g. $33.40, not $33)
    // so the printed chain reproduces the value exactly — Finance's test.
    const cf = dq.conversionFactor % 1 === 0 ? `$${dq.conversionFactor}` : `$${dq.conversionFactor.toFixed(2)}`;
    const encNoun = setting === "outpatient" ? "visits" : setting === "ed" ? "ED visits" : setting === "inpatient" ? "admissions" : "encounters";
    const summary = `${fmtN(eligibleEncounters)} ${encNoun} × ${dq.currentWrvu} current wRVU × ${liftPct}% lift × ${cf}/wRVU × ${dq.wrvuRealization}% counted`;
    if (isED) out.edEmLevel = summary;
    else if (state.paymentModel !== "risk") out.wrvu = summary;
  }
  if (dq.hccEnabled && isOP && state.paymentModel !== "ffs") {
    const upliftMap = HCC_UPLIFT_SCENARIOS;
    // Pure-multiplicand form so the PDF reconciliation parser can verify it:
    // members × (recapture + new, folded into HCCs/member) × $/HCC × realization.
    const planLines = dq.hccPlans.map((p: { name: string; panelSize: number; currentRecaptureRate: number; uplift: string; upliftCustomPp?: number; netNewAvgConditions: number; valuePerHcc: number }) => {
      const members = Math.round(state.numberOfProviders * p.panelSize);
      const upliftPp = p.uplift === 'custom' ? (p.upliftCustomPp ?? 5) : (upliftMap[p.uplift] ?? 5);
      const effective = Math.min(upliftPp, Math.max(0, 100 - p.currentRecaptureRate));
      const perMember = dq.avgHccs * (effective / 100) + (p.netNewAvgConditions ?? 0);
      return `${p.name}: ${fmtN(members)} members × ${perMember.toFixed(3)} HCCs per member × ${fmt$(p.valuePerHcc)}/HCC`;
    }).join(' | ');
    out.hccCapture = `${planLines} × ${dq.hccRealization}% counted`;
  }
  if (dq.denialsEnabled && (isOP || isED)) {
    const prevPct = denialsScenarios[dq.denialsScenario] ?? 0;
    const claimsBase = dq.denialsAnnualClaims > 0 ? dq.denialsAnnualClaims : eligibleEncounters;
    out.denialPrevention = `${fmtN(claimsBase)} claims × ${dq.medNecessityDenialRate}% medical necessity denial rate × ${prevPct}% reduction target × ${fmt$(dq.avgClaimValue)}/claim × ${dq.denialsRealization}% counted`;
  }
  if (isIP && dq.ipDrgEnabled) {
    out.drgAccuracy = (() => {
      const queried = eligibleEncounters * (dq.ipDrgCdiReviewRate / 100) * (dq.ipDrgQueryRate / 100);
      const changed = queried * (dq.ipDrgResponseRate / 100) * (dq.ipDrgChangeRate / 100);
      const lost = Math.max(0, queried - changed);
      const cases = lost * (dq.ipDrgUpfrontCapture / 100);
      return `${fmtN(lost)} flagged-but-lost queries × ${dq.ipDrgUpfrontCapture}% captured by Abridge (${fmtN(cases)} cases) × ${dq.ipDrgWeightGain} weight × ${fmt$(dq.ipDrgBaseRate)}/weight`;
    })();
  }
  if (isIP && dq.ipObsDefenseEnabled) {
    const denials = Math.round(state.annualEncounters * (dq.ipObsDenialRate / 100));
    out.obsDefense = `${fmtN(state.annualEncounters)} admissions × ${dq.ipObsDenialRate}% denied (${fmtN(denials)} cases) × ${fmt$(dq.ipObsAllowedPerCase)}/case × ${dq.ipObsNotRecoveredPct}% not recovered × ${dq.ipObsDocMaterialPct}% documentation is material × ${dq.ipObsAbridgeOpportunityPct}% Abridge opportunity × ${dq.ipObsAbridgeImpactPct}% Abridge impact`;
  }

  // Quality (Nursing only quantified) — derive every multiplicand from the
  // shared helpers so the displayed formula and the engine value can never
  // disagree, even if a future haircut/multiplier is added to the math.
  if (isNursing && state.nursingStaffedBeds && state.nursingOccupancyRate) {
    const patientDays =
      state.nursingStaffedBeds * (state.nursingOccupancyRate / 100) * 365;
    if (dq.nursingHapiEnabled) {
      out.nursingHapi = `${fmtN(patientDays)} patient-days × ${dq.nursingHapiRate}/1k HAPI × ${dq.nursingHapiPreventionRate}% your team could avoid × ${fmt$(dq.nursingHapiCost)}/case`;
    }
    if (dq.nursingFallsEnabled) {
      out.nursingFalls = `${fmtN(patientDays)} patient-days × ${dq.nursingFallsRate}/1k falls × ${dq.nursingFallsPreventionRate}% your team could avoid × ${fmt$(dq.nursingFallsCost)}/case`;
    }
    if (dq.nursingCautiEnabled) {
      const cautiCalc = calcCauti({
        patientDays,
        utilizationPct: dq.nursingCautiUtilizationRatio,
        rate: dq.nursingCautiRate,
        preventionPct: dq.nursingCautiPreventionRate,
        cost: dq.nursingCautiCost,
      });
      out.nursingCauti = `${fmtN(cautiCalc.catheterDays)} cath-days × ${dq.nursingCautiRate}/1k CAUTI × ${dq.nursingCautiPreventionRate}% your team could avoid × ${fmt$(dq.nursingCautiCost)}/case`;
    }
    if (dq.nursingClabsiEnabled) {
      const clabsiCalc = calcClabsi({
        patientDays,
        utilizationPct: dq.nursingClabsiUtilizationRatio,
        rate: dq.nursingClabsiRate,
        preventionPct: dq.nursingClabsiPreventionRate,
        cost: dq.nursingClabsiCost,
      });
      out.nursingClabsi = `${fmtN(clabsiCalc.lineDays)} line-days × ${dq.nursingClabsiRate}/1k CLABSI × ${dq.nursingClabsiPreventionRate}% your team could avoid × ${fmt$(dq.nursingClabsiCost)}/case`;
    }
    if (dq.nursingSepsisEnabled) {
      const sepsisCalc = calcSepsis({
        patientDays,
        ratePerThousand: dq.nursingSepsisRatePerThousand,
        currentCompliancePct: dq.nursingSepsisCurrentCompliance,
        docLagPct: dq.nursingSepsisDocLagPercent,
        excessCostPerCase: dq.nursingSepsisExcessCostPerCase,
        realizationPct: dq.nursingSepsisRealization,
      });
      out.nursingSepsis = `${fmtN(patientDays)} patient-days × ${dq.nursingSepsisRatePerThousand}/1k sepsis × ${sepsisCalc.complianceGapPct}% non-compliance × ${dq.nursingSepsisDocLagPercent}% doc lag × ${fmt$(dq.nursingSepsisExcessCostPerCase)}/case × ${dq.nursingSepsisRealization}% counted`;
    }
  }

  return out;
}

export interface ExploreTotals {
  /** Per-quadrant driver totals (excludes "other financial benefits"). */
  valueByQuadrant: Record<ExploreQuadrant, number>;
  /** Recurring annual value: all driver values + annual other-financial-benefits. */
  totalAnnualValue: number;
  /** One-time value: one-time other-financial-benefits only. */
  totalOneTimeValue: number;
  /** Time/efficiency value shown on the Investment screen = Capacity + Workforce. */
  efficiencyValue: number;
  /** Documentation/quality value shown on the Investment screen = Revenue + Quality. */
  documentationValue: number;
}

/**
 * Single source of truth for the headline Explore totals. Both the
 * Investment screen (ExploreInvestment) and the Your Model screen
 * (ExploreModel) consume this so they can never disagree about Total Value or
 * ROI. The math mirrors ExploreModel's original quadrant aggregation:
 * driver values come from `computeAllDriverValues` summed by quadrant, plus
 * the user's "other financial benefits" (annual into the recurring total,
 * one-time tracked separately).
 *
 * The efficiency / documentation split is just a regrouping of the same
 * quadrants (Capacity+Workforce vs Revenue+Quality), so
 * `efficiencyValue + documentationValue === totalAnnualValue` always holds.
 */
export function computeExploreTotals(
  state: ExploreState,
  totalHoursSaved: number,
): ExploreTotals {
  const allDriverValues = computeAllDriverValues(state, totalHoursSaved);

  const valueByQuadrant: Record<ExploreQuadrant, number> = {
    Capacity: 0,
    Workforce: 0,
    Revenue: 0,
    Quality: 0,
  };
  if (state.careSetting) {
    EXPLORE_DRIVERS.forEach((d) => {
      if (d.settings.includes(state.careSetting!)) {
        valueByQuadrant[d.quadrant] += allDriverValues[d.id] || 0;
      }
    });
  }

  const annualBenefitByQuadrant: Record<ExploreQuadrant, number> = {
    Capacity: 0,
    Workforce: 0,
    Revenue: 0,
    Quality: 0,
  };
  let totalOneTimeValue = 0;
  (state.otherFinancialBenefits ?? []).forEach((b) => {
    if (b.label.trim() && b.amount > 0) {
      if (b.type === "annual") annualBenefitByQuadrant[b.quadrant] += b.amount;
      else totalOneTimeValue += b.amount;
    }
  });

  const driverSum =
    valueByQuadrant.Capacity +
    valueByQuadrant.Workforce +
    valueByQuadrant.Revenue +
    valueByQuadrant.Quality;
  const annualBenefitSum =
    annualBenefitByQuadrant.Capacity +
    annualBenefitByQuadrant.Workforce +
    annualBenefitByQuadrant.Revenue +
    annualBenefitByQuadrant.Quality;

  return {
    valueByQuadrant,
    totalAnnualValue: driverSum + annualBenefitSum,
    totalOneTimeValue,
    efficiencyValue:
      valueByQuadrant.Capacity +
      valueByQuadrant.Workforce +
      annualBenefitByQuadrant.Capacity +
      annualBenefitByQuadrant.Workforce,
    documentationValue:
      valueByQuadrant.Revenue +
      valueByQuadrant.Quality +
      annualBenefitByQuadrant.Revenue +
      annualBenefitByQuadrant.Quality,
  };
}
