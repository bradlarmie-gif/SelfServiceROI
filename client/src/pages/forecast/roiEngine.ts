import {
  computeAllDriverValues,
  computeAllDriverCalcSummaries,
} from "@/lib/exploreDriverCalcs";
import {
  DEFAULT_EXPLORE_STATE,
  type ExploreState,
  type ExploreCareSetting,
} from "@/pages/explore/exploreState";

/**
 * ROI Calculator engine adapter.
 *
 * The ROI Calculator used to run an invented, hand-rolled lever set that did
 * NOT match the canonical Explore engine (it even put HCC in the ED and used a
 * home-grown capacity lever instead of Patient Access). This adapter deletes
 * that fork: every dollar the calculator shows is now produced by the SAME
 * `computeAllDriverValues` engine the Explore path uses, so the two paths
 * reconcile by construction.
 *
 * The design:
 *   - a per-setting DRIVER REGISTRY of the engine's real drivers, each with the
 *     editable fields it exposes and an `applyToState` that writes those fields
 *     onto a real `ExploreState`;
 *   - `buildRoiState` maps the calculator's simple account inputs onto an
 *     `ExploreState` and applies every enabled driver;
 *   - `runRoi` runs the canonical engine on that state and returns the per-driver
 *     dollar values, the engine's own "shows its work" calc-summary strings, the
 *     per-quadrant totals, and the grand total.
 *
 * Because the displayed per-driver dollar comes straight from
 * `computeAllDriverValues` (never a re-implemented formula) and the worked-math
 * string comes straight from `computeAllDriverCalcSummaries`, the number and its
 * arithmetic can never disagree — and can never disagree with Explore.
 */

export type SettingKey = "outpatient" | "ed" | "inpatient" | "nursing";
export type Domain = "Capacity" | "Workforce" | "Revenue" | "Quality";

/**
 * How a practice is paid for this driver.
 *   "ffs" — fee for service: you bill the visit, so coding accuracy is the lever.
 *   "vbc" — value based: you are paid on the risk of the panel, so capture is.
 * Untagged drivers (denials, capacity, workforce, quality) apply either way.
 * A practice that is purely one or the other should never be shown the other's
 * card, let alone a dead $0 one it has no data for.
 */
export type PayerModel = "ffs" | "vbc";

export interface RoiField {
  k: string;
  label: string;
  hint?: string;
  def: number;
  prefix?: string;
  suffix?: string;
  step?: number;
  /**
   * A "how much of this actually sticks" haircut (payer mix, downcoding, audit
   * survival, appeals). It is the least intuitive thing on the page for a
   * practice sizing itself, so the screen does not ask for it: the calibrated
   * default is applied, shown inside the worked math, and the difference
   * between the haircut and the full amount is presented as a range instead.
   */
  realization?: true;
}

/** A measured before -> after pair, rendered with the editorial BeforeAfter input. */
export interface RoiBeforeAfter {
  label: string;
  table?: string;
  unit?: string;
  step?: number;
  lowerIsBetter?: boolean;
  beforeK: string;
  afterK: string;
  beforeDef: number;
  afterDef: number;
}

export interface RoiPopulation {
  label: string;
  perHcc: number;
}

export interface RoiCtx {
  setting: SettingKey;
  /** Providers on Abridge today (the constant used for per-provider HCC panel). */
  baseProviders: number;
}

export interface RoiDriver {
  /**
   * This driver's value is derived from another driver's pool, so it cannot be
   * counted on its own. Switching the parent off must switch this off too: the
   * ED admission margin comes from LWBS patients who were recovered, so booking
   * it while the practice has said those patients are NOT recovered counts a
   * dollar off a population they just told us does not exist.
   */
  dependsOn?: string;
  /** Engine driver id — the key into computeAllDriverValues / calc summaries. */
  id: string;
  domain: Domain;
  title: string;
  optional?: boolean;
  /** Only shown when the practice is paid this way. Untagged = shown either way. */
  payerModel?: PayerModel;
  /**
   * Needs a team of at least this many clinicians to be a real lever.
   * Retention and locum cover model replacing someone who leaves. A solo
   * doctor cannot backfill themselves: if they burn out the practice closes,
   * and there is no agency line to avoid. Offering these to one or two people
   * is the moment they can tell the tool was not built for them.
   */
  minClinicians?: number;
  /**
   * Why this driver does not count the whole amount, in the practice's own
   * words. Three different things are going on underneath (attribution on wRVU
   * and sepsis, conversion on LWBS and admissions, realization on denials, HCC
   * and status) and a doctor should not have to learn three vocabulary words to
   * read a number. The math says "x N% counted" everywhere; this line says why.
   */
  haircutReason?: string;
  note?: string;
  /** Special renderer: 'hcc' draws the bespoke HccCard. */
  kind?: "hcc";
  populations?: RoiPopulation[];
  beforeAfter?: RoiBeforeAfter;
  fields: RoiField[];
  /** Writes this driver's editable values (+ its enable flag) onto a real ExploreState. */
  applyToState: (state: ExploreState, v: Record<string, number>, ctx: RoiCtx) => void;
  /**
   * Optional clean "show the work" string that reads in the practice's before/after
   * idiom instead of the engine's scenario-% phrasing. MUST multiply out to the
   * same value the engine returns (the displayed dollar always comes from the
   * engine). Used where the engine summary would leak an ugly derived float.
   */
  work?: (v: Record<string, number>, eligibleEncounters: number) => string;
}

export interface RoiAccount {
  totalProviders: number;
  onAbridge: number;
  encPerProvider: number;
  utilNow: number;
  /** Documentation minutes saved per encounter (before - after). Feeds Patient Access. */
  minutesSaved: number;
  /** Nursing only. */
  staffedBeds?: number;
  occupancy?: number;
}

export interface RoiScale {
  adoptionPct: number;
  utilPct: number;
}

export interface SettingMeta {
  label: string;
  blurb: string;
  providerWord: string;
  /**
   * What the reader calls the thing they are sizing. An outpatient physician
   * has a "practice"; an ED or hospitalist reader has a "group"; a nursing
   * reader has a "unit". Saying "practice" to all four is the reused-copy bug.
   */
  orgWord: string;
  encWord: string;
  visitWord: string;
  isNursing?: boolean;
  defaults: {
    totalProviders: number;
    onAbridge: number;
    encPerProvider: number;
    utilNow: number;
    staffedBeds?: number;
    occupancy?: number;
  };
  /** The verb that fits this setting: clinicians see visits, nurses document care events. */
  volumeVerb?: string;
  /** Example value for the annual-volume question, in this setting's own units. */
  volumePlaceholder?: string;
  /** Extra clarification under the annual-volume question, where it is ambiguous. */
  volumeHint?: string;
  /** Example name for this setting, so a nursing unit is not offered a clinic name. */
  namePlaceholder?: string;
  /** OP/ED/IP show a reclaimed-documentation-time metric (also feeds minutesSaved). */
  timeMetric?: { before: number; after: number; table: string };
}

const HCC_POPULATIONS: RoiPopulation[] = [
  { label: "Medicare Advantage", perHcc: 1500 },
  { label: "Medicaid MCO", perHcc: 900 },
  { label: "ACA / Exchange", perHcc: 1100 },
];

const td = (s: ExploreState) => s.timeDriverInputs as any;
const dq = (s: ExploreState) => s.docQualityInputs as any;

// ─── Reusable driver factories ──────────────────────────────────────────────

/**
 * The measured wRVU lift, clamped. The engine expresses lift as a PERCENT of
 * the current wRVU (currentWrvu × custom%/100), so a before of 0 can't express
 * an absolute lift and a before ≥ after is not a lift. Both the engine input
 * and the printed "work" string derive from THIS single value, so the shown
 * arithmetic and the displayed dollar can never disagree (the bug where a
 * before > after showed "0.00 lift" but produced a negative dollar).
 */
const codingLift = (before: number, after: number) =>
  before > 0 && after > before ? after - before : 0;

/** Coding accuracy: OP emits `wrvu`, ED emits `edEmLevel`. Same fields + math. */
const codingDriver = (id: "wrvu" | "edEmLevel", beforeDef: number, afterDef: number, title = "Coding accuracy"): RoiDriver => {
  // the worked math must call the volume what the rest of the setting calls it
  const encNoun = id === "edEmLevel" ? "ED visits" : "visits";
  return {
  payerModel: "ffs",
  haircutReason: "Coding education and CDI move this too, so we credit the note with part of it, not all of it.",
  id,
  domain: "Revenue",
  title,
  beforeAfter: {
    label: "wRVU / visit",
    table: "your billing report",
    unit: "wRVU",
    step: 0.01,
    beforeK: "wrvuBefore",
    afterK: "wrvuAfter",
    beforeDef,
    afterDef,
  },
  fields: [
    { k: "cf", label: "What you are paid per wRVU", def: 33.4, hint: "the 2026 Medicare conversion factor, change it to your own rate", prefix: "$", step: 0.01 },
    { k: "wrvuRealization", realization: true, label: "Share you would credit to the note", def: 75, hint: "coding education and CDI move this too, so we do not claim all of it", suffix: "%" },
  ],
  applyToState: (s, v) => {
    const d = dq(s);
    d.wrvuEnabled = true;
    const before = v.wrvuBefore;
    const lift = codingLift(before, v.wrvuAfter);
    d.currentWrvu = before;
    d.wrvuScenario = "custom";
    // Feed the CLAMPED lift through the engine's %-lift knob so the engine's own
    // lift = currentWrvu x custom% / 100 = clamped(after - before). No negatives.
    d.wrvuCustomPercent = before > 0 ? (lift / before) * 100 : 0;
    d.conversionFactor = v.cf;
    d.wrvuRealization = v.wrvuRealization;
  },
  // Reads the measured lift directly (0.08), not "1.95 × 4.1025…% lift".
  // Uses the SAME clamped lift the engine input uses, so string == dollar.
  work: (v, enc) => {
    const lift = codingLift(v.wrvuBefore ?? 0, v.wrvuAfter ?? 0);
    // two decimals in both places: the field shows 33.40, so must the math
    const cf = `$${v.cf.toFixed(2)}`;
    return `${enc.toLocaleString("en-US")} ${encNoun} × ${lift.toFixed(2)} wRVU lift (${v.wrvuBefore} → ${v.wrvuAfter}) × ${cf}/wRVU × ${v.wrvuRealization}% counted`;
  },
  };
};

const denialDriver = (denialsCustomDef: number): RoiDriver => ({
  id: "denialPrevention",
  haircutReason: "An overturned denial does not always get paid in full, so we count a share of it.",
  domain: "Revenue",
  title: "Medical necessity denials",
  fields: [
    { k: "medNecessityDenialRate", label: "Medical-necessity denial rate today", def: 3, suffix: "%", step: 0.1 },
    { k: "denialsCustomPercent", label: "Share of those a fuller note could head off", def: denialsCustomDef, hint: "only the ones that turn on documentation, not all denials", suffix: "%" },
    { k: "avgClaimValue", label: "Average claim value", def: 200, prefix: "$" },
    { k: "denialsRealization", realization: true, label: "How much of this you would actually keep", def: 60, hint: "not every overturned denial gets paid in full", suffix: "%" },
  ],
  applyToState: (s, v) => {
    const d = dq(s);
    d.denialsEnabled = true;
    d.denialsScenario = "custom";
    d.denialsCustomPercent = v.denialsCustomPercent;
    d.medNecessityDenialRate = v.medNecessityDenialRate;
    d.avgClaimValue = v.avgClaimValue;
    d.denialsRealization = v.denialsRealization;
  },
});

const providerWellbeingDriver: RoiDriver = {
  id: "providerWellbeing",
  minClinicians: 3,
  domain: "Workforce",
  title: "Retention (burnout)",
  optional: true,
  note: "The softest number here: it rests on what replacing someone costs, which is always arguable. Off by default. Turn it on only if you believe it.",
  fields: [
    { k: "turnover", label: "Annual provider turnover", def: 6, suffix: "%", step: 0.1 },
    { k: "burnout", label: "Share of turnover that is burnout-related", def: 40, suffix: "%" },
    { k: "impact", label: "Reduction in burnout turnover where Abridge is used", def: 30, suffix: "%" },
    { k: "replacementCost", label: "Cost to replace one provider", def: 400000, prefix: "$" },
  ],
  applyToState: (s, v, ctx) => {
    const t = td(s);
    t.wellbeingEnabled = true;
    t.calculateRetentionValue = true;
    t.retentionImpactScenario = "custom";
    t.retentionCustomPercent = v.impact;
    if (ctx.setting === "inpatient") {
      t.ipAnnualTurnoverRate = v.turnover;
      t.ipBurnoutRelatedTurnover = v.burnout;
      t.ipReplacementCost = v.replacementCost;
    } else {
      t.annualTurnoverRate = v.turnover;
      t.burnoutRelatedTurnover = v.burnout;
      t.replacementCost = v.replacementCost;
    }
  },
};

const physicianAgencyDriver: RoiDriver = {
  id: "physicianLocumAgency",
  minClinicians: 3,
  domain: "Workforce",
  title: "Locum / agency avoided",
  optional: true,
  note: "Each departure avoided also avoids the locum premium it takes to cover the vacancy.",
  fields: [
    { k: "agencyWeeks", label: "Weeks a vacancy runs on locum coverage", def: 16 },
    { k: "agencyPremium", label: "Locum premium per week", def: 5000, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const t = td(s);
    t.physicianAgencyEnabled = true;
    t.physicianAgencyWeeksPerVacancy = v.agencyWeeks;
    t.physicianAgencyWeeklyPremium = v.agencyPremium;
  },
};

const scribeDriver: RoiDriver = {
  id: "scribeCostReduction",
  domain: "Workforce",
  title: "Scribe cost reduction",
  optional: true,
  note: "Only if you would actually stop paying for scribes you use today.",
  fields: [
    { k: "scribeHeadcount", label: "Scribe positions today", def: 0 },
    { k: "scribePositionsEliminated", label: "Scribe positions you could retire", def: 0 },
    { k: "scribeCostPerPosition", label: "Fully-loaded cost per scribe position", def: 45000, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const t = td(s);
    t.scribeCostReductionEnabled = true;
    t.scribeBillingMode = "position";
    t.scribeHeadcount = v.scribeHeadcount;
    t.scribePositionsEliminated = v.scribePositionsEliminated;
    t.scribeCostPerPosition = v.scribeCostPerPosition;
  },
};

const hccDriver: RoiDriver = {
  payerModel: "vbc",
  id: "hccCapture",
  haircutReason: "Risk adjustment gets audited hard, so we count only the share that would hold up.",
  domain: "Revenue",
  title: "Risk capture (HCC)",
  optional: true,
  kind: "hcc",
  populations: HCC_POPULATIONS,
  // Same recapture-rate model the Explore path uses (tuned there): members ×
  // conditions-carried × recapture-rate LIFT (capped by the remaining gap) ×
  // $/HCC + net-new, then × realization. Not a hand-rolled "HCC/member before→
  // after" — so the two paths reconcile and the number holds up.
  fields: [
    { k: "hccMembers", label: "Risk-adjusted members Abridge covers", def: 0 },
    { k: "hccAvg", label: "Documented conditions (HCCs) each member carries", def: 2.5, step: 0.1, hint: "MA panels run about 2.5 to 3.5" },
    { k: "hccRecaptureNow", label: "Share recaptured today", def: 65, suffix: "%", hint: "how many of those conditions get coded each year now" },
    { k: "hccRecaptureLift", label: "Recapture-rate lift with Abridge", def: 5, suffix: "pp", hint: "percentage points, capped by the remaining gap" },
    { k: "hccNetNew", label: "Net-new HCCs surfaced per member", def: 0.05, step: 0.01, hint: "conditions surfaced in the visit that weren't coded before" },
    { k: "hccPerHcc", label: "Value per HCC captured (RAF)", def: 1500, prefix: "$" },
    { k: "hccRealization", realization: true, label: "How much of this survives an audit", def: 50, hint: "risk adjustment is audited hard, so this is deliberately low", suffix: "%" },
  ],
  applyToState: (s, v, ctx) => {
    const d = dq(s);
    d.hccEnabled = true;
    d.avgHccs = v.hccAvg;
    d.hccRealization = v.hccRealization;
    // members = numberOfProviders × panelSize; panel is per-provider so the
    // engine scales members with adoption.
    const panelSize = ctx.baseProviders > 0 ? v.hccMembers / ctx.baseProviders : 0;
    d.hccPlans = [
      {
        id: "plan-ma",
        planType: "medicare_advantage",
        name: "Risk-adjusted panel",
        panelSize,
        valuePerHcc: v.hccPerHcc,
        gapRate: v.hccRecaptureNow,
        currentRecaptureRate: v.hccRecaptureNow,
        uplift: "custom",
        upliftCustomPp: v.hccRecaptureLift,
        netNewEnabled: v.hccNetNew > 0,
        netNewDiscoveryRate: 0,
        netNewAvgConditions: v.hccNetNew,
      },
    ];
  },
};

const patientAccessDriver: RoiDriver = {
  id: "patientAccess",
  domain: "Capacity",
  title: "Patient access (reclaimed capacity)",
  note: "Extra visits you could take on once notes stop running late. Put in what you think is realistic, and we will show how much of your reclaimed time it uses up.",
  // The partner is live, so they OBSERVE their added visits — we count that
  // directly (visits/provider/wk) rather than assuming a % of freed time gets
  // reinvested. The card reads back what share of the reclaimed hours it uses.
  fields: [
    { k: "accessVisitsPerProvWk", label: "Added visits per clinician, each week", def: 0, step: 0.5, hint: "only what the freed-up time could realistically absorb" },
    { k: "visitDuration", label: "Average visit length", def: 30, hint: "how long a typical visit takes in your practice", suffix: "min" },
    { k: "revenuePerVisit", label: "Margin per added visit", def: 200, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const t = td(s);
    t.patientAccessEnabled = true;
    t.accessProviders = 0; // everyone on Abridge
    t.patientAccessVisitsPerProvWk = v.accessVisitsPerProvWk;
    // Zero the assumed-reinvest fallback: with no observed visits entered, the
    // value stays $0 (no fabricated number) rather than deriving one from a 25%
    // assumption. The rep enters what they see.
    t.capacityRealizationPercent = 0;
    t.visitDuration = v.visitDuration;
    t.revenuePerVisit = v.revenuePerVisit;
  },
};

const lwbsDriver: RoiDriver = {
  id: "lwbsRecovery",
  haircutReason: "Not every patient who stays goes on to complete a billable visit.",
  // Recovered visits and their margin are revenue, not a time signal. Kept in
  // Revenue so the ED Capacity tab is a pure "time given back" proof card, like
  // inpatient, instead of mixing counted dollars under a "not counted" header.
  domain: "Revenue",
  title: "LWBS recovery",
  fields: [
    { k: "edLwbsRate", label: "Left-without-being-seen rate today", def: 3, suffix: "%", step: 0.1 },
    { k: "edLwbsReduction", label: "Reduction in LWBS", def: 10, suffix: "%" },
    { k: "edRevenuePerVisit", label: "Margin per recovered visit", def: 480, prefix: "$" },
    { k: "edLwbsRealization", realization: true, label: "Share that becomes a billable visit", def: 50, hint: "not every patient who stays completes a billable visit", suffix: "%" },
  ],
  applyToState: (s, v) => {
    const t = td(s);
    t.edLwbsEnabled = true;
    t.edLwbsRate = v.edLwbsRate;
    t.edLwbsReduction = v.edLwbsReduction;
    t.edRevenuePerVisit = v.edRevenuePerVisit;
    t.edLwbsRealization = v.edLwbsRealization;
  },
};

const admissionDriver: RoiDriver = {
  id: "admissionCapture",
  haircutReason: "Bed availability decides some of these, not documentation.",
  dependsOn: "lwbsRecovery",
  domain: "Revenue",
  title: "Admission capture",
  optional: true,
  note: "A share of recovered LWBS patients are admitted, capturing the admission margin too.",
  fields: [
    { k: "edAdmissionRate", label: "Share of recovered patients admitted", def: 18, suffix: "%" },
    { k: "edAdmissionRevenue", label: "Margin per admission", def: 4000, prefix: "$" },
    { k: "edAdmissionRealization", realization: true, label: "Share that converts to an admission", def: 75, hint: "bed availability decides some of this, not documentation", suffix: "%" },
  ],
  applyToState: (s, v) => {
    const t = td(s);
    // Admission capture rides on LWBS recovery (recovered patients are the pool).
    t.edLwbsEnabled = true;
    t.edThroughputEnabled = true;
    t.edAdmissionRate = v.edAdmissionRate;
    t.edAdmissionRevenue = v.edAdmissionRevenue;
    t.edAdmissionRealization = v.edAdmissionRealization;
  },
};

const drgDriver: RoiDriver = {
  id: "drgAccuracy",
  domain: "Revenue",
  title: "DRG accuracy (CMI)",
  // The query-funnel model. A custom card in the ROI calc renders these as the
  // before→after funnel; the value is the delta on the cases the funnel misses.
  fields: [
    { k: "ipDrgCdiReviewRate", label: "Reviewed by CDI", def: 60, suffix: "%" },
    { k: "ipDrgQueryRate", label: "Query issued", def: 10, suffix: "%" },
    { k: "ipDrgResponseRate", label: "Physician responds", def: 70, suffix: "%" },
    { k: "ipDrgChangeRate", label: "Response changes the DRG", def: 60, suffix: "%" },
    { k: "ipDrgUpfrontCapture", label: "Captured by Abridge (durable)", def: 33, suffix: "%" },
    { k: "ipDrgWeightGain", label: "Weight gained per case", def: 0.4, step: 0.05 },
    { k: "ipDrgBaseRate", label: "Base payment per weight", def: 7000, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const d = dq(s);
    d.ipDrgEnabled = true;
    d.ipDrgCdiReviewRate = v.ipDrgCdiReviewRate;
    d.ipDrgQueryRate = v.ipDrgQueryRate;
    d.ipDrgResponseRate = v.ipDrgResponseRate;
    d.ipDrgChangeRate = v.ipDrgChangeRate;
    d.ipDrgUpfrontCapture = v.ipDrgUpfrontCapture;
    d.ipDrgWeightGain = v.ipDrgWeightGain;
    d.ipDrgBaseRate = v.ipDrgBaseRate;
  },
};

const obsDriver: RoiDriver = {
  id: "obsDefense",
  domain: "Revenue",
  title: "Status / medical necessity denials",
  fields: [
    { k: "ipObsDefenseDenialRate", label: "Admissions downgraded to observation today", def: 5, suffix: "%", step: 0.1 },
    { k: "ipObsDefenseCustomPercent", label: "Share the note can defend", def: 40, suffix: "%" },
    { k: "ipObsDefenseRevenueDelta", label: "Revenue delta per defended case", def: 5000, prefix: "$" },
    { k: "ipObsDefenseRealization", realization: true, label: "How much of this survives appeal", def: 50, hint: "some of these get overturned back against you", suffix: "%" },
  ],
  applyToState: (s, v) => {
    const d = dq(s);
    d.ipObsDefenseEnabled = true;
    d.ipObsDefensePreventableScenario = "custom";
    d.ipObsDefenseCustomPercent = v.ipObsDefenseCustomPercent;
    d.ipObsDefenseDenialRate = v.ipObsDefenseDenialRate;
    d.ipObsDefenseRevenueDelta = v.ipObsDefenseRevenueDelta;
    d.ipObsDefenseRealization = v.ipObsDefenseRealization;
  },
};

const nursingOvertimeDriver: RoiDriver = {
  id: "nursingOvertime",
  domain: "Capacity",
  title: "Overtime avoided",
  note: "Reclaimed charting time that would otherwise be paid as overtime.",
  fields: [
    { k: "nursingOtHoursPerNurseWeek", label: "OT hours per nurse per week", def: 1.0, step: 0.1 },
    { k: "nursingOtReductionPercent", label: "Reduction from Abridge", def: 40, suffix: "%" },
    { k: "nursingOtHourlyRate", label: "Blended overtime rate per hour", def: 75, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const t = td(s);
    t.nursingOtEnabled = true;
    t.nursingOtHoursPerNurseWeek = v.nursingOtHoursPerNurseWeek;
    t.nursingOtReductionPercent = v.nursingOtReductionPercent;
    t.nursingOtHourlyRate = v.nursingOtHourlyRate;
  },
};

const nursingRetentionDriver: RoiDriver = {
  id: "nursingRetention",
  minClinicians: 3,
  domain: "Workforce",
  title: "Retention (burnout)",
  optional: true,
  note: "The softest number here: it rests on what replacing someone costs, which is always arguable. Off by default. Turn it on only if you believe it.",
  fields: [
    { k: "nursingTurnoverRate", label: "Annual nurse turnover", def: 18, suffix: "%", step: 0.1 },
    { k: "nursingBurnout", label: "Share of turnover that is burnout-related", def: 40, suffix: "%" },
    { k: "impact", label: "Reduction in burnout turnover where Abridge is used", def: 30, suffix: "%" },
    { k: "nursingReplacementCost", label: "Cost to replace one nurse", def: 56300, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const t = td(s);
    t.nursingRetentionEnabled = true;
    t.retentionImpactScenario = "custom";
    t.retentionCustomPercent = v.impact;
    t.nursingTurnoverRate = v.nursingTurnoverRate;
    t.nursingBurnoutRelatedTurnover = v.nursingBurnout;
    t.nursingReplacementCost = v.nursingReplacementCost;
  },
};

const nursingAgencyDriver: RoiDriver = {
  id: "nursingAgency",
  minClinicians: 3,
  domain: "Workforce",
  title: "Agency avoided",
  optional: true,
  note: "Each nurse retained also avoids the agency premium it takes to cover the vacancy.",
  fields: [
    { k: "nursingAgencyWeeksPerVacancy", label: "Weeks a vacancy runs on agency coverage", def: 12 },
    { k: "nursingAgencyWeeklyPremium", label: "Agency premium per week", def: 2500, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const t = td(s);
    t.nursingAgencyEnabled = true;
    t.nursingAgencyWeeksPerVacancy = v.nursingAgencyWeeksPerVacancy;
    t.nursingAgencyWeeklyPremium = v.nursingAgencyWeeklyPremium;
  },
};

const nursingHapiDriver: RoiDriver = {
  id: "nursingHapi",
  domain: "Quality",
  title: "Pressure injuries (HAPI)",
  note: "Abridge surfaces the documentation sooner. Whether a case is actually avoided depends on your team acting on it, so treat this share as your own judgement rather than a figure we are putting to you. Off by default.",
  fields: [
    { k: "nursingHapiRate", label: "HAPI per 1,000 patient-days", def: 2.5, step: 0.1 },
    { k: "nursingHapiPreventionRate", label: "Share your team could avoid with earlier documentation", hint: "your judgement, not ours", def: 6.5, suffix: "%", step: 0.1 },
    { k: "nursingHapiCost", label: "Cost per HAPI", def: 25000, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const d = dq(s);
    d.nursingHapiEnabled = true;
    d.nursingHapiRate = v.nursingHapiRate;
    d.nursingHapiPreventionRate = v.nursingHapiPreventionRate;
    d.nursingHapiCost = v.nursingHapiCost;
  },
};

const nursingFallsDriver: RoiDriver = {
  id: "nursingFalls",
  domain: "Quality",
  title: "Falls",
  note: "Abridge surfaces the documentation sooner. Whether a case is actually avoided depends on your team acting on it, so treat this share as your own judgement rather than a figure we are putting to you. Off by default.",
  fields: [
    { k: "nursingFallsRate", label: "Falls per 1,000 patient-days", def: 3.5, step: 0.1 },
    { k: "nursingFallsPreventionRate", label: "Share your team could avoid with earlier documentation", hint: "your judgement, not ours", def: 10, suffix: "%", step: 0.1 },
    { k: "nursingFallsCost", label: "Cost per fall", def: 6500, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const d = dq(s);
    d.nursingFallsEnabled = true;
    d.nursingFallsRate = v.nursingFallsRate;
    d.nursingFallsPreventionRate = v.nursingFallsPreventionRate;
    d.nursingFallsCost = v.nursingFallsCost;
  },
};

const nursingCautiDriver: RoiDriver = {
  id: "nursingCauti",
  domain: "Quality",
  title: "CAUTI",
  note: "Abridge surfaces the documentation sooner. Whether a case is actually avoided depends on your team acting on it, so treat this share as your own judgement rather than a figure we are putting to you. Off by default.",
  fields: [
    { k: "nursingCautiUtilizationRatio", label: "Catheter days as % of patient-days", def: 30, suffix: "%" },
    { k: "nursingCautiRate", label: "CAUTI per 1,000 catheter-days", def: 1.8, step: 0.1 },
    { k: "nursingCautiPreventionRate", label: "Share your team could avoid with earlier documentation", hint: "your judgement, not ours", def: 12, suffix: "%", step: 0.1 },
    { k: "nursingCautiCost", label: "Cost per CAUTI", def: 13000, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const d = dq(s);
    d.nursingCautiEnabled = true;
    d.nursingCautiUtilizationRatio = v.nursingCautiUtilizationRatio;
    d.nursingCautiRate = v.nursingCautiRate;
    d.nursingCautiPreventionRate = v.nursingCautiPreventionRate;
    d.nursingCautiCost = v.nursingCautiCost;
  },
};

const nursingClabsiDriver: RoiDriver = {
  id: "nursingClabsi",
  domain: "Quality",
  title: "CLABSI",
  note: "Abridge surfaces the documentation sooner. Whether a case is actually avoided depends on your team acting on it, so treat this share as your own judgement rather than a figure we are putting to you. Off by default.",
  fields: [
    { k: "nursingClabsiUtilizationRatio", label: "Central-line days as % of patient-days", def: 20, suffix: "%" },
    { k: "nursingClabsiRate", label: "CLABSI per 1,000 line-days", def: 0.8, step: 0.1 },
    { k: "nursingClabsiPreventionRate", label: "Share your team could avoid with earlier documentation", hint: "your judgement, not ours", def: 8, suffix: "%", step: 0.1 },
    { k: "nursingClabsiCost", label: "Cost per CLABSI", def: 32000, prefix: "$" },
  ],
  applyToState: (s, v) => {
    const d = dq(s);
    d.nursingClabsiEnabled = true;
    d.nursingClabsiUtilizationRatio = v.nursingClabsiUtilizationRatio;
    d.nursingClabsiRate = v.nursingClabsiRate;
    d.nursingClabsiPreventionRate = v.nursingClabsiPreventionRate;
    d.nursingClabsiCost = v.nursingClabsiCost;
  },
};

const nursingSepsisDriver: RoiDriver = {
  id: "nursingSepsis",
  haircutReason: "The sepsis bundle is a whole-team response, so we credit the note with part of it.",
  domain: "Quality",
  title: "Sepsis (SEP-1)",
  fields: [
    { k: "nursingSepsisRatePerThousand", label: "Sepsis cases per 1,000 patient-days", def: 2.0, step: 0.1 },
    { k: "nursingSepsisCurrentCompliance", label: "SEP-1 bundle compliance today", def: 75, suffix: "%" },
    { k: "nursingSepsisDocLagPercent", label: "Doc-lag share of non-compliant cases", def: 30, suffix: "%" },
    { k: "nursingSepsisExcessCostPerCase", label: "Excess cost per case", def: 3500, prefix: "$" },
    { k: "nursingSepsisRealization", realization: true, label: "Share you would credit to the note", def: 60, hint: "the bundle is a whole-team response, so we do not claim all of it", suffix: "%" },
  ],
  applyToState: (s, v) => {
    const d = dq(s);
    d.nursingSepsisEnabled = true;
    d.nursingSepsisRatePerThousand = v.nursingSepsisRatePerThousand;
    d.nursingSepsisCurrentCompliance = v.nursingSepsisCurrentCompliance;
    d.nursingSepsisDocLagPercent = v.nursingSepsisDocLagPercent;
    d.nursingSepsisExcessCostPerCase = v.nursingSepsisExcessCostPerCase;
    d.nursingSepsisRealization = v.nursingSepsisRealization;
  },
};

// ─── Per-setting registry + metadata ─────────────────────────────────────────

export const SETTING_META: Record<SettingKey, SettingMeta> = {
  outpatient: {
    label: "Outpatient",
    volumePlaceholder: "2,500",
    namePlaceholder: "e.g., Riverbend Family Medicine",
    blurb: "Clinic visits, primary care and specialty.",
    providerWord: "clinicians",
    orgWord: "practice",
    encWord: "visits",
    visitWord: "visit",
    defaults: { totalProviders: 0, onAbridge: 0, encPerProvider: 0, utilNow: 0 },
    timeMetric: { before: 6.3, after: 5.2, table: "your EHR, or your best estimate" },
  },
  ed: {
    label: "Emergency",
    volumePlaceholder: "3,000",
    namePlaceholder: "e.g., Southside Emergency Physicians",
    blurb: "Emergency visits, including patients who leave before being seen.",
    providerWord: "clinicians",
    orgWord: "group",
    encWord: "ED visits",
    visitWord: "visit",
    defaults: { totalProviders: 0, onAbridge: 0, encPerProvider: 0, utilNow: 0 },
    timeMetric: { before: 6.5, after: 5.1, table: "your EHR, or your best estimate" },
  },
  inpatient: {
    label: "Inpatient",
    blurb: "Admission and progress notes for admitted patients.",
    providerWord: "clinicians",
    orgWord: "group",
    encWord: "admissions",
    visitWord: "admission",
    defaults: { totalProviders: 0, onAbridge: 0, encPerProvider: 0, utilNow: 0 },
    volumePlaceholder: "300",
    volumeVerb: "look after",
    namePlaceholder: "e.g., Lakeside Hospitalists",
    volumeHint: "patients admitted under their care, not the number of notes they write",
    timeMetric: { before: 9.0, after: 6.5, table: "your EHR, or your best estimate" },
  },
  nursing: {
    label: "Nursing",
    volumePlaceholder: "1,800",
    volumeVerb: "document",
    namePlaceholder: "e.g., 4 West Medical Surgical",
    blurb: "Bedside charting, keeping nurses, and avoidable harm.",
    providerWord: "nurses",
    orgWord: "unit",
    encWord: "care events",
    visitWord: "care event",
    isNursing: true,
    defaults: { totalProviders: 0, onAbridge: 0, encPerProvider: 0, utilNow: 0, staffedBeds: 0, occupancy: 0 },
  },
};

export const DRIVERS: Record<SettingKey, RoiDriver[]> = {
  outpatient: [
    codingDriver("wrvu", 1.95, 2.03),
    hccDriver,
    denialDriver(50),
    patientAccessDriver,
    providerWellbeingDriver,
    physicianAgencyDriver,
    scribeDriver,
  ],
  ed: [
    codingDriver("edEmLevel", 1.9, 2.05, "E/M level coding"),
    denialDriver(30),
    lwbsDriver,
    admissionDriver,
    providerWellbeingDriver,
    physicianAgencyDriver,
    scribeDriver,
  ],
  inpatient: [
    drgDriver,
    obsDriver,
    providerWellbeingDriver,
    physicianAgencyDriver,
  ],
  nursing: [
    nursingOvertimeDriver,
    nursingRetentionDriver,
    nursingAgencyDriver,
    nursingHapiDriver,
    nursingFallsDriver,
    nursingCautiDriver,
    nursingClabsiDriver,
    nursingSepsisDriver,
  ],
};

/** Domain order for the Step 2 section tabs. */
export const DOMAIN_ORDER: Domain[] = ["Revenue", "Capacity", "Workforce", "Quality"];

/**
 * What each domain means to the person reading it, in their own terms.
 *
 * The practice picks its goals before it sees any drivers, and that choice is
 * what decides how many sections the next step has. Written per setting on
 * purpose: "keep your clinicians" and "keep your nurses" are the same domain
 * but not the same sentence, and an ED reads its revenue very differently from
 * a clinic. Only domains that actually have drivers for a setting appear.
 */
export const DOMAIN_GOALS: Record<SettingKey, Partial<Record<Domain, { title: string; blurb: string }>>> = {
  outpatient: {
    Revenue: {
      title: "Bill accurately for the care you already give",
      blurb: "Notes that carry the full complexity of the visit, and fewer denials to rework.",
    },
    Capacity: {
      title: "Get time back, and decide what to do with it",
      blurb: "Finish notes sooner. That time can become more visits, or it can just go home with you.",
    },
    Workforce: {
      title: "Keep the clinicians you have",
      blurb: "A day that ends on time is a day people stay for, with less locum cover to buy.",
    },
  },
  ed: {
    Revenue: {
      title: "Capture what you already treat",
      blurb: "Coding that matches the acuity you saw, fewer denials, and fewer patients leaving before they are seen.",
    },
    Capacity: {
      title: "Get time back during the shift",
      blurb: "Notes closer to real time instead of a pile waiting at the end of the shift.",
    },
    Workforce: {
      title: "Keep the clinicians you have",
      blurb: "Burnout is what drives the locum and agency line. A sustainable shift is what shrinks it.",
    },
  },
  inpatient: {
    Revenue: {
      title: "Reflect how sick the patient actually was",
      blurb: "Documentation that supports the coding, and holds up when the admission status is questioned.",
    },
    Capacity: {
      title: "Get time back on rounds",
      blurb: "Progress notes and admissions written closer to the bedside than to the end of the day.",
    },
    Workforce: {
      title: "Keep the clinicians you have",
      blurb: "Fewer departures, and less reliance on locum cover to fill the gaps.",
    },
  },
  nursing: {
    Capacity: {
      title: "Cut the overtime charting creates",
      blurb: "Charting that keeps pace with the shift rather than spilling past the end of it.",
    },
    Workforce: {
      title: "Keep the nurses you have",
      blurb: "Less burnout on the unit, and less agency cover to backfill it.",
    },
    Quality: {
      title: "Support the work that catches harm sooner",
      blurb: "Fuller, earlier documentation feeds the bundles your quality program already runs on.",
    },
  },
};

// ─── Defaults helpers (for UI init) ──────────────────────────────────────────

export function defaultVals(setting: SettingKey): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of DRIVERS[setting]) {
    if (d.beforeAfter) {
      out[d.beforeAfter.beforeK] = d.beforeAfter.beforeDef;
      out[d.beforeAfter.afterK] = d.beforeAfter.afterDef;
    }
    for (const f of d.fields) out[f.k] = f.def;
  }
  return out;
}

export function defaultEnabled(setting: SettingKey): Record<string, boolean> {
  // Everything off at the jump — the practice turns on only what it believes
  // would actually change, so the number is one they built rather than received.
  const out: Record<string, boolean> = {};
  for (const d of DRIVERS[setting]) out[d.id] = false;
  return out;
}

// ─── Engine plumbing ─────────────────────────────────────────────────────────

/** Reproduces ExploreFlow's totalHoursSaved (not part of the engine module). */
function computeHours(state: ExploreState): number {
  if (state.careSetting === "nursing") {
    const totalShifts = state.numberOfProviders * state.nursingShiftsPerNurseYear;
    const eligibleShifts = totalShifts * (state.utilizationPercent / 100);
    return Math.round((eligibleShifts * state.minutesSavedPerEncounter) / 60);
  }
  const eligible = state.annualEncounters * (state.utilizationPercent / 100);
  return Math.round((eligible * state.minutesSavedPerEncounter) / 60);
}

export function buildRoiState(
  setting: SettingKey,
  account: RoiAccount,
  driverVals: Record<string, number>,
  enabled: Record<string, boolean>,
  scale?: RoiScale,
): { state: ExploreState; totalHoursSaved: number } {
  const state = JSON.parse(JSON.stringify(DEFAULT_EXPLORE_STATE)) as ExploreState;
  state.careSetting = setting as ExploreCareSetting;
  // Keep both wRVU (needs !== "risk") and HCC (needs !== "ffs") emittable.
  state.paymentModel = "both";
  // The quick ROI calc has no Counted/Tracked lens, so retention counts when its
  // driver is turned on (otherwise the shared engine's default "tracked" gate
  // zeroes it and the Workforce card reads $0 with the driver on).
  state.retentionMode = "counted";

  // When projecting the upside, never round BELOW the providers already on
  // Abridge today — "expanding" can't mean fewer people than you have now.
  const providers = scale
    ? Math.max(account.onAbridge, Math.round(account.totalProviders * (scale.adoptionPct / 100)))
    : account.onAbridge;
  state.numberOfProviders = providers;
  state.annualEncounters = providers * account.encPerProvider;
  state.utilizationPercent = scale ? scale.utilPct : account.utilNow;
  state.minutesSavedPerEncounter = Math.max(0, account.minutesSaved || 0);

  if (setting === "nursing") {
    state.nursingStaffedBeds = account.staffedBeds ?? 0;
    state.nursingOccupancyRate = account.occupancy ?? state.nursingOccupancyRate;
  }

  const ctx: RoiCtx = { setting, baseProviders: account.onAbridge };
  for (const d of DRIVERS[setting]) {
    if (enabled[d.id]) d.applyToState(state, driverVals, ctx);
  }

  return { state, totalHoursSaved: computeHours(state) };
}

export interface RoiRun {
  valueById: Record<string, number>;
  summaryById: Record<string, string>;
  totalsByQuadrant: Record<Domain, number>;
  total: number;
  totalHoursSaved: number;
}

/**
 * Every realization key across every setting, derived from the driver
 * definitions so a new driver participates automatically.
 */
export const REALIZATION_KEYS: string[] = Array.from(
  new Set(
    (Object.keys(DRIVERS) as SettingKey[])
      .flatMap((k) => DRIVERS[k])
      .flatMap((d) => d.fields)
      .filter((f) => f.realization)
      .map((f) => f.k),
  ),
);

/** The same inputs with nothing discounted: the top of the range. */
export function withFullRealization(vals: Record<string, number>): Record<string, number> {
  const out = { ...vals };
  for (const k of REALIZATION_KEYS) if (k in out) out[k] = 100;
  return out;
}

export function runRoi(
  setting: SettingKey,
  account: RoiAccount,
  driverVals: Record<string, number>,
  enabled: Record<string, boolean>,
  scale?: RoiScale,
): RoiRun {
  const { state, totalHoursSaved } = buildRoiState(setting, account, driverVals, enabled, scale);
  // Every dollar comes from the canonical engine — never a re-implemented formula.
  const valueById = computeAllDriverValues(state, totalHoursSaved);
  const summaryById = computeAllDriverCalcSummaries(state, totalHoursSaved);

  const totalsByQuadrant: Record<Domain, number> = { Capacity: 0, Workforce: 0, Revenue: 0, Quality: 0 };
  let total = 0;
  for (const d of DRIVERS[setting]) {
    if (!enabled[d.id]) continue;
    const v = valueById[d.id] ?? 0;
    totalsByQuadrant[d.domain] += v;
    total += v;
  }

  return { valueById, summaryById, totalsByQuadrant, total, totalHoursSaved };
}
