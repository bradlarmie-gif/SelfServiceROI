import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QuickRoiEditorialPdfDocument,
  SAMPLE_QUICK_ROI_PDF_DATA,
  buildQuickRoiPdfModel,
  type QuickRoiPdfData,
} from "@/components/forecast/QuickRoiEditorialPdf";
import { runRoi, DRIVERS, type SettingKey, type RoiAccount } from "@/pages/forecast/roiEngine";

/**
 * Reconciliation guard for the ROI Calculator HTML PDF. The PDF recomputes off
 * the SAME engine (`runRoi`) the answer screen uses, so this asserts the PDF
 * model ties to the engine: the total is the sum of the on-driver values, the
 * return and net use value/price, the itemized worked-math never leaks the raw
 * scenario-% float, and the document renders with no NaN across every setting.
 */

const shortMoney = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (a >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
};

const render = (data: QuickRoiPdfData) =>
  renderToStaticMarkup(createElement(QuickRoiEditorialPdfDocument, { data }));

// A realistic, all-drivers-on snapshot per setting (mirrors the audit scenarios).
function snapshot(setting: SettingKey, account: RoiAccount): QuickRoiPdfData {
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
  return {
    orgName: "Test Health", date: "January 1, 2026", setting, account, vals, enabled,
    price: 500000, targetAdoptionPct: 85, targetUtilPct: 88,
  };
}

const ACCTS: Record<SettingKey, RoiAccount> = {
  outpatient: { totalProviders: 90, onAbridge: 60, encPerProvider: 2500, utilNow: 68, minutesSaved: 1.1 },
  ed: { totalProviders: 60, onAbridge: 45, encPerProvider: 3200, utilNow: 72, minutesSaved: 1.4 },
  inpatient: { totalProviders: 110, onAbridge: 70, encPerProvider: 1100, utilNow: 64, minutesSaved: 2.5 },
  nursing: { totalProviders: 320, onAbridge: 210, encPerProvider: 900, utilNow: 70, minutesSaved: 0, staffedBeds: 300, occupancy: 85 },
};

describe("Quick ROI PDF reconciliation", () => {
  (Object.keys(ACCTS) as SettingKey[]).forEach((setting) => {
    it(`${setting}: PDF total is the sum of on-driver values (ties to runRoi)`, () => {
      const data = snapshot(setting, ACCTS[setting]);
      const m = buildQuickRoiPdfModel(data);
      const engine = runRoi(setting, data.account, data.vals, data.enabled);
      expect(m.todayValue).toBe(engine.total);
      const itemSum = m.items.reduce((a, it) => a + it.value, 0);
      expect(itemSum).toBe(m.todayValue);
      expect(m.todayValue).toBeGreaterThan(0);
    });

    it(`${setting}: return and net use value / price`, () => {
      const data = snapshot(setting, ACCTS[setting]);
      const m = buildQuickRoiPdfModel(data);
      expect(m.roi).toBeCloseTo(m.todayValue / data.price, 6);
      expect(m.net).toBe(m.todayValue - data.price);
      // Conservative band: with a realistic price the return should not be absurd.
      expect(m.roi).toBeGreaterThan(0);
    });

    it(`${setting}: renders with no NaN / undefined and no raw scenario-% float leak`, () => {
      const html = render(snapshot(setting, ACCTS[setting]));
      expect(html).not.toMatch(/NaN|undefined|\$NaN/);
      // The ugly engine float ("4.102564102564095% lift") must never reach the PDF.
      expect(html).not.toMatch(/\d\.\d{6,}%/);
    });
  });

  it("sample data renders and the headline matches the engine total", () => {
    const data = SAMPLE_QUICK_ROI_PDF_DATA;
    const m = buildQuickRoiPdfModel(data);
    const html = render(data).replace(/<[^>]+>/g, " ");
    expect(html).toContain(shortMoney(m.todayValue));
    expect(m.todayValue).toBe(runRoi(data.setting, data.account, data.vals, data.enabled).total);
  });
});
