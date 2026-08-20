/**
 * Pure math helpers for the five quantified nursing-quality drivers
 * (HAPI, Falls, CAUTI, CLABSI, Sepsis).
 *
 * This module is the single source of truth shared by:
 *   - the live engine in client/src/pages/explore/ExploreModel.tsx
 *   - the live UI in client/src/pages/explore/ExploreCareQuality.tsx
 *   - the printed PDF in client/src/components/explore/NursingValueAssessmentPDF.tsx
 *
 * IMPORTANT — keeping the PDF in lockstep
 * ---------------------------------------
 * If a new field is added here (e.g. a per-driver realization haircut, a
 * sub-population adjustment, or a separate "preventable share" multiplier)
 * it MUST also be:
 *   1. Threaded into NursingPDFInput,
 *   2. Surfaced in the PDF's per-driver "math text",
 *   3. Reflected in the corresponding driverCalc string in ExploreModel's
 *      allDriverCalcSummaries map.
 *
 * The reconciliation test in
 *   client/src/__tests__/nursingPdfReconciliation.test.ts
 * asserts that the printed formula multiplicands always equal the engine
 * `value`, and will fail loudly if the math drifts out of step.
 */

export interface HapiInputs {
  patientDays: number;
  rate: number;          // events per 1,000 patient days
  preventionPct: number; // documentation-attributable prevention %
  cost: number;          // $ per event
}

export interface FallsInputs {
  patientDays: number;
  rate: number;
  preventionPct: number;
  cost: number;
}

export interface CautiInputs {
  patientDays: number;
  utilizationPct: number; // catheter days as % of patient days
  rate: number;           // events per 1,000 catheter days
  preventionPct: number;
  cost: number;
}

export interface ClabsiInputs {
  patientDays: number;
  utilizationPct: number; // central-line days as % of patient days
  rate: number;
  preventionPct: number;
  cost: number;
}

export interface SepsisInputs {
  patientDays: number;
  ratePerThousand: number;       // sepsis cases per 1,000 patient days
  currentCompliancePct: number;  // SEP-1 bundle compliance %
  docLagPct: number;             // doc-lag share of non-compliant cases
  excessCostPerCase: number;
  realizationPct: number;        // realization haircut on captured value
}

export interface QualityDriverResult {
  events: number;        // upstream event count (e.g. HAPIs/yr, sepsis cases/yr)
  prevented: number;     // events × prevention% (or doc-lag share × non-compliant)
  value: number;         // final $ value after every multiplier
}

export interface CautiResult extends QualityDriverResult {
  catheterDays: number;
}

export interface ClabsiResult extends QualityDriverResult {
  lineDays: number;
}

export interface SepsisResult extends QualityDriverResult {
  nonCompliant: number;   // events × (100 - compliance) / 100
  docLagCases: number;    // the addressable documentation-lag pool, BEFORE
                           // the realization haircut - `prevented` is this
                           // pool AFTER realization, so `prevented` and
                           // `value` (which is prevented x cost) can never
                           // disagree, and a $0 realization always shows 0
                           // prevented, never a positive count next to $0.
  complianceGapPct: number;
}

export const calcHapi = (i: HapiInputs): QualityDriverResult => {
  const events = (i.patientDays / 1000) * i.rate;
  const prevented = events * (i.preventionPct / 100);
  return { events, prevented, value: prevented * i.cost };
};

export const calcFalls = (i: FallsInputs): QualityDriverResult => {
  const events = (i.patientDays / 1000) * i.rate;
  const prevented = events * (i.preventionPct / 100);
  return { events, prevented, value: prevented * i.cost };
};

export const calcCauti = (i: CautiInputs): CautiResult => {
  const catheterDays = i.patientDays * (i.utilizationPct / 100);
  const events = (catheterDays / 1000) * i.rate;
  const prevented = events * (i.preventionPct / 100);
  return { catheterDays, events, prevented, value: prevented * i.cost };
};

export const calcClabsi = (i: ClabsiInputs): ClabsiResult => {
  const lineDays = i.patientDays * (i.utilizationPct / 100);
  const events = (lineDays / 1000) * i.rate;
  const prevented = events * (i.preventionPct / 100);
  return { lineDays, events, prevented, value: prevented * i.cost };
};

export const calcSepsis = (i: SepsisInputs): SepsisResult => {
  const events = (i.patientDays / 1000) * i.ratePerThousand;
  const complianceGapPct = Math.max(0, 100 - i.currentCompliancePct);
  const nonCompliant = events * (complianceGapPct / 100);
  const docLagCases = nonCompliant * (i.docLagPct / 100);
  // `prevented` is the addressable doc-lag pool AFTER the realization
  // haircut, so value === prevented x cost exactly - the count and the
  // dollar can never disagree, and 0% realization always shows 0 prevented.
  const prevented = docLagCases * (i.realizationPct / 100);
  const value = prevented * i.excessCostPerCase;
  return {
    events,
    nonCompliant,
    docLagCases,
    prevented,
    complianceGapPct,
    value,
  };
};
