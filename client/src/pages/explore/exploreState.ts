/**
 * Explore state model: the shape of an Explore session, its defaults, and the
 * phase resolver. Extracted from ExploreFlow.tsx so that consumers which need
 * only the model (the ROI Calculator engine, the driver-calc libs, the test
 * suite) do not have to import the Explore React flow and everything it renders.
 */
export type ExploreCareSetting = 'outpatient' | 'ed' | 'nursing' | 'inpatient';

export interface OtherFinancialBenefitItem {
  id: string;
  label: string;
  amount: number;
  type: 'annual' | 'oneTime';
  quadrant: 'Capacity' | 'Workforce' | 'Revenue' | 'Quality';
}

export interface CostDisplacementItem {
  id: string;
  label: string;
  annualSpend: number;
  displacementPct: number;
}

export type TimePathScenario = 'conservative' | 'typical' | 'aggressive' | null;

// DocPathFocus is retained as an exported type; the per-path doc-driver state
// it once gated is dead and was removed.
export type DocPathFocus = 'wrvu' | 'hcc' | 'denials';

// Value Drivers - Time inputs
export interface TimeDriverInputs {
  patientAccessEnabled: boolean;
  additionalVisitsPerWeek: number;
  accessProviders: number;
  capacityRealizationPercent: number;
  patientAccessVisitsPerProvWk: number; // ROI calc: observed added visits/provider/wk (0 = use reinvest model)
  visitDuration: number;
  revenuePerVisit: number;
  
  costReductionEnabled: boolean;
  estimatedCostReduction: number;
  
  wellbeingEnabled: boolean;
  calculateRetentionValue: boolean;
  annualTurnoverRate: number;
  burnoutRelatedTurnover: number;
  replacementCost: number;
  retentionImpactScenario: 'conservative' | 'typical' | 'optimistic' | 'custom';
  retentionCustomPercent: number;
  
  // ED-specific inputs
  edLwbsEnabled: boolean;
  edLwbsRate: number; // Current LWBS rate %
  edLwbsReduction: number; // Expected reduction %
  edRevenuePerVisit: number;
  edLwbsRealization: number; // Realization rate for LWBS recovery (not all patients return)
  edThroughputEnabled: boolean;
  edAdmissionRate: number; // % of recovered patients who get admitted
  edAdmissionRevenue: number; // Revenue per admission
  edAdmissionRealization: number; // Realization rate for admission capture
  
  // Inpatient-specific inputs
  ipRoundingEnabled: boolean;
  ipAnnualTurnoverRate: number; // Hospitalist turnover rate
  ipBurnoutRelatedTurnover: number; // % of turnover burnout-related
  ipReplacementCost: number; // Hospitalist replacement cost
  // Discharge Planning Initiation driver (qualitative — no calc inputs needed)
  ipDischargePlanningEnabled: boolean;
  ipDischargePlanningExpanded: boolean;
  
  // Outpatient time allocation
  opAllocCapacityPercent: number;
  opAllocDocQualityPercent: number;
  opAllocWellbeingPercent: number;
  
  // ED time allocation
  edAllocThroughputPercent: number;
  edAllocDocQualityPercent: number;
  edAllocWellbeingPercent: number;
  
  // Inpatient time allocation
  ipAllocQualityPercent: number;
  ipAllocCostPercent: number;
  ipAllocWellbeingPercent: number;
  
  // Nursing-specific inputs
  nursingOtEnabled: boolean;
  nursingOtExpanded: boolean;
  nursingOtHoursPerNurseWeek: number;
  nursingOtReductionPercent: number;
  nursingOtHourlyRate: number;
  nursingRetentionEnabled: boolean;
  nursingRetentionExpanded: boolean;
  nursingTurnoverRate: number;
  nursingBurnoutRelatedTurnover: number;
  nursingReplacementCost: number;
  nursingCareTimeEnabled: boolean;
  nursingCareTimeExpanded: boolean;
  nursingCareTimePercent: number; // Direct patient care allocation percentage
  nursingShiftSustainabilityPercent: number; // Shift sustainability allocation percentage
  
  // Agency Cost Avoidance (Nursing)
  nursingAgencyEnabled: boolean;
  nursingAgencyExpanded: boolean;
  nursingAnnualAgencySpend: number; // USD/year (legacy)
  nursingAvgAgencyHourlyRate: number; // USD/hr (legacy)
  nursingAgencyWeeksPerVacancy: number; // Weeks of agency coverage per vacancy
  nursingAgencyWeeklyPremium: number; // Weekly agency premium (above base cost)

  // Physician Locum/Agency Cost Avoidance (OP/ED/IP) — child of Provider Wellbeing
  physicianAgencyEnabled: boolean;
  physicianAgencyExpanded: boolean;
  physicianAgencyWeeksPerVacancy: number; // weeks of contracted coverage per vacancy
  physicianAgencyWeeklyPremium: number;   // dollar premium per week above base salary equivalent

  // Inpatient: Incremental Staffing Avoided (locum + moonlighting + OT + extra shifts).
  // Independent of retention: current annual incremental-staffing spend × Abridge reduction %.
  ipIncrementalStaffingEnabled: boolean;
  ipIncrementalStaffingExpanded: boolean;
  ipStaffingCurrentSpend: number;   // current annual incremental-staffing spend ($)
  ipStaffingReductionPct: number;   // Abridge-attributable reduction (%)

  nursingAdditionalCostSavings: Array<{ id: string; label: string; amount: number }>;

  // Scribe Cost Reduction (OP/ED)
  scribeBillingMode: 'position' | 'hourly';
  scribeHeadcount: number;
  scribeCostPerPosition: number;
  scribePositionsEliminated: number;
  scribeHourlyRate: number;
  scribeMinutesPerNote: number;
  scribeCoveragePercent: number;
  scribeVisitPercentEliminated: number;

  // Care Quality (Nursing) - HAPI & Falls prevention
  nursingCareQualityEnabled: boolean;
  nursingCareQualityExpanded: boolean;
  nursingFallsRate: number; // per 1,000 patient days
  nursingFallsPreventablePct: number; // % preventable with Abridge
  nursingCostPerFall: number; // $ per fall
  nursingHapiRate: number; // per 1,000 patient days
  nursingHapiPreventablePct: number; // % preventable with Abridge
  nursingCostPerHapi: number; // $ per HAPI
  
  // Collapsible state for shared/other drivers
  costReductionExpanded: boolean;
  patientAccessExpanded: boolean;
  wellbeingExpanded: boolean;
  edLwbsExpanded: boolean;
  edThroughputExpanded: boolean;
  ipRoundingExpanded: boolean;

  // OP qualitative Quality drivers (3 — methodology-aligned: Care Gap Closure / HEDIS / STARS)
  opCdiQueryTrendEnabled: boolean;
  opCdiQueryTrendExpanded: boolean;
  opCareGapClosureRateEnabled: boolean;
  opCareGapClosureRateExpanded: boolean;
  opHedisCompositeScoreEnabled: boolean;
  opHedisCompositeScoreExpanded: boolean;
  opMaStarsPerformanceEnabled: boolean;
  opMaStarsPerformanceExpanded: boolean;
  // ED qualitative Quality (3)
  edCoreMeasureDocRateEnabled: boolean;
  edCoreMeasureDocRateExpanded: boolean;
  edDocDeficiencyRateEnabled: boolean;
  edDocDeficiencyRateExpanded: boolean;
  // IP qualitative Quality drivers (legacy state vars retained for compatibility)
  ipHcahpsCompositeEnabled: boolean;
  ipHcahpsCompositeExpanded: boolean;
  ipReadmissionEnabled: boolean;
  ipReadmissionExpanded: boolean;
  // IP Capacity (4)
  ipHnpCompletion24hEnabled: boolean;
  ipHnpCompletion24hExpanded: boolean;
  ipConsultThroughputEnabled: boolean;
  ipConsultThroughputExpanded: boolean;
  // IP Quality (4)
  ipCdiQueryRateEnabled: boolean;
  ipCdiQueryRateExpanded: boolean;
  ipSoiClassificationEnabled: boolean;
  ipSoiClassificationExpanded: boolean;
  ipHcahpsDoctorEnabled: boolean;
  ipHcahpsDoctorExpanded: boolean;
  ipReadmissionRateEnabled: boolean;
  ipReadmissionRateExpanded: boolean;
  // ED qualitative Quality (patient experience addition)
  edPatientExperienceEnabled: boolean;
  edPatientExperienceExpanded: boolean;
  // Nursing qualitative Quality
  nursingEarlyDeteriorationEnabled: boolean;
  nursingEarlyDeteriorationExpanded: boolean;
  nursingBundleComplianceEnabled: boolean;
  nursingBundleComplianceExpanded: boolean;
  // Nursing qualitative Revenue
  nursingCdiResponseEnabled: boolean;
  nursingCdiResponseExpanded: boolean;
  nursingDocCompletionEnabled: boolean;
  nursingDocCompletionExpanded: boolean;

  // ───── R-IA-2 / R-IA-3 curated qualitative drivers ─────
  // OP Capacity qualitative (3 — trimmed by R-IA-3)
  opThirdNextAvailableEnabled: boolean;
  opThirdNextAvailableExpanded: boolean;
  opSameDayAccessEnabled: boolean;
  opSameDayAccessExpanded: boolean;
  opPanelSizePerProviderEnabled: boolean;
  opPanelSizePerProviderExpanded: boolean;
  // OP Workforce qualitative (3 — trimmed by R-IA-3)
  opAfterHoursDocEnabled: boolean;
  opAfterHoursDocExpanded: boolean;
  opNotesBeforeLeavingEnabled: boolean;
  opNotesBeforeLeavingExpanded: boolean;
  opBurnoutTrackingEnabled: boolean;
  opBurnoutTrackingExpanded: boolean;
  // OP Revenue qualitative (3 — trimmed by R-IA-3)
  opEmLevelDistributionEnabled: boolean;
  opEmLevelDistributionExpanded: boolean;
  opFirstPassClaimRateEnabled: boolean;
  opFirstPassClaimRateExpanded: boolean;
  opCgCahpsEnabled: boolean;
  opCgCahpsExpanded: boolean;
  // ED Capacity qualitative (3)
  edDoorToProviderEnabled: boolean;
  edDoorToProviderExpanded: boolean;
  edEncountersPerShiftEnabled: boolean;
  edEncountersPerShiftExpanded: boolean;
  // ED Workforce qualitative (4)
  edAfterHoursDocEnabled: boolean;
  edAfterHoursDocExpanded: boolean;
  edEndOfShiftCompletionEnabled: boolean;
  edEndOfShiftCompletionExpanded: boolean;
  edBurnoutTrackingEnabled: boolean;
  edBurnoutTrackingExpanded: boolean;
  edLikelihoodToStayEnabled: boolean;
  edLikelihoodToStayExpanded: boolean;
  // ED Revenue qualitative (3)
  edEmLevelDistributionEnabled: boolean;
  edEmLevelDistributionExpanded: boolean;
  edCdiQueryAdmissionsEnabled: boolean;
  edCdiQueryAdmissionsExpanded: boolean;
  edDowncodingRateEnabled: boolean;
  edDowncodingRateExpanded: boolean;
  // IP Capacity qualitative (3 — restructured by R-IA-5; ALOS removed)
  // IP Capacity qualitative (4)
  ipDocumentationLagEnabled: boolean;
  ipDocumentationLagExpanded: boolean;
  ipDischargeGoalDocEnabled: boolean;
  ipDischargeGoalDocExpanded: boolean;
  // IP Workforce qualitative (4)
  ipAfterHoursDocEnabled: boolean;
  ipAfterHoursDocExpanded: boolean;
  ipProgressNoteCompletionEnabled: boolean;
  ipProgressNoteCompletionExpanded: boolean;
  ipBurnoutTrackingEnabled: boolean;
  ipBurnoutTrackingExpanded: boolean;
  ipLikelihoodToStayEnabled: boolean;
  ipLikelihoodToStayExpanded: boolean;
  // IP Revenue qualitative (expanded by R-IA-5)
  ipCcMccCaptureEnabled: boolean;
  ipCcMccCaptureExpanded: boolean;
  ipCdiQueryTrendEnabled: boolean;
  ipCdiQueryTrendExpanded: boolean;
  // Nursing Capacity qualitative (3 — expanded by R-IA-6)
  nursingDocumentationLagEnabled: boolean;
  nursingDocumentationLagExpanded: boolean;
  nursingPointOfCareDocEnabled: boolean;
  nursingPointOfCareDocExpanded: boolean;
  // Nursing Workforce qualitative (3 — expanded by R-IA-6)
  nursingLikelihoodToStayEnabled: boolean;
  nursingLikelihoodToStayExpanded: boolean;
  nursingBurnoutEnabled: boolean;
  nursingBurnoutExpanded: boolean;
  nursingChartingAfterShiftEnabled: boolean;
  nursingChartingAfterShiftExpanded: boolean;
  // Doc time per note (all care settings)
  opDocTimePerNoteEnabled: boolean;
  opDocTimePerNoteExpanded: boolean;
  edDocTimePerEncounterEnabled: boolean;
  edDocTimePerEncounterExpanded: boolean;
  ipDocTimeHnpEnabled: boolean;
  ipDocTimeHnpExpanded: boolean;
  ipDocTimeProgressNoteEnabled: boolean;
  ipDocTimeProgressNoteExpanded: boolean;
  ipDocTimeConsultNoteEnabled: boolean;
  ipDocTimeConsultNoteExpanded: boolean;
  ipDocTimeDischargeEnabled: boolean;
  ipDocTimeDischargeExpanded: boolean;
  nursingDocTimePerEventEnabled: boolean;
  nursingDocTimePerEventExpanded: boolean;
  // Scribe cost reduction (Workforce, quantified — OP + ED)
  scribeCostReductionEnabled: boolean;
  scribeCostReductionExpanded: boolean;
  // OP Revenue qualitative
  opPriorAuthP2PEnabled: boolean;
  opPriorAuthP2PExpanded: boolean;
  opClaimsReworkTimeEnabled: boolean;
  opClaimsReworkTimeExpanded: boolean;
  // OP Quality qualitative
  opNoteCompletenessEnabled: boolean;
  opNoteCompletenessExpanded: boolean;
  opReferralDocQualityEnabled: boolean;
  opReferralDocQualityExpanded: boolean;
  // ED Capacity qualitative
  edDoorToDispositionEnabled: boolean;
  edDoorToDispositionExpanded: boolean;
  // ED Revenue qualitative
  edClaimsReworkTimeEnabled: boolean;
  edClaimsReworkTimeExpanded: boolean;
  // ED Quality qualitative
  edNoteCompletenessEnabled: boolean;
  edNoteCompletenessExpanded: boolean;
  edSepsisBundleEnabled: boolean;
  edSepsisBundleExpanded: boolean;
  // IP Capacity qualitative
  ipLengthOfStayEnabled: boolean;
  ipLengthOfStayExpanded: boolean;
  ipDischargeSummaryTimelinessEnabled: boolean;
  ipDischargeSummaryTimelinessExpanded: boolean;
  // IP Revenue qualitative
  ipClaimsReworkTimeEnabled: boolean;
  ipClaimsReworkTimeExpanded: boolean;
  // IP Quality qualitative
  ipPoaDocRateEnabled: boolean;
  ipPoaDocRateExpanded: boolean;
  ipNoteCompletenessEnabled: boolean;
  ipNoteCompletenessExpanded: boolean;
}

export interface HccPlan {
  id: string;
  planType: 'medicare_advantage' | 'aca_marketplace' | 'medicaid_mco' | 'custom';
  name: string;
  panelSize: number;              // patients on this plan per provider
  valuePerHcc: number;            // $ per captured HCC condition (RAF impact × annual payment collapsed)
  // Recapture
  gapRate: number;                // % of plan patients with known conditions needing recode annually
  currentRecaptureRate: number;   // % they currently capture (0–100)
  uplift: 'conservative' | 'typical' | 'optimistic' | 'custom';
  upliftCustomPp?: number;
  // Net new
  netNewEnabled: boolean;
  netNewDiscoveryRate: number;    // % of plan patients where ambient surfaces a never-coded condition
  netNewAvgConditions: number;    // avg new HCC conditions per discovered patient
}

// Documentation Quality inputs
export interface DocQualityInputs {
  // wRVU
  wrvuEnabled: boolean;
  wrvuScenario: 'conservative' | 'typical' | 'aggressive' | 'custom';
  wrvuCustomPercent: number;
  currentWrvu: number;
  conversionFactor: number;
  wrvuRealization: number;

  // HCC
  hccEnabled: boolean;
  hccPlans: HccPlan[];
  avgHccs: number;
  hccRealization: number;
  
  // Denials
  denialsEnabled: boolean;
  denialsScenario: 'conservative' | 'typical' | 'aggressive' | 'custom';
  denialsCustomPercent: number;
  medNecessityDenialRate: number;
  /** Annual medical-necessity claims the user enters. 0 = fall back to the
   *  Abridge-enabled encounters default (claims are not the same as encounters). */
  denialsAnnualClaims: number;
  avgClaimValue: number;
  denialsRealization: number;
  
  // Inpatient: DRG Accuracy
  ipDrgEnabled: boolean;
  ipDrgScenario: 'conservative' | 'typical' | 'aggressive' | 'custom';
  ipDrgCustomPercent: number;
  ipDrgAtRiskRate: number; // legacy, unused by the clean CMI model
  // DRG query-funnel model. The CDI funnel (review → query → respond → change) is
  // the baseline the CDI team already produces; Abridge's value is the DELTA it
  // captures on the discharges that funnel structurally misses.
  ipDrgCdiReviewRate: number; // % of discharges CDI reviews
  ipDrgQueryRate: number; // % of reviewed charts that get a query
  ipDrgResponseRate: number; // % of queries the physician answers
  ipDrgChangeRate: number; // % of responses that actually change the DRG
  ipDrgUpfrontCapture: number; // ABRIDGE lever: durable share of the flagged-but-lost queries Abridge captures (lands up front AND holds up under audit)
  ipDrgWeightGain: number; // avg DRG weight gained on a case that moves up a tier
  ipDrgBaseRate: number; // blended base payment per weight unit ($/weight)
  ipDrgRealization: number; // legacy audit-survival factor; folded into ipDrgUpfrontCapture, retained for Attain/legacy
  // Legacy CMI-lift fields, retained for Attain/Intake which still model DRG the
  // old way. The core engine value now comes from the funnel fields above.
  ipDrgWeightIncrease: number;
  ipDrgBasePayment: number;
  ipDrgCurrentCmi: number; // current Case Mix Index (context: current -> projected)
  
  // Inpatient: Status / Medical Necessity Denials
  // Chain (base = TOTAL admissions): admissions × denied% × $allowed/case
  //   × notRecovered% × docMaterial% × abridgeOpportunity% × abridgeImpact%
  ipObsDefenseEnabled: boolean;
  ipObsDefenseExpanded: boolean;
  ipObsDenialRate: number;            // % of total admissions that receive a status/med-nec denial
  ipObsAllowedPerCase: number;        // expected allowed inpatient reimbursement per case ($)
  ipObsNotRecoveredPct: number;       // % traditionally not recovered
  ipObsDocMaterialPct: number;        // % where documentation is a material contributing factor
  ipObsAbridgeOpportunityPct: number; // % Abridge is in the workflow (coverage proxy)
  ipObsAbridgeImpactPct: number;      // % Abridge moves
  // Legacy obs fields (kept for back-compat with older snapshots; unused by the new chain)
  ipObsDefenseDenialRate?: number;
  ipObsDefenseRevenueDelta?: number;
  ipObsDefensePreventableScenario?: 'conservative' | 'typical' | 'aggressive' | 'custom';
  ipObsDefenseCustomPercent?: number;
  ipObsDefenseRealization?: number;
  
  // Inpatient: CDI Query Reduction
  ipCdiEnabled: boolean;
  ipCdiScenario: 'conservative' | 'typical' | 'aggressive' | 'custom';
  ipCdiCustomPercent: number;
  ipCdiQueryRate: number; // % of admissions that generate queries
  ipCdiCostPerQuery: number; // Cost per query
  ipCdiRealization: number;

  // Nursing: HAPI Prevention (potential value)
  nursingHapiEnabled: boolean;
  nursingHapiRate: number; // HAPIs per 1,000 patient days
  nursingHapiPreventionRate: number; // % prevented with better documentation
  nursingHapiCost: number; // Cost per HAPI
  
  // Nursing: Falls Prevention (potential value)
  nursingFallsEnabled: boolean;
  nursingFallsRate: number; // Falls per 1,000 patient days
  nursingFallsPreventionRate: number; // % prevented with better documentation
  nursingFallsCost: number; // Cost per fall
  
  // Nursing: HAC Penalty Exposure (risk display — not modeled as ROI)
  nursingHacEnabled: boolean;
  nursingHacBottomQuartile: boolean;
  nursingHacMedicareRevenue: number;

  // Nursing: Patient Experience (qualitative only)
  nursingHcahpsEnabled: boolean;
  nursingCautiEnabled: boolean;
  nursingCautiUtilizationRatio: number;
  nursingCautiRate: number;
  nursingCautiPreventionRate: number;
  nursingCautiCost: number;
  nursingCautiExpanded: boolean;
  nursingClabsiEnabled: boolean;
  nursingClabsiUtilizationRatio: number;
  nursingClabsiRate: number;
  nursingClabsiPreventionRate: number;
  nursingClabsiCost: number;
  nursingClabsiExpanded: boolean;
  nursingSepsisEnabled: boolean;
  nursingSepsisRatePerThousand: number;
  nursingSepsisCurrentCompliance: number;
  nursingSepsisDocLagPercent: number;
  nursingSepsisExcessCostPerCase: number;
  nursingSepsisRealization: number;
  nursingSepsisExpanded: boolean;

  
  // Expanded states for collapse/expand chevrons
  wrvuExpanded: boolean;
  hccExpanded: boolean;
  denialsExpanded: boolean;
  ipDrgExpanded: boolean;
  ipCdiExpanded: boolean;
  nursingHapiExpanded: boolean;
  nursingFallsExpanded: boolean;
  nursingHacExpanded: boolean;
  nursingHcahpsExpanded: boolean;
}

export interface ExploreState {
  careSetting: ExploreCareSetting | null;

  /** UI-only fork (editorial Revenue screen): which money drivers to surface for
   * outpatient — fee-for-service (wRVU), risk-based (HCC), or both. Display-only;
   * it does not change engine math, which already gates wRVU/HCC independently
   * via their own enabled flags. */
  paymentModel: 'ffs' | 'risk' | 'both';

  numberOfProviders: number;
  encountersPerProvider: number;
  annualEncounters: number;
  utilizationPercent: number;
  
  nursingStaffedBeds: number;
  nursingOccupancyRate: number;
  nursingShiftsPerNurseYear: number;
  nursingMinutesPerShift: number;

  timePathScenario: TimePathScenario;
  minutesSavedPerEncounter: number;

  /** Inpatient time savings is modeled per note type, not one flat
   * minutes-per-note: an H&P once per admission (heavy narrative), a progress
   * note each day after admission (so it scales with length of stay), and
   * optional consults. These components DERIVE minutesSavedPerEncounter for
   * inpatient (a blended minutes-per-admission) in updateState, so the whole
   * value engine keeps reading the one canonical field unchanged. ALOS is
   * entered on the Practice step. The discharge summary is deliberately not
   * modeled here yet (Abridge does not write it today). */
  inpatientHpMinutes: number;
  inpatientProgressMinutes: number;
  inpatientConsultsEnabled: boolean;
  inpatientConsultMinutes: number;
  inpatientAlos: number;

  wrvuPctIncrease: number;
  hccPctRecaptured: number;
  denialsPctReduced: number;
  
  // Time value driver inputs
  timeDriverInputs: TimeDriverInputs;
  
  // Documentation quality inputs
  docQualityInputs: DocQualityInputs;
  
  // Investment values
  pricingModel: 'perProvider' | 'perEncounter' | 'annual' | 'platform';
  costPerProvider: number;
  costPerEncounter: number;
  annualLicenseFee: number;
  platformEncRate: number;
  implementationFee: number;
  includeImplementation: boolean;
  
  // Full scale projection
  fullScaleProviders: number;
  
  otherFinancialBenefits: OtherFinancialBenefitItem[];
  costDisplacementItems: CostDisplacementItem[];
  costDisplacementY1Override?: number;
  costDisplacementY2Override?: number;
  costDisplacementY3Override?: number;

  year2GrowthPercent: number;
  year3GrowthPercent: number;

  /** Retention lens (audience toggle). "counted" folds the retention
   * replacement-cost dollar (providerWellbeing / nursingRetention) into the
   * ROI; "tracked" (the default when unset) shows retention as its signals —
   * turnover, burnout, likelihood to stay — and keeps the dollar out of the
   * total. Lens only: the underlying replacement-cost math is unchanged, just
   * gated in/out of the sum. Agency/locum and scribe reductions are hard
   * displacement dollars and always count. */
  retentionMode?: "counted" | "tracked";
}

/** Inpatient time savings, blended to a single minutes-per-admission figure that
 * the whole value engine reads through minutesSavedPerEncounter. An H&P is written
 * once per admission (heavy narrative); a progress note is written each day AFTER
 * admission, so it scales with length of stay (ALOS - 1 days); consults are an
 * optional blended per-admission add. The discharge summary is deliberately
 * excluded (Abridge does not write it today). Pure + exported so it is the single
 * source of truth for the derivation and can be unit-tested. */
export function deriveInpatientMinutesPerAdmission(
  s: Pick<
    ExploreState,
    | "inpatientHpMinutes"
    | "inpatientProgressMinutes"
    | "inpatientConsultsEnabled"
    | "inpatientConsultMinutes"
    | "inpatientAlos"
  >,
): number {
  const progressDays = Math.max(0, s.inpatientAlos - 1);
  const blended =
    s.inpatientHpMinutes +
    s.inpatientProgressMinutes * progressDays +
    (s.inpatientConsultsEnabled ? s.inpatientConsultMinutes : 0);
  return Math.round(blended * 100) / 100;
}

export const DEFAULT_EXPLORE_STATE: ExploreState = {
  careSetting: null,
  paymentModel: 'both',
  numberOfProviders: 0,
  encountersPerProvider: 0,
  annualEncounters: 0,
  utilizationPercent: 0,
  nursingStaffedBeds: 0,
  nursingOccupancyRate: 85,
  nursingShiftsPerNurseYear: 156,
  nursingMinutesPerShift: 0,
  timePathScenario: null,
  minutesSavedPerEncounter: 0,
  inpatientHpMinutes: 0,
  inpatientProgressMinutes: 0,
  inpatientConsultsEnabled: false,
  inpatientConsultMinutes: 3,
  inpatientAlos: 0,
  wrvuPctIncrease: 5,
  hccPctRecaptured: 15,
  denialsPctReduced: 50,
  // Time value driver inputs
  timeDriverInputs: {
    patientAccessEnabled: false,
    additionalVisitsPerWeek: 1,
    accessProviders: 0,
    capacityRealizationPercent: 25,
    patientAccessVisitsPerProvWk: 0,
    visitDuration: 30,
    revenuePerVisit: 200,
    costReductionEnabled: false,
    estimatedCostReduction: 0,
    wellbeingEnabled: false,
    calculateRetentionValue: false,
    annualTurnoverRate: 6,
    burnoutRelatedTurnover: 40,
    replacementCost: 400000,
    retentionImpactScenario: 'typical',
    retentionCustomPercent: 10,
    // ED-specific defaults
    edLwbsEnabled: false,
    edLwbsRate: 3, // 3% baseline LWBS rate
    edLwbsReduction: 10, // 10% reduction in LWBS (conservative default)
    edRevenuePerVisit: 480, // Higher than outpatient
    edLwbsRealization: 50, // 50% realization — defensible; not all recovered LWBS patients complete a billable visit (was 80, an overstatement vs the mockup's 40-55% band)
    edThroughputEnabled: false,
    edAdmissionRate: 18, // 18% of recovered patients get admitted
    edAdmissionRevenue: 4000, // Contribution margin per admission (net of cost of care), not gross/net revenue
    edAdmissionRealization: 75, // 75% realization (mainly bed availability + conversion; collection is minor since admissions skew insured and margin already nets cost)
    // Inpatient-specific defaults
    ipRoundingEnabled: false,
    ipAnnualTurnoverRate: 8, // Hospitalist turnover: 8%
    ipBurnoutRelatedTurnover: 45, // 45% of turnover is burnout-related
    ipReplacementCost: 300000, // $300,000 replacement cost
    ipDischargePlanningEnabled: false,
    ipDischargePlanningExpanded: false,
    // Outpatient time allocation defaults (auto-set, no longer user-facing)
    opAllocCapacityPercent: 33,
    opAllocDocQualityPercent: 34,
    opAllocWellbeingPercent: 33,
    // ED time allocation defaults (auto-set, no longer user-facing)
    edAllocThroughputPercent: 33,
    edAllocDocQualityPercent: 34,
    edAllocWellbeingPercent: 33,
    // Inpatient time allocation defaults (auto-set, no longer user-facing)
    ipAllocQualityPercent: 34,
    ipAllocCostPercent: 33,
    ipAllocWellbeingPercent: 33,
    // Nursing-specific defaults
    nursingOtEnabled: false,
    nursingOtExpanded: false,
    nursingOtHoursPerNurseWeek: 1.0,
    nursingOtReductionPercent: 40,
    nursingOtHourlyRate: 75,
    nursingRetentionEnabled: false,
    nursingRetentionExpanded: false,
    nursingTurnoverRate: 18,
    nursingBurnoutRelatedTurnover: 40,
    nursingReplacementCost: 56300,
    nursingCareTimeEnabled: false,
    nursingCareTimeExpanded: false,
    nursingCareTimePercent: 40,
    nursingShiftSustainabilityPercent: 35,
    // Agency Cost Avoidance defaults
    nursingAgencyEnabled: false,
    nursingAgencyExpanded: false,
    nursingAnnualAgencySpend: 2000000, // $2M default (legacy)
    nursingAvgAgencyHourlyRate: 150, // $150/hr default (legacy)
    nursingAgencyWeeksPerVacancy: 12, // 12 weeks average time to fill
    nursingAgencyWeeklyPremium: 2500, // $2,500 weekly premium above base cost
    // Physician Locum/Agency Cost Avoidance defaults
    physicianAgencyEnabled: false,
    physicianAgencyExpanded: false,
    physicianAgencyWeeksPerVacancy: 16, // 16 weeks average to fill a physician vacancy
    physicianAgencyWeeklyPremium: 5000, // $5K/week premium for locum coverage
    // Inpatient: Incremental Staffing Avoided defaults
    ipIncrementalStaffingEnabled: false,
    ipIncrementalStaffingExpanded: false,
    ipStaffingCurrentSpend: 0,       // customer enters their current spend
    ipStaffingReductionPct: 15,      // conservative Abridge-attributable reduction
    nursingAdditionalCostSavings: [],
    scribeBillingMode: 'position',
    scribeHeadcount: 0,
    scribeCostPerPosition: 0,
    scribePositionsEliminated: 0,
    scribeHourlyRate: 0,
    scribeMinutesPerNote: 20,
    scribeCoveragePercent: 100,
    scribeVisitPercentEliminated: 100,
    // Care Quality (HAPI & Falls) defaults
    nursingCareQualityEnabled: false,
    nursingCareQualityExpanded: false,
    nursingFallsRate: 3.5, // per 1,000 patient days
    nursingFallsPreventablePct: 10, // % where documentation timeliness gap was primary factor
    nursingCostPerFall: 6500, // $ per fall
    nursingHapiRate: 2.5, // per 1,000 patient days
    nursingHapiPreventablePct: 6.5, // % preventable with timely assessments
    nursingCostPerHapi: 25000, // $ per HAPI
    // Collapsible state defaults
    costReductionExpanded: false,
    patientAccessExpanded: false,
    wellbeingExpanded: false,
    edLwbsExpanded: false,
    edThroughputExpanded: false,
    ipRoundingExpanded: false,
    // OP Quality qualitative driver defaults (methodology-aligned)
    opCdiQueryTrendEnabled: false,
    opCdiQueryTrendExpanded: false,
    opCareGapClosureRateEnabled: false,
    opCareGapClosureRateExpanded: false,
    opHedisCompositeScoreEnabled: false,
    opHedisCompositeScoreExpanded: false,
    opMaStarsPerformanceEnabled: false,
    opMaStarsPerformanceExpanded: false,
    edCoreMeasureDocRateEnabled: false,
    edCoreMeasureDocRateExpanded: false,
    edDocDeficiencyRateEnabled: false,
    edDocDeficiencyRateExpanded: false,
    ipHcahpsCompositeEnabled: false,
    ipHcahpsCompositeExpanded: false,
    ipReadmissionEnabled: false,
    ipReadmissionExpanded: false,
    // IP Capacity (4)
    ipHnpCompletion24hEnabled: false,
    ipHnpCompletion24hExpanded: false,
    ipConsultThroughputEnabled: false,
    ipConsultThroughputExpanded: false,
    // IP Quality (4)
    ipCdiQueryRateEnabled: false,
    ipCdiQueryRateExpanded: false,
    ipSoiClassificationEnabled: false,
    ipSoiClassificationExpanded: false,
    ipHcahpsDoctorEnabled: false,
    ipHcahpsDoctorExpanded: false,
    ipReadmissionRateEnabled: false,
    ipReadmissionRateExpanded: false,
    // ED Quality (patient experience)
    edPatientExperienceEnabled: false,
    edPatientExperienceExpanded: false,
    nursingEarlyDeteriorationEnabled: false,
    nursingEarlyDeteriorationExpanded: false,
    nursingBundleComplianceEnabled: false,
    nursingBundleComplianceExpanded: false,
    nursingCdiResponseEnabled: false,
    nursingCdiResponseExpanded: false,
    nursingDocCompletionEnabled: false,
    nursingDocCompletionExpanded: false,
    // R-IA-2 / R-IA-3 curated qualitative driver defaults
    opThirdNextAvailableEnabled: false,
    opThirdNextAvailableExpanded: false,
    opSameDayAccessEnabled: false,
    opSameDayAccessExpanded: false,
    opPanelSizePerProviderEnabled: false,
    opPanelSizePerProviderExpanded: false,
    opAfterHoursDocEnabled: false,
    opAfterHoursDocExpanded: false,
    opNotesBeforeLeavingEnabled: false,
    opNotesBeforeLeavingExpanded: false,
    opBurnoutTrackingEnabled: false,
    opBurnoutTrackingExpanded: false,
    opEmLevelDistributionEnabled: false,
    opEmLevelDistributionExpanded: false,
    opFirstPassClaimRateEnabled: false,
    opFirstPassClaimRateExpanded: false,
    opCgCahpsEnabled: false,
    opCgCahpsExpanded: false,
    edDoorToProviderEnabled: false,
    edDoorToProviderExpanded: false,
    edEncountersPerShiftEnabled: false,
    edEncountersPerShiftExpanded: false,
    edAfterHoursDocEnabled: false,
    edAfterHoursDocExpanded: false,
    edEndOfShiftCompletionEnabled: false,
    edEndOfShiftCompletionExpanded: false,
    edBurnoutTrackingEnabled: false,
    edBurnoutTrackingExpanded: false,
    edLikelihoodToStayEnabled: false,
    edLikelihoodToStayExpanded: false,
    edEmLevelDistributionEnabled: false,
    edEmLevelDistributionExpanded: false,
    edCdiQueryAdmissionsEnabled: false,
    edCdiQueryAdmissionsExpanded: false,
    edDowncodingRateEnabled: false,
    edDowncodingRateExpanded: false,
    ipDocumentationLagEnabled: false,
    ipDocumentationLagExpanded: false,
    ipDischargeGoalDocEnabled: false,
    ipDischargeGoalDocExpanded: false,
    ipAfterHoursDocEnabled: false,
    ipAfterHoursDocExpanded: false,
    ipProgressNoteCompletionEnabled: false,
    ipProgressNoteCompletionExpanded: false,
    ipBurnoutTrackingEnabled: false,
    ipBurnoutTrackingExpanded: false,
    ipLikelihoodToStayEnabled: false,
    ipLikelihoodToStayExpanded: false,
    ipCcMccCaptureEnabled: false,
    ipCcMccCaptureExpanded: false,
    ipCdiQueryTrendEnabled: false,
    ipCdiQueryTrendExpanded: false,
    nursingDocumentationLagEnabled: false,
    nursingDocumentationLagExpanded: false,
    nursingPointOfCareDocEnabled: false,
    nursingPointOfCareDocExpanded: false,
    nursingLikelihoodToStayEnabled: false,
    nursingLikelihoodToStayExpanded: false,
    nursingBurnoutEnabled: false,
    nursingBurnoutExpanded: false,
    nursingChartingAfterShiftEnabled: false,
    nursingChartingAfterShiftExpanded: false,
    opDocTimePerNoteEnabled: false,
    opDocTimePerNoteExpanded: false,
    edDocTimePerEncounterEnabled: false,
    edDocTimePerEncounterExpanded: false,
    ipDocTimeHnpEnabled: false,
    ipDocTimeHnpExpanded: false,
    ipDocTimeProgressNoteEnabled: false,
    ipDocTimeProgressNoteExpanded: false,
    ipDocTimeConsultNoteEnabled: false,
    ipDocTimeConsultNoteExpanded: false,
    ipDocTimeDischargeEnabled: false,
    ipDocTimeDischargeExpanded: false,
    nursingDocTimePerEventEnabled: false,
    nursingDocTimePerEventExpanded: false,
    scribeCostReductionEnabled: false,
    scribeCostReductionExpanded: false,
    opPriorAuthP2PEnabled: false,
    opPriorAuthP2PExpanded: false,
    opClaimsReworkTimeEnabled: false,
    opClaimsReworkTimeExpanded: false,
    opNoteCompletenessEnabled: false,
    opNoteCompletenessExpanded: false,
    opReferralDocQualityEnabled: false,
    opReferralDocQualityExpanded: false,
    edDoorToDispositionEnabled: false,
    edDoorToDispositionExpanded: false,
    edClaimsReworkTimeEnabled: false,
    edClaimsReworkTimeExpanded: false,
    edNoteCompletenessEnabled: false,
    edNoteCompletenessExpanded: false,
    edSepsisBundleEnabled: false,
    edSepsisBundleExpanded: false,
    ipLengthOfStayEnabled: false,
    ipLengthOfStayExpanded: false,
    ipDischargeSummaryTimelinessEnabled: false,
    ipDischargeSummaryTimelinessExpanded: false,
    ipClaimsReworkTimeEnabled: false,
    ipClaimsReworkTimeExpanded: false,
    ipPoaDocRateEnabled: false,
    ipPoaDocRateExpanded: false,
    ipNoteCompletenessEnabled: false,
    ipNoteCompletenessExpanded: false,
  },
  otherFinancialBenefits: [],
  costDisplacementItems: [],
  // Documentation quality inputs
  docQualityInputs: {
    wrvuEnabled: false,
    wrvuScenario: 'typical',
    wrvuCustomPercent: 5,
    currentWrvu: 1.8,
    conversionFactor: 33.40, // 2026 Medicare conversion factor (was 33)
    wrvuRealization: 75,
    hccEnabled: false,
    hccPlans: [{
      id: 'plan-ma',
      planType: 'medicare_advantage' as const,
      name: 'Medicare Advantage',
      panelSize: 0, // SCALE input — blank until the partner enters their panel; no fabricated lives/dollar from a default
      valuePerHcc: 1500,
      gapRate: 65,
      currentRecaptureRate: 65,
      uplift: 'typical' as const,
      netNewEnabled: true,
      netNewDiscoveryRate: 3, // legacy, unused by the clean engine model
      netNewAvgConditions: 0.05, // newly identified HCCs per member (net-new, surfaced in the visit)
    }],
    avgHccs: 2.5, // avg documented chronic conditions (HCCs) per member; MA runs ~2.5-3.5. The recapture-rate lift applies to this base.
    hccRealization: 50,
    denialsEnabled: false,
    denialsScenario: 'typical',
    denialsCustomPercent: 15,
    medNecessityDenialRate: 3,
    denialsAnnualClaims: 0,
    avgClaimValue: 200,
    denialsRealization: 60,
    // Inpatient: DRG Accuracy defaults
    ipDrgEnabled: false,
    ipDrgScenario: 'typical',
    ipDrgCustomPercent: 20,
    ipDrgAtRiskRate: 18, // legacy, unused by the clean CMI model
    ipDrgCdiReviewRate: 60, // CDI reviews 60% of discharges
    ipDrgQueryRate: 10, // 10% of reviewed charts get a query
    ipDrgResponseRate: 70, // physician answers 70% of queries
    ipDrgChangeRate: 60, // 60% of responses change the DRG
    ipDrgUpfrontCapture: 33, // durable share Abridge captures of the flagged-but-lost queries (lands up front AND holds up under audit)
    ipDrgWeightGain: 0.4, // avg weight gained on a case that moves up a tier
    ipDrgBaseRate: 7000, // $7,000 blended base payment per weight unit
    ipDrgWeightIncrease: 0.03, // legacy (Attain/Intake); not used by the funnel engine
    ipDrgBasePayment: 6000, // legacy (Attain/Intake); not used by the funnel engine
    ipDrgRealization: 65, // audit survival: share of the DRG change that holds up under RAC/PEPPER
    ipDrgCurrentCmi: 1.5, // current Case Mix Index (context)
    // Inpatient: Status / Medical Necessity Denials defaults
    ipObsDefenseEnabled: false,
    ipObsDefenseExpanded: false,
    ipObsDenialRate: 5,             // 5% of admissions denied
    ipObsAllowedPerCase: 10000,     // $10k allowed reimbursement per case
    ipObsNotRecoveredPct: 30,       // 30% not recovered
    ipObsDocMaterialPct: 40,        // 40% where documentation is material
    ipObsAbridgeOpportunityPct: 75, // Abridge in 75% of workflows
    ipObsAbridgeImpactPct: 40,      // Abridge moves 40%
    // Inpatient: CDI Query Reduction defaults
    ipCdiEnabled: false,
    ipCdiScenario: 'typical',
    ipCdiCustomPercent: 25,
    ipCdiQueryRate: 30, // 30% of admissions generate queries
    ipCdiCostPerQuery: 50, // $50 per query
    ipCdiRealization: 75,
    // Nursing: HAPI Prevention defaults
    nursingHapiEnabled: false,
    nursingHapiRate: 2.5, // 2.5 per 1,000 patient days
    nursingHapiPreventionRate: 6.5, // 6.5% - half of 13% observed in Dowding et al. (JAMIA 2012)
    nursingHapiCost: 25000, // $25,000 per HAPI
    // Nursing: Falls Prevention defaults
    nursingFallsEnabled: false,
    nursingFallsRate: 3.5, // 3.5 per 1,000 patient days
    nursingFallsPreventionRate: 10, // 10% documentation timeliness gap rate
    nursingFallsCost: 6500, // $6,500 per fall
    // Nursing: HAC Penalty Avoidance defaults
    nursingHacEnabled: false,
    nursingHacBottomQuartile: false,
    nursingHacMedicareRevenue: 50000000,
    // Nursing: Patient Experience defaults
    nursingHcahpsEnabled: false,
    nursingCautiEnabled: false,
    nursingCautiUtilizationRatio: 30,
    nursingCautiRate: 1.8,
    nursingCautiPreventionRate: 12,
    nursingCautiCost: 13000,
    nursingCautiExpanded: false,
    nursingClabsiEnabled: false,
    nursingClabsiUtilizationRatio: 20,
    nursingClabsiRate: 0.8,
    nursingClabsiPreventionRate: 8,
    nursingClabsiCost: 32000, // mid of the CDC $20K-45K range (was floor $20K, which double-stacked conservatism with the low prevention rate)
    nursingClabsiExpanded: false,
    nursingSepsisEnabled: false,
    nursingSepsisRatePerThousand: 2.0,
    nursingSepsisCurrentCompliance: 75,
    nursingSepsisDocLagPercent: 30,
    nursingSepsisExcessCostPerCase: 3500,
    nursingSepsisRealization: 60,
    nursingSepsisExpanded: false,
    // Expanded states (auto-expand when first toggled on)
    wrvuExpanded: false,
    hccExpanded: false,
    denialsExpanded: false,
    ipDrgExpanded: false,
    ipCdiExpanded: false,
    nursingHapiExpanded: false,
    nursingFallsExpanded: false,
    nursingHacExpanded: false,
    nursingHcahpsExpanded: false,
  },
  pricingModel: 'perProvider',
  costPerProvider: 0,
  costPerEncounter: 0,
  annualLicenseFee: 0,
  platformEncRate: 0,
  implementationFee: 25000,
  includeImplementation: false,
  fullScaleProviders: 500,
  year2GrowthPercent: 10,
  year3GrowthPercent: 10,
  // Retention is tracked (shown as signals, kept out of the ROI) by default; a
  // finance audience can flip it to "counted" to fold in replacement-cost value.
  retentionMode: "tracked",
};

export type ExplorePhase =
  | 'careSetting'
  | 'practice' 
  | 'timeSavings' 
  | 'capacity'
  | 'workforce'
  | 'revenue'
  | 'quality'
  | 'investment'
  | 'model';

const LEGACY_PHASE_MAP: Record<string, ExplorePhase> = {
  valueDrivers: 'capacity',
  docQuality: 'revenue',
  careQuality: 'quality',
};

/**
 * Single source of truth for turning a requested phase (from navigate, the
 * browser popstate handler, or the initial-phase prop) into the phase we
 * actually show. Applies the legacy alias map AND, when editing an existing
 * proforma setting, hides the expansion ('investment') page — the proforma
 * owns deployment, so that page is irrelevant on an edit and its output is
 * discarded on merge. Every setPhase path funnels through here so the page
 * can't sneak back via Next, a breadcrumb step, OR browser back/forward.
 */
export function resolveExplorePhase(requested: string, editing: boolean): ExplorePhase {
  const mapped = (LEGACY_PHASE_MAP[requested] ?? requested) as ExplorePhase;
  return (editing && mapped === 'investment') ? 'model' : mapped;
}

