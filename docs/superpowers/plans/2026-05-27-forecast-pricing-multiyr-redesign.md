# Forecast & Pricing Multi-Year Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Forecast page into a multi-year scenario builder, change wRVU to per-encounter inputs, add Platform Fee pricing model, and wire pricing chart to actual per-year scenario data.

**Architecture:** Type changes cascade from `exploreDrivers.ts` → `measureCalculator.ts` → `forecastPricing.ts`, then UI changes in driver card, pricing card, forecast page, and opportunity page. Each task is independently committable.

**Tech Stack:** React, TypeScript, Recharts (existing), Tailwind CSS, Framer Motion (existing)

**Spec:** `docs/superpowers/specs/2026-05-27-forecast-pricing-multiyr-redesign.md`

---

### Task 1: wRVU driver — per-encounter rate flag, label changes, remove benchmark hint

**Files:**
- Modify: `client/src/lib/exploreDrivers.ts`

- [ ] **Step 1: Add `isPerEncounterRate` to `DriverMeasureDefaults` interface**

Read `client/src/lib/exploreDrivers.ts`. Find the `DriverMeasureDefaults` interface (around line 37–50). Add after `benchmarkHint?: string`:

```ts
isPerEncounterRate?: boolean;
```

- [ ] **Step 2: Update wRVU driver definition**

Find the `wrvu` driver (around line 713). Change its `measureDefaults`:

```ts
measureDefaults: {
  deltaLabel: 'Avg wRVU per encounter',
  deltaUnit: 'wRVUs/enc',
  valuePerUnitLabel: 'Medicare conversion factor (2026)',
  valuePerUnitDefault: 33.40,
  valuePerUnitPrefix: '$',
  realizationDefault: 75,
  scaleAxis: 'encounters',
  isPerEncounterRate: true,
},
```

Remove the `benchmarkHint` line entirely.

- [ ] **Step 3: TypeScript check**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -30`

Expected: no new errors. Pre-existing errors are fine.

- [ ] **Step 4: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/lib/exploreDrivers.ts
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat(measure): wRVU inputs → avg per encounter; remove Abridge benchmark hint"
```

---

### Task 2: Type changes — ForecastScenario, MeasureState, DEFAULT_MEASURE_STATE

**Files:**
- Modify: `client/src/lib/measureCalculator.ts`

- [ ] **Step 1: Read the file**

Read `client/src/lib/measureCalculator.ts` and confirm the exact current `ForecastScenario` interface and `DEFAULT_MEASURE_STATE`.

- [ ] **Step 2: Update `ForecastScenario`**

Find the `ForecastScenario` interface. Remove `annualProviderGrowthPct` and `chartYears`. Add `forecastYears`:

```ts
export interface ForecastScenario {
  providers: number;
  utilizationPercent: number;
  encounters: number;
  staffedBeds: number;
  occupancyPercent: number;
  addedSettings: ForecastAddedSetting[];
  pricingScenarios: PricingScenario[];
  forecastYears?: 1 | 2 | 3 | 5;
}
```

- [ ] **Step 3: Add `settingForecastYears` to `MeasureState`**

Find the `MeasureState` interface. Add after `settingForecasts`:

```ts
settingForecastYears?: Record<string, SettingForecastValues[]>;
```

`SettingForecastValues` is already defined in `MeasureForecast.tsx` as a local type. For it to be referenced in `MeasureState`, either:
- Move `SettingForecastValues` from `MeasureForecast.tsx` to `measureCalculator.ts` and export it, OR
- Use `Record<string, { providers: number; utilizationPercent: number; encounters: number; staffedBeds: number; occupancyPercent: number }[]>` inline

Prefer moving `SettingForecastValues` to `measureCalculator.ts` and exporting it. Then import it in `MeasureForecast.tsx`.

```ts
// In measureCalculator.ts, add before MeasureState:
export interface SettingForecastValues {
  providers: number;
  utilizationPercent: number;
  encounters: number;
  staffedBeds: number;
  occupancyPercent: number;
}
```

Then in `MeasureState`:
```ts
settingForecasts?: Record<string, SettingForecastValues>;
settingForecastYears?: Record<string, SettingForecastValues[]>;
```

- [ ] **Step 4: Update `DEFAULT_MEASURE_STATE`**

Add to `DEFAULT_MEASURE_STATE`:
```ts
settingForecastYears: {},
```

- [ ] **Step 5: Update `MeasureForecast.tsx` import**

In `MeasureForecast.tsx`, remove the local `SettingForecastValues` type definition and import it from `measureCalculator`:

```ts
import { type MeasureState, type MeasureDriverEntry, type ForecastScenario, type ForecastAddedSetting, type MeasureCareSetting, type SettingForecastValues } from "@/lib/measureCalculator";
```

- [ ] **Step 6: TypeScript check**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -40`

Fix any errors that appear from the type move. Pre-existing errors are fine.

- [ ] **Step 7: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/lib/measureCalculator.ts client/src/pages/measure/MeasureForecast.tsx
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat(measure): add forecastYears, settingForecastYears; remove growth rate fields"
```

---

### Task 3: Platform Fee pricing model

**Files:**
- Modify: `client/src/lib/forecastPricing.ts`
- Modify: `client/src/components/measure/PricingScenarioCard.tsx`

- [ ] **Step 1: Add `platformFee` to `PricingModel` and maps**

Read `client/src/lib/forecastPricing.ts`. Make these changes:

```ts
export type PricingModel = 'perProvider' | 'perEncounter' | 'annualLicense' | 'platformFee';

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  perProvider: 'Per Provider / Month',
  perEncounter: 'Per Encounter',
  annualLicense: 'Annual License',
  platformFee: 'Platform Fee',
};

export const PRICING_MODEL_RATE_SUFFIX: Record<PricingModel, string> = {
  perProvider: '/provider/mo',
  perEncounter: '/encounter',
  annualLicense: '/year',
  platformFee: '/encounter',
};

export const PRICING_MODEL_SCALE_LABEL: Record<PricingModel, string> = {
  perProvider: 'providers',
  perEncounter: 'encounters',
  annualLicense: 'flat (no scale axis)',
  platformFee: 'encounters',
};
```

- [ ] **Step 2: Add `baseFee` to `PricingScenario`**

```ts
export interface PricingScenario {
  id: string;
  label: string;
  model: PricingModel;
  tiers: PricingTier[];
  baseFee?: number;
}
```

- [ ] **Step 3: Add `platformFee` to `computeScenarioInvestment`**

After the `perEncounter` case, add:

```ts
if (scenario.model === 'platformFee') {
  const tier = findApplicableTier(scenario.tiers, scale);
  const encounterCost = tier ? scale * tier.rate : 0;
  const base = scenario.baseFee ?? 0;
  return { value: base + encounterCost, tier: tier ?? null };
}
```

- [ ] **Step 4: Add `platformFee` to `makeDefaultTiers`**

```ts
if (model === 'platformFee') {
  return [
    { id: `tier-${stamp}-1`, thresholdFrom: 1, thresholdTo: null, rate: 0.25 },
  ];
}
```

- [ ] **Step 5: Add `PricingYearInput` interface**

Append to the end of `forecastPricing.ts` (before the `computePricingTimeSeries` function):

```ts
export interface PricingYearInput {
  providers: number;
  encounters: number;
  capacityValue: number;
  workforceValue: number;
  revenueValue: number;
  qualityValue: number;
  totalValue: number;
}
```

- [ ] **Step 6: Update `computePricingTimeSeries` signature**

Replace the current function signature and implementation. The new function takes `yearlyInputs: PricingYearInput[]` instead of growth rate parameters:

```ts
export function computePricingTimeSeries(
  scenarios: PricingScenario[],
  yearlyInputs: PricingYearInput[],
): { points: PricingTimeSeriesPoint[]; tierCrossings: TierCrossingMarker[] } {
  const points: PricingTimeSeriesPoint[] = [];
  const tierCrossings: TierCrossingMarker[] = [];

  for (let i = 0; i < yearlyInputs.length; i++) {
    const year = i + 1;
    const inp = yearlyInputs[i];
    const valueLow = Math.round(inp.totalValue * 0.75);
    const valueHigh = Math.round(inp.totalValue * 1.25);

    const investments: Record<string, number> = {};
    for (const scenario of scenarios) {
      const scale = scenario.model === 'perProvider' ? inp.providers
                  : (scenario.model === 'perEncounter' || scenario.model === 'platformFee') ? inp.encounters
                  : 0;
      investments[scenario.id] = computeScenarioInvestment(scenario, scale).value;
    }

    points.push({
      year,
      label: `Year ${year}`,
      providers: inp.providers,
      encounters: inp.encounters,
      capacityValue: inp.capacityValue,
      workforceValue: inp.workforceValue,
      revenueValue: inp.revenueValue,
      qualityValue: inp.qualityValue,
      totalValue: inp.totalValue,
      valueLow,
      valueHigh,
      investments,
    });
  }

  // Tier crossing detection
  for (const scenario of scenarios) {
    if (scenario.model === 'annualLicense') continue;
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currPoint = points[i];
      const prevScale = (scenario.model === 'perProvider') ? prevPoint.providers : prevPoint.encounters;
      const currScale = (scenario.model === 'perProvider') ? currPoint.providers : currPoint.encounters;
      const prevTier = findApplicableTier(scenario.tiers, prevScale);
      const currTier = findApplicableTier(scenario.tiers, currScale);
      if (prevTier && currTier && prevTier.id !== currTier.id) {
        tierCrossings.push({
          scenarioId: scenario.id,
          year: currPoint.year,
          providers: currScale,
          investment: currPoint.investments[scenario.id] ?? 0,
          label: `Tier changes at ${currTier.thresholdFrom.toLocaleString()} ${scenario.model === 'perProvider' ? 'providers' : 'encounters'}`,
        });
      }
    }
  }

  return { points, tierCrossings };
}
```

Also remove the `QuadrantRatios` interface export (it's no longer needed — `yearlyInputs` provides the already-split values directly). Search for any imports of `QuadrantRatios` and remove them.

- [ ] **Step 7: Update `PricingScenarioCard.tsx` for Platform Fee**

Read `client/src/components/measure/PricingScenarioCard.tsx`. Make these changes:

1. Import `baseFee` from the updated `PricingScenario` type (no explicit import change needed — it's part of the interface)

2. In the model switcher grid (currently 3 cols), change to 4 cols:

```tsx
<div className="grid grid-cols-4 gap-1 p-1 bg-[#F5F0EB] rounded-lg mb-4">
  {(['perProvider', 'perEncounter', 'annualLicense', 'platformFee'] as PricingModel[]).map(m => (
```

3. Add the base fee input block before the tier structure section (after the model switcher, before `<div className="space-y-2 mb-4">`):

```tsx
{scenario.model === 'platformFee' && (
  <div className="mb-3">
    <label className="text-xs font-medium text-[#888888] uppercase tracking-wide mb-1 block">
      Annual Base Fee
    </label>
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#888888]">$</span>
        <FormattedNumberInput
          value={scenario.baseFee ?? 0}
          onChange={(v: number) => onUpdate({ baseFee: v })}
          className="h-8 bg-white text-sm pl-6"
          data-testid={`input-base-fee-${scenario.id}`}
        />
      </div>
      <span className="text-[10px] text-[#888888] whitespace-nowrap">/year flat</span>
    </div>
    <p className="text-[10px] text-[#AAAAAA] mt-1">Plus per-encounter rate below</p>
  </div>
)}
```

4. Change the tier section header label:

```tsx
<p className="text-xs font-medium text-[#888888] uppercase tracking-wide">
  {isAnnualLicense ? 'Annual fee' : scenario.model === 'platformFee' ? 'Per-encounter rate' : 'Tier structure (stepped)'}
</p>
```

Also update `isAnnualLicense` to exclude platformFee from the "no tier" path:
```ts
const isAnnualLicense = scenario.model === 'annualLicense';
```
(platformFee still shows tiers, just with a different label — this is already correct.)

5. The `scale` computation for platformFee uses encounters:
```ts
const scale = scenario.model === 'perProvider' ? displayProviders
            : scenario.model === 'perEncounter' || scenario.model === 'platformFee' ? displayEncounters
            : 0;
```

- [ ] **Step 8: TypeScript check**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -40`

Expected: errors in `MeasureForecast.tsx` where `computePricingTimeSeries` is called with old args — that's expected and will be fixed in Task 5. Fix any errors IN `forecastPricing.ts` or `PricingScenarioCard.tsx`.

- [ ] **Step 9: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/lib/forecastPricing.ts client/src/components/measure/PricingScenarioCard.tsx
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat(pricing): add Platform Fee model; update computePricingTimeSeries to per-year inputs"
```

---

### Task 4: MeasureDriverCard — per-encounter derivation row

**Files:**
- Modify: `client/src/components/measure/MeasureDriverCard.tsx`

- [ ] **Step 1: Read the file**

Read `client/src/components/measure/MeasureDriverCard.tsx` and find:
1. The component props interface
2. The Before/After input section (around line 293)
3. The `benchmarkHint` render section (around line 334)

- [ ] **Step 2: Add `abridgeEncounters` prop**

Add to the `MeasureDriverCardProps` interface:

```ts
abridgeEncounters?: number;
```

Add to the destructured props.

- [ ] **Step 3: Add derivation row after Before/After inputs**

After the Before/After input grid (after the `!entry.isMonthlyMode ? (...)` block closes), add:

```tsx
{md.isPerEncounterRate && (abridgeEncounters ?? 0) > 0 && (() => {
  const delta = entry.withAbridge - entry.withoutAbridge;
  return delta !== 0 ? (
    <div className="mt-2 px-3 py-2 bg-[#F5F0EB] rounded-lg text-[11px] text-[#666666]">
      {Math.abs(delta).toFixed(2)} wRVUs/enc × {(abridgeEncounters!).toLocaleString()} Abridge encounters
      <span className="font-semibold text-black ml-1">
        = {Math.round(Math.abs(delta) * abridgeEncounters!).toLocaleString()} total wRVUs/yr
      </span>
    </div>
  ) : null;
})()}
```

- [ ] **Step 4: Find all callers of MeasureDriverCard and pass abridgeEncounters**

Search for `<MeasureDriverCard` across the codebase:

```bash
grep -rn "MeasureDriverCard" "/Users/brad/Downloads/The-ROI-Calculator 2/client/src" --include="*.tsx"
```

For each caller, pass `abridgeEncounters={state.deployment.abridgeEncounters}` (or the equivalent access from that component's state/props).

- [ ] **Step 5: TypeScript check**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -30`

Expected: no new errors in MeasureDriverCard or its callers.

- [ ] **Step 6: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/components/measure/MeasureDriverCard.tsx
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat(measure): show per-encounter derivation row on wRVU driver card"
```

---

### Task 5: MeasureForecast.tsx — multi-year controls + updated chart wiring

**Files:**
- Modify: `client/src/pages/measure/MeasureForecast.tsx`

This is the largest task. Read the full file before starting.

- [ ] **Step 1: Read the file**

Read `client/src/pages/measure/MeasureForecast.tsx` in full (it's ~656 lines). Note:
- Line 10: forecastPricing import (needs `PricingYearInput`)
- `SettingForecastValues` local type (being moved to measureCalculator — Task 2 should have removed it)
- `computeRealizedBaseline` function (needs `settingAbridgeEnc` param)
- `renderAxisControl` function (needs multi-year columns)
- `renderSettingControls` (uses `renderAxisControl`)
- `updateSettingProjected` (needs per-year variant)
- `pricingTimeSeries` useMemo (needs replacement)
- Growth config row JSX (needs removal)

- [ ] **Step 2: Update forecastPricing import**

```ts
import {
  computeScenarioInvestment,
  computePricingTimeSeries,
  makeDefaultTiers,
  type PricingScenario,
  type PricingTimeSeriesPoint,
  type PricingYearInput,
} from "@/lib/forecastPricing";
```

Remove `QuadrantRatios` from the import (it was removed in Task 3).

- [ ] **Step 3: Update `computeRealizedBaseline` to accept abridgeEncounters**

Change the function signature:

```ts
function computeRealizedBaseline(
  driver: ExploreDriver,
  entry: MeasureDriverEntry,
  settingAbridgeEncounters: number,
): number {
```

Change the `scale` computation inside:

```ts
const scale = (() => {
  if (entry.scaleDivisor && entry.scaleDivisor > 0 && entry.scaleValue !== undefined) {
    return entry.scaleValue / entry.scaleDivisor;
  }
  if (driver.measureDefaults?.isPerEncounterRate) return settingAbridgeEncounters;
  return 1;
})();
```

In the `allTrackedDrivers` useMemo, pass abridgeEncounters to each call:

```ts
const settingAbridgeEnc = (
  (state.settingData?.[settingKey as MeasureCareSetting] as Record<string, number>)?.deploy_abridgeEncounters
  ?? state.deployment?.abridgeEncounters
  ?? 0
);
const realized = computeRealizedBaseline(d, entry, settingAbridgeEnc);
```

- [ ] **Step 4: Add `forecastYears` derived value and helpers**

After the `const pricingScenarios = ...` line, add:

```ts
const forecastYears = (state.forecastScenario?.forecastYears ?? 1) as 1 | 2 | 3 | 5;
```

Add helper to get setting values for a specific year index:

```ts
const getSettingYearValues = (settingKey: string, yearIndex: number): SettingForecastValues => {
  if (forecastYears > 1) {
    const arr = state.settingForecastYears?.[settingKey];
    if (arr && arr.length === forecastYears && arr[yearIndex]) return arr[yearIndex];
  }
  if (yearIndex === 0) return getSettingBaseline(settingKey);
  return getSettingProjected(settingKey);
};

const getSettingFinalYear = (settingKey: string): SettingForecastValues =>
  getSettingYearValues(settingKey, forecastYears - 1);
```

- [ ] **Step 5: Add `handleForecastYearsChange`**

After `updateForecastScenario`, add:

```ts
const handleForecastYearsChange = (yr: 1 | 2 | 3 | 5) => {
  const newYearsByKey: Record<string, SettingForecastValues[]> = {};
  for (const sk of activeSettings) {
    const baseline = getSettingBaseline(sk);
    const finalYear = getSettingProjected(sk);
    if (yr === 1) {
      // single year — clear per-year data
    } else {
      const arr: SettingForecastValues[] = [];
      for (let i = 0; i < yr; i++) {
        const t = i / (yr - 1); // 0 → 1
        arr.push({
          providers:         Math.round(baseline.providers         + t * (finalYear.providers         - baseline.providers)),
          utilizationPercent: Math.round(baseline.utilizationPercent + t * (finalYear.utilizationPercent - baseline.utilizationPercent)),
          encounters:        Math.round(baseline.encounters        + t * (finalYear.encounters        - baseline.encounters)),
          staffedBeds:       Math.round(baseline.staffedBeds       + t * (finalYear.staffedBeds       - baseline.staffedBeds)),
          occupancyPercent:  Math.round(baseline.occupancyPercent  + t * (finalYear.occupancyPercent  - baseline.occupancyPercent)),
        });
      }
      newYearsByKey[sk] = arr;
    }
  }
  updateForecastScenario({ forecastYears: yr });
  if (yr === 1) {
    updateState({ settingForecastYears: {} });
  } else {
    updateState({ settingForecastYears: newYearsByKey });
  }
};
```

Also add a per-year update helper:

```ts
const updateSettingYear = (settingKey: string, yearIndex: number, updates: Partial<SettingForecastValues>) => {
  const existing = state.settingForecastYears?.[settingKey] ?? [];
  const updated = existing.map((v, i) => i === yearIndex ? { ...v, ...updates } : v);
  updateState({ settingForecastYears: { ...(state.settingForecastYears ?? {}), [settingKey]: updated } });
};
```

- [ ] **Step 6: Update `allTrackedDrivers` to use final year**

In the `allTrackedDrivers` useMemo, replace `getSettingProjected(settingKey)` with `getSettingFinalYear(settingKey)`:

```ts
const proj = getSettingFinalYear(settingKey);
```

- [ ] **Step 7: Add `forecastYears` pill selector to JSX**

Find the Scenario Controls section header (`<p ... >Scenario Controls</p>`). Add the year pill switcher immediately below it, before `{activeSettings.map(settingKey => renderSettingControls(settingKey))}`:

```tsx
{/* Forecast period selector */}
<div className="flex items-center gap-3 mb-4">
  <span className="text-xs text-[#8C7E6E]">Forecast period</span>
  <div className="flex items-center gap-0.5 bg-[#F5F0EB] rounded-full p-0.5">
    {([1, 2, 3, 5] as const).map(yr => (
      <button
        key={yr}
        onClick={() => handleForecastYearsChange(yr)}
        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
          forecastYears === yr ? 'bg-white text-neutral-900 shadow-sm' : 'text-[#8C7E6E] hover:text-neutral-900'
        }`}
        data-testid={`pill-forecast-years-${yr}`}
      >
        {yr}yr
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 8: Update `renderAxisControl` for multi-year**

The current `renderAxisControl` renders one "Projected" input. When `forecastYears > 1`, render N year columns instead.

Change the `renderAxisControl` function signature to accept `settingKey` and `field` (it needs these to call `updateSettingYear`):

```ts
const renderAxisControl = (
  label: string,
  field: keyof SettingForecastValues,
  baseValue: number,
  projValue: number,
  settingKey: string,
  suffix: string = '',
  presets: number[] = [],
): JSX.Element => {
```

Add multi-year rendering path inside the function. When `forecastYears === 1`: render exactly as today. When `forecastYears > 1`:

```tsx
{/* Multi-year path */}
{forecastYears > 1 && (
  <div className="bg-white rounded-lg p-4 border border-[#E5E5E5]" key={`${settingKey}-${field}`}>
    <div className="flex items-center justify-between mb-3">
      <label className="text-sm font-semibold text-black">{label}</label>
      <span className={`text-xs font-medium ${ratioColor}`}>{ratioLabel}</span>
    </div>
    <div className="grid gap-2" style={{ gridTemplateColumns: `80px repeat(${forecastYears}, 1fr)` }}>
      <div>
        <p className="text-[10px] text-[#888888] mb-1">Baseline</p>
        <p className="text-sm font-medium text-[#666666]">{formatNumber(baseValue)}{suffix}</p>
      </div>
      {Array.from({ length: forecastYears }, (_, yi) => {
        const yr = yi + 1;
        const yVal = getSettingYearValues(settingKey, yi)[field] as number;
        return (
          <div key={yr}>
            <p className="text-[10px] text-[#888888] mb-1">Yr {yr}</p>
            <FormattedNumberInput
              value={yVal}
              onChange={(v: number) => updateSettingYear(settingKey, yi, { [field]: v })}
              className="h-8 bg-white text-sm"
              data-testid={`input-yr${yr}-${settingKey}-${field}`}
            />
          </div>
        );
      })}
    </div>
    {/* Presets apply to final year only */}
    {presets.length > 0 && baseValue > 0 && (
      <div className="flex gap-1.5 mt-2">
        {presets.map(mult => {
          const finalYrVal = getSettingYearValues(settingKey, forecastYears - 1)[field] as number;
          return (
            <button
              key={mult}
              onClick={() => updateSettingYear(settingKey, forecastYears - 1, { [field]: Math.round(baseValue * mult) })}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                Math.abs(finalYrVal - baseValue * mult) < 0.5
                  ? 'bg-[#EA2C00] text-white'
                  : 'bg-[#F5F0EB] text-[#666666] hover:bg-[#EBE6E1]'
              }`}
              data-testid={`button-preset-yr${forecastYears}-${settingKey}-${field}-${mult}x`}
            >
              {mult === 1 ? 'Current' : `${mult}×`}
            </button>
          );
        })}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 9: Replace `pricingTimeSeries` useMemo**

Remove the old `pricingTimeSeries`, `quadrantRatios`, `growthPct`, `chartYears`, `updateGrowthPct`, `updateChartYears`, `finalPoint`, `finalYearProviders`, `finalYearEncounters`, `finalYearValue` variables.

Add the new `pricingYearlyInputs` useMemo:

```ts
const pricingYearlyInputs = useMemo((): PricingYearInput[] => {
  const total = combinedTotal;
  if (total === 0 || forecastYears === 0) return [];
  const totalQ = {
    capacity:  totalsByQuadrant.Capacity.projected,
    workforce: totalsByQuadrant.Workforce.projected,
    revenue:   totalsByQuadrant.Revenue.projected,
    quality:   totalsByQuadrant.Quality.projected,
  };
  return Array.from({ length: forecastYears }, (_, yi) => {
    const providers = activeSettings.reduce((s, sk) => s + getSettingYearValues(sk, yi).providers, 0);
    const encounters = activeSettings.reduce((s, sk) => s + getSettingYearValues(sk, yi).encounters, 0);
    // Scale value proportionally to utilization-adjusted encounter volume vs final year
    const finalProviders = activeSettings.reduce((s, sk) => s + getSettingFinalYear(sk).providers, 0);
    const scaleFactor = finalProviders > 0 ? providers / finalProviders : 1;
    const yearTotal = Math.round(total * scaleFactor);
    const capacity  = Math.round(totalQ.capacity  / total * yearTotal);
    const workforce = Math.round(totalQ.workforce / total * yearTotal);
    const revenue   = Math.round(totalQ.revenue   / total * yearTotal);
    const quality   = yearTotal - capacity - workforce - revenue;
    return { providers, encounters, capacityValue: capacity, workforceValue: workforce, revenueValue: revenue, qualityValue: quality, totalValue: yearTotal };
  });
}, [forecastYears, activeSettings, combinedTotal, totalsByQuadrant, state.settingForecastYears, state.settingForecasts]);

const pricingTimeSeries = useMemo(() => {
  if (pricingScenarios.length === 0 || pricingYearlyInputs.length === 0) {
    return { points: [] as PricingTimeSeriesPoint[], tierCrossings: [] };
  }
  return computePricingTimeSeries(pricingScenarios, pricingYearlyInputs);
}, [pricingScenarios, pricingYearlyInputs]);

const finalInput = pricingYearlyInputs[pricingYearlyInputs.length - 1];
const finalYearProviders  = finalInput?.providers  ?? combinedProviders;
const finalYearEncounters = finalInput?.encounters ?? combinedEncounters;
const finalYearValue      = finalInput?.totalValue ?? combinedTotal;
```

- [ ] **Step 10: Remove growth config row from Pricing Comparison JSX**

In the Pricing Comparison section, remove the entire growth config row block (the `<div className="flex items-center gap-6 mb-4 flex-wrap">` that contains "Annual provider growth" and the 3yr/5yr/10yr pills). The year control is now in the Scenario Controls section above.

- [ ] **Step 11: TypeScript check**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -50`

Fix any new errors. The old `computePricingTimeSeries` call signature mismatch should now be resolved.

- [ ] **Step 12: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/pages/measure/MeasureForecast.tsx
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat(forecast): multi-year scenario controls, per-year chart data, remove growth rate"
```

---

### Task 6: MeasureOpportunity + MeasureDataEntry — derived ACV

**Files:**
- Modify: `client/src/pages/measure/MeasureOpportunity.tsx`
- Modify: `client/src/pages/measure/MeasureDataEntry.tsx`

- [ ] **Step 1: Read MeasureOpportunity.tsx lines 1–20 and 255–270**

Confirm imports and the `annualContractValue` line.

- [ ] **Step 2: Add `computeScenarioInvestment` import to MeasureOpportunity**

Add to the existing imports:

```ts
import { computeScenarioInvestment } from "@/lib/forecastPricing";
```

- [ ] **Step 3: Replace `annualContractValue` with derived logic**

Replace line 257 (`const annualContractValue = state.deployment.annualContractValue || 0;`) with:

```ts
const annualContractValue = useMemo(() => {
  const scenarios = state.forecastScenario?.pricingScenarios;
  if (scenarios && scenarios.length > 0) {
    const primary = scenarios[0];
    const providerScale = state.deployment.providers || 0;
    const encounterScale = state.deployment.abridgeEncounters || 0;
    const scale = primary.model === 'perProvider' ? providerScale
                : (primary.model === 'perEncounter' || primary.model === 'platformFee') ? encounterScale
                : 0;
    const { value } = computeScenarioInvestment(primary, scale);
    if (value > 0) return value;
  }
  return state.deployment.annualContractValue || 0;
}, [state.forecastScenario?.pricingScenarios, state.deployment]);
```

Remove `annualContractValue` from the two `useMemo` dependency arrays below (it's now itself a useMemo — it already updates reactively).

- [ ] **Step 4: Add hint to ACV field in MeasureDataEntry.tsx**

Read `client/src/pages/measure/MeasureDataEntry.tsx` around line 695. After the `FormattedNumberInput` for ACV, add:

```tsx
<p className="text-[10px] text-[#AAAAAA] mt-1">
  Configure pricing models in Forecast for auto-calculation
</p>
```

- [ ] **Step 5: TypeScript check**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/pages/measure/MeasureOpportunity.tsx client/src/pages/measure/MeasureDataEntry.tsx
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat(measure): derive ACV from pricing scenarios; add hint to manual ACV field"
```

---

### Task 7: Pass all callers — MeasureDriverCard abridgeEncounters prop

> This task follows Task 4. Find all places MeasureDriverCard is used and pass the new prop.

**Files:**
- Modify: any page that renders `<MeasureDriverCard ... />`

- [ ] **Step 1: Find all callers**

```bash
grep -rn "MeasureDriverCard" "/Users/brad/Downloads/The-ROI-Calculator 2/client/src" --include="*.tsx"
```

- [ ] **Step 2: Add `abridgeEncounters` prop to each caller**

For each file found, pass `abridgeEncounters={state.deployment?.abridgeEncounters ?? 0}` (or appropriate state access).

- [ ] **Step 3: TypeScript check**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -30`

Expected: no errors related to `abridgeEncounters` prop.

- [ ] **Step 4: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add -A
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "fix(measure): pass abridgeEncounters to all MeasureDriverCard callers"
```
