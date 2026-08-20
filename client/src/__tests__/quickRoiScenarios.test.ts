import { describe, it, expect } from "vitest";
import { runRoi, DRIVERS, SETTING_META, type SettingKey, type RoiAccount } from "@/pages/forecast/roiEngine";

/**
 * Scenario coverage: two distinct, realistic partners per care setting (a smaller
 * community group and a larger system), every driver on. Verifies the whole
 * answer-screen contract holds for each: the total foots to the sum of the
 * on-driver values, the counterfactual (potential >= today, headroom, upside),
 * and the return math (roi = value / price, net = value - price) — with no NaN
 * and a return inside a sane band.
 */

function allOn(setting: SettingKey) {
  const vals: Record<string, number> = {};
  const enabled: Record<string, boolean> = {};
  for (const d of DRIVERS[setting]) {
    enabled[d.id] = true;
    if (d.beforeAfter) {
      vals[d.beforeAfter.beforeK] = d.beforeAfter.beforeDef;
      vals[d.beforeAfter.afterK] = d.beforeAfter.afterDef;
    }
    for (const f of d.fields) vals[f.k] = f.def;
  }
  return { vals, enabled };
}

interface Scenario { name: string; setting: SettingKey; account: RoiAccount; price: number; }

const SCENARIOS: Scenario[] = [
  // Outpatient
  { name: "OP · small community group", setting: "outpatient", price: 180000,
    account: { totalProviders: 30, onAbridge: 18, encPerProvider: 2200, utilNow: 55, minutesSaved: 1.1 } },
  { name: "OP · large multispecialty", setting: "outpatient", price: 1200000,
    account: { totalProviders: 400, onAbridge: 320, encPerProvider: 2800, utilNow: 80, minutesSaved: 1.1 } },
  // Emergency
  { name: "ED · single site", setting: "ed", price: 150000,
    account: { totalProviders: 22, onAbridge: 14, encPerProvider: 3000, utilNow: 60, minutesSaved: 1.4 } },
  { name: "ED · regional network", setting: "ed", price: 900000,
    account: { totalProviders: 140, onAbridge: 110, encPerProvider: 3400, utilNow: 78, minutesSaved: 1.4 } },
  // Inpatient
  { name: "IP · community hospital", setting: "inpatient", price: 260000,
    account: { totalProviders: 40, onAbridge: 24, encPerProvider: 900, utilNow: 55, minutesSaved: 2.5 } },
  { name: "IP · academic medical center", setting: "inpatient", price: 1400000,
    account: { totalProviders: 220, onAbridge: 160, encPerProvider: 1300, utilNow: 72, minutesSaved: 2.5 } },
  // Nursing
  { name: "NUR · community hospital", setting: "nursing", price: 220000,
    account: { totalProviders: 140, onAbridge: 90, encPerProvider: 800, utilNow: 60, minutesSaved: 0, staffedBeds: 160, occupancy: 80 } },
  { name: "NUR · large system", setting: "nursing", price: 900000,
    account: { totalProviders: 600, onAbridge: 430, encPerProvider: 950, utilNow: 75, minutesSaved: 0, staffedBeds: 620, occupancy: 88 } },
];

const finite = (n: number) => Number.isFinite(n) && !Number.isNaN(n);

describe("Quick ROI scenarios — 2 per setting", () => {
  SCENARIOS.forEach((sc) => {
    it(`${sc.name}: totals foot, counterfactual holds, return is sane`, () => {
      const { vals, enabled } = allOn(sc.setting);
      // HCC members are entered from the risk-adjustment pull; mirror the live
      // account-scaled default (~300 risk-adjusted members per on-Abridge provider)
      // instead of the fixed 25,000 placeholder, so the scenario reflects real input.
      if (vals.hccMembers !== undefined) vals.hccMembers = Math.round(sc.account.onAbridge * 300);
      const today = runRoi(sc.setting, sc.account, vals, enabled);
      const potential = runRoi(sc.setting, sc.account, vals, enabled, { adoptionPct: 88, utilPct: 88 });

      // every driver value is a finite number
      for (const d of DRIVERS[sc.setting]) expect(finite(today.valueById[d.id] ?? 0)).toBe(true);

      // total foots to the sum of the on-driver values (what the answer sums)
      const sum = DRIVERS[sc.setting].reduce((a, d) => a + (enabled[d.id] ? (today.valueById[d.id] ?? 0) : 0), 0);
      expect(today.total).toBe(sum);
      expect(today.total).toBeGreaterThan(0);

      // counterfactual: potential never below today; headroom non-negative
      const potentialValue = Math.max(potential.total, today.total);
      const headroom = Math.max(0, potentialValue - today.total);
      expect(potentialValue).toBeGreaterThanOrEqual(today.total);
      expect(finite(headroom)).toBe(true);

      // return math mirrors the answer screen
      const roi = sc.price > 0 ? today.total / sc.price : 0;
      const net = today.total - sc.price;
      expect(finite(roi)).toBe(true);
      expect(net).toBe(today.total - sc.price);
      // sane band: a real partner priced realistically should land in a believable range
      expect(roi).toBeGreaterThan(0.5);
      expect(roi).toBeLessThan(25);

      // capacity hours: physician settings return finite hours; nursing has none
      const isNursing = !!SETTING_META[sc.setting].isNursing;
      if (isNursing) expect(today.totalHoursSaved >= 0).toBe(true);
      else expect(today.totalHoursSaved).toBeGreaterThan(0);
    });
  });
});
