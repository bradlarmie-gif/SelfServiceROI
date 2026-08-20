import type { ExploreState } from "@/pages/explore/exploreState";

/**
 * Scale-gating readiness for the Explore path (DISPLAY layer only).
 *
 * Doctrine: a driver shows NO dollar until the partner has entered its SCALE
 * input(s) — the magnitude-setting "how many" (annual volumes / admissions /
 * visits / discharges, provider or nurse counts, staffed beds, and the HCC
 * patient panel per provider). The smaller ASSUMPTIONS (rates, %, $/unit,
 * realization) stay as visible, editable, conservative seeded defaults.
 *
 * This is a pure readiness check the driver cards + scoreboards read to decide
 * whether to reveal the computed dollar. It never touches the math: the engine
 * (`computeAllDriverValues`) and totals (`computeExploreTotals`) are unchanged,
 * and a blank scale naturally computes 0 (0 × anything), so nothing fabricates.
 *
 * Most drivers draw their scale from the global Starting Point counts
 * (`numberOfProviders` / `annualEncounters` / `nursingStaffedBeds`), which are
 * already blank (0) by default AND required by the Starting Point gate before
 * any driver screen is reachable. HCC is the lone driver with its OWN seeded
 * scale (patient panel per provider), so it is the case this most directly
 * fixes — but the check is applied uniformly so any future per-driver scale is
 * covered too.
 */
export interface ScaleReadiness {
  ready: boolean;
  /** Short lowercase phrase naming the missing scale input, e.g. "annual ED visits". */
  need: string;
}

function gate(ready: boolean, need: string): ScaleReadiness {
  return ready ? { ready: true, need: "" } : { ready: false, need };
}

export function driverScaleReadiness(
  driverId: string,
  state: ExploreState,
  totalHoursSaved: number,
): ScaleReadiness {
  const td = state.timeDriverInputs as any;
  const dq = state.docQualityInputs as any;
  const isED = state.careSetting === "ed";

  const providers = state.numberOfProviders > 0;
  const encounters = state.annualEncounters > 0;
  const beds = state.nursingStaffedBeds > 0;
  const hours = totalHoursSaved > 0;

  const encounterNeed = isED ? "annual ED visits" : "annual encounters";

  switch (driverId) {
    // ── Capacity ──
    case "patientAccess":
      return gate(providers && hours, "your provider count and documentation time saved");
    case "lwbsRecovery":
    case "admissionCapture":
      return gate(encounters, "annual ED visits");

    // ── Workforce ──
    case "providerWellbeing":
    case "physicianLocumAgency":
      return gate(providers, "your provider count");
    case "nursingRetention":
    case "nursingAgency":
    case "nursingOvertime":
      return gate(providers, "your nurse count");
    case "incrementalStaffing":
      // Dollar-level driver: the scale IS the entered spend, so it stays hidden
      // until the partner puts in their current incremental-staffing spend.
      return gate((td.ipStaffingCurrentSpend ?? 0) > 0, "your current incremental-staffing spend");
    case "scribeCostReduction":
      return (td.scribeBillingMode ?? "position") === "hourly"
        ? gate(encounters, encounterNeed)
        : gate((td.scribeHeadcount ?? 0) > 0, "your current scribe headcount");

    // ── Revenue ──
    case "wrvu":
    case "edEmLevel":
    case "denialPrevention":
      return gate(encounters, encounterNeed);
    case "hccCapture": {
      // Per-plan, not all-or-nothing: the engine sums HCC per plan (a blank plan
      // contributes 0), so the card is "ready" as soon as ANY plan has a panel and
      // shows the value of the plans entered so far. Requiring every plan to be
      // filled made the card hide a number the ROI total was already counting the
      // moment a partner added a second, still-blank plan.
      const plans = (dq.hccPlans ?? []) as Array<{ panelSize: number }>;
      const panelsEntered = plans.some((p) => (p.panelSize ?? 0) > 0);
      if (!providers) return gate(false, "your provider count and patient panel per provider");
      return gate(panelsEntered, "the patient panel per provider");
    }
    case "drgAccuracy":
    case "obsDefense":
      return gate(encounters, "annual discharges");

    // ── Quality (Nursing) ──
    case "nursingHapi":
    case "nursingFalls":
    case "nursingCauti":
    case "nursingClabsi":
    case "nursingSepsis":
      return gate(beds, "your staffed beds");

    default:
      return { ready: true, need: "" };
  }
}
