/**
 * Shared driver-id → engine-result-key resolver for the Explore path.
 *
 * A card's `EXPLORE_DRIVERS` registry `id` is not always the key
 * `computeAllDriverValues` (in `@/lib/exploreDriverCalcs`) writes its result
 * under (e.g. `wrvu` becomes `edEmLevel` in the ED care setting). Centralizing
 * the mapping here means every consumer (driver cards, the proforma handoff
 * snapshot, tests) reads the engine under the same key, so a card can never
 * silently read `undefined`/stale local math instead of the canonical value.
 */
export function engineKeyForDriver(driverId: string, careSetting: string): string {
  if (driverId === "wrvu") return careSetting === "ed" ? "edEmLevel" : "wrvu";
  const map: Record<string, string> = {
    edLwbs: "lwbsRecovery",
    edAdmission: "admissionCapture",
    ipDrg: "drgAccuracy",
    ipObsDefense: "obsDefense",
    nursingOt: "nursingOvertime",
    // Legacy Explore→Proforma snapshot ids (ExploreModel.buildExploreProformaDrivers)
    // that differ from their EXPLORE_DRIVERS registry id / engine result key.
    hcc: "hccCapture",
    denials: "denialPrevention",
    // identity keys (patientAccess, hccCapture, denialPrevention, providerWellbeing,
    // physicianLocumAgency, nursingRetention, nursingAgency, scribeCostReduction,
    // nursingHapi/Falls/Cauti/Clabsi/Sepsis) fall through to the id itself.
  };
  return map[driverId] ?? driverId;
}
