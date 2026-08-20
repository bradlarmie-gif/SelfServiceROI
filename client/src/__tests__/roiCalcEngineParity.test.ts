import { describe, it, expect } from "vitest";
import {
  SETTING_META,
  DRIVERS,
  buildRoiState,
  runRoi,
  defaultVals,
  defaultEnabled,
  type SettingKey,
  type RoiAccount,
} from "@/pages/forecast/roiEngine";
import { computeAllDriverValues } from "@/lib/exploreDriverCalcs";

const SETTINGS: SettingKey[] = ["outpatient", "ed", "inpatient", "nursing"];

function accountFor(s: SettingKey): RoiAccount {
  const tm = SETTING_META[s].timeMetric;
  // The per-setting demo defaults are intentionally blank now (partner facts are
  // entered from the pull), so the parity tests supply an explicit account.
  return {
    totalProviders: 100,
    onAbridge: 70,
    encPerProvider: 3000,
    utilNow: 70,
    minutesSaved: s === "nursing" || !tm ? 0 : tm.before - tm.after,
    staffedBeds: 300,
    occupancy: 85,
  };
}

/** Every driver on — the strongest reconciliation surface. */
function allOn(s: SettingKey): Record<string, boolean> {
  return Object.fromEntries(DRIVERS[s].map((dr) => [dr.id, true]));
}

describe("ROI Calculator reconciles with the Explore engine", () => {
  // The dollar the UI shows for a driver IS computeAllDriverValues[id]. If a
  // future change makes runRoi post-process the engine output, this fails.
  for (const s of SETTINGS) {
    it(`${s}: every displayed driver value equals computeAllDriverValues`, () => {
      const account = accountFor(s);
      const vals = defaultVals(s);
      const enabled = allOn(s);
      const run = runRoi(s, account, vals, enabled);
      const { state, totalHoursSaved } = buildRoiState(s, account, vals, enabled);
      const engine = computeAllDriverValues(state, totalHoursSaved);
      for (const dr of DRIVERS[s]) {
        expect(run.valueById[dr.id] ?? 0).toBe(engine[dr.id] ?? 0);
      }
      // The headline total is exactly the sum of the enabled drivers' engine values.
      const sum = DRIVERS[s].reduce((acc, dr) => acc + (run.valueById[dr.id] ?? 0), 0);
      expect(run.total).toBe(sum);
    });
  }

  it("gating holds: ED has no HCC, inpatient has no wRVU / E&M", () => {
    const ed = runRoi("ed", accountFor("ed"), defaultVals("ed"), allOn("ed"));
    expect(ed.valueById.hccCapture ?? 0).toBe(0);
    expect(DRIVERS.ed.some((d) => d.id === "hccCapture")).toBe(false);

    const ip = runRoi("inpatient", accountFor("inpatient"), defaultVals("inpatient"), allOn("inpatient"));
    expect(ip.valueById.wrvu ?? 0).toBe(0);
    expect(ip.valueById.edEmLevel ?? 0).toBe(0);
  });

  it("the measured wRVU before/after flows through the engine as a real lift", () => {
    const account = accountFor("outpatient");
    const vals = { ...defaultVals("outpatient"), wrvuBefore: 1.95, wrvuAfter: 2.03, cf: 33.4, wrvuRealization: 75 };
    const enabled = { ...defaultEnabled("outpatient"), wrvu: true };
    const run = runRoi("outpatient", account, vals, enabled);
    const eligible = Math.round(account.onAbridge * account.encPerProvider * (account.utilNow / 100));
    const expected = eligible * (2.03 - 1.95) * 33.4 * 0.75;
    expect(run.valueById.wrvu).toBeGreaterThan(0);
    // Within engine float/rounding of the hand computation.
    expect(Math.abs(run.valueById.wrvu - expected)).toBeLessThan(Math.max(5, expected * 0.001));
  });

  // Regression: a coding before > after (both positive, reachable via the UI)
  // must NOT produce a negative dollar that corrupts the headline. The value is
  // 0 and the shown-work lift is 0, and the total stays the sum of visible cards.
  it("coding: before > after yields $0, not a negative that breaks reconciliation", () => {
    const account = accountFor("outpatient");
    const enabled = { ...defaultEnabled("outpatient"), wrvu: true };
    const run = runRoi("outpatient", account, { ...defaultVals("outpatient"), wrvuBefore: 2.03, wrvuAfter: 1.95 }, enabled);
    expect(run.valueById.wrvu).toBe(0);
    // headline == sum of the per-driver values, and none is negative
    const sum = DRIVERS.outpatient.reduce((a, d) => a + (run.valueById[d.id] ?? 0), 0);
    expect(run.total).toBe(sum);
    for (const d of DRIVERS.outpatient) expect(run.valueById[d.id] ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("coding: a zero baseline (before = 0) yields $0, matching the shown work", () => {
    const account = accountFor("outpatient");
    const enabled = { ...defaultEnabled("outpatient"), wrvu: true };
    const run = runRoi("outpatient", account, { ...defaultVals("outpatient"), wrvuBefore: 0, wrvuAfter: 2.03 }, enabled);
    expect(run.valueById.wrvu).toBe(0);
  });

  it("realization is a live lever: dropping it lowers the number", () => {
    const account = accountFor("outpatient");
    const enabled = { ...defaultEnabled("outpatient"), wrvu: true };
    const full = runRoi("outpatient", account, { ...defaultVals("outpatient"), wrvuRealization: 75 }, enabled);
    const half = runRoi("outpatient", account, { ...defaultVals("outpatient"), wrvuRealization: 50 }, enabled);
    expect(half.valueById.wrvu).toBeLessThan(full.valueById.wrvu);
  });

  it("headroom: expanding adoption and utilization never lowers the total", () => {
    for (const s of SETTINGS) {
      const account = accountFor(s);
      const vals = defaultVals(s);
      const enabled = defaultEnabled(s);
      const today = runRoi(s, account, vals, enabled);
      const potential = runRoi(s, account, vals, enabled, { adoptionPct: 100, utilPct: 100 });
      expect(potential.total).toBeGreaterThanOrEqual(today.total);
    }
  });
});
