# Forecast & Pricing Multi-Year Redesign

**Date:** 2026-05-27  
**Scope:** Five interconnected changes to the Measure workflow's Forecast page, wRVU driver, and pricing system

---

## Overview

Five changes that together make the Forecast page tell a coherent, legally defensible story:

1. **wRVU inputs → avg per encounter** — reps enter per-encounter averages from EHR data; total value is derived by multiplying by Abridge encounter count
2. **Remove Abridge benchmark hint** — legal risk, delete it
3. **Platform Fee pricing model + derived ACV** — fourth pricing model (annual base + per encounter); Annual Contract Value derives from pricing scenarios instead of manual entry
4. **Multi-year scenario controls** — forecast N years with per-year editable Provider Count / Utilization / Encounters; each year gets its own column
5. **Pricing chart uses actual per-year values** — X axis = actual forecast years; cost changes year-over-year as scale changes; growth rate controls removed

---

## Change 1: wRVU Inputs → Avg Per Encounter

### What changes

The wRVU Capture driver currently takes absolute annual wRVU totals (e.g., "10,300 wRVUs before, 10,600 wRVUs after"). The new inputs are **avg wRVU per encounter** (e.g., "1.80 before, 2.10 after"). The total realized value is derived:

```
realized = (withAbridge − withoutAbridge) × abridgeEncounters × conversionFactor × (attribution / 100)
```

Where `abridgeEncounters` comes from `state.deployment.abridgeEncounters` (already collected on the Partner Profile page).

### `exploreDrivers.ts` — `DriverMeasureDefaults` interface

Add one field (line ~50, after `scaleInput`):

```ts
isPerEncounterRate?: boolean;
```

### `exploreDrivers.ts` — wRVU driver definition

Change the `measureDefaults` block for the `wrvu` driver:

```ts
measureDefaults: {
  deltaLabel: 'Avg wRVU per encounter',      // was: 'Additional wRVUs generated (total annual)'
  deltaUnit: 'wRVUs/enc',                    // was: 'wRVUs'
  valuePerUnitLabel: 'Medicare conversion factor (2026)',
  valuePerUnitDefault: 33.40,
  valuePerUnitPrefix: '$',
  realizationDefault: 75,
  scaleAxis: 'encounters',
  isPerEncounterRate: true,                  // NEW — signals per-encounter calculation
  // benchmarkHint removed entirely
},
```

### `MeasureDriverCard.tsx` — per-encounter display

When `md.isPerEncounterRate` is true and `abridgeEncounters > 0`, show a read-only derivation row below the Before/After inputs:

```tsx
{md.isPerEncounterRate && abridgeEncounters > 0 && delta !== 0 && (
  <div className="mt-2 px-3 py-2 bg-[#F5F0EB] rounded-lg text-[11px] text-[#666666]">
    {formatNumber(Math.abs(delta), 2)} wRVUs/enc × {abridgeEncounters.toLocaleString()} Abridge encounters
    <span className="font-medium text-black ml-1">
      = {Math.round(Math.abs(delta) * abridgeEncounters).toLocaleString()} total wRVUs/yr
    </span>
  </div>
)}
```

`abridgeEncounters` is passed as a prop from the parent page (already available on `state.deployment.abridgeEncounters`).

### `measureCalculator.ts` — `MeasureDriverDefaults` shape

Add `isPerEncounterRate?: boolean` to the `DriverMeasureDefaults` interface mirror if it exists in `measureCalculator.ts`. (It lives in `exploreDrivers.ts` — no change to `measureCalculator.ts` for this.)

### `MeasureForecast.tsx` — `computeRealizedBaseline` function

The function currently uses `scaleValue / scaleDivisor` as a scale factor (defaults to 1). Extend it to handle per-encounter-rate drivers:

```ts
function computeRealizedBaseline(
  driver: ExploreDriver,
  entry: MeasureDriverEntry,
  settingAbridgeEncounters: number,   // NEW parameter
): number {
  const md = driver.measureDefaults;
  if (!md || driver.visibility !== 'quantified') return 0;
  // ... existing monthly/snapshot logic ...
  const delta = lowerIsBetter ? effWithout - effWith : effWith - effWithout;
  const scale = (() => {
    if (entry.scaleDivisor && entry.scaleDivisor > 0 && entry.scaleValue !== undefined) {
      return entry.scaleValue / entry.scaleDivisor;
    }
    if (md.isPerEncounterRate) return settingAbridgeEncounters;
    return 1;
  })();
  return Math.round(delta * entry.valuePerUnit * scale * (entry.attributionPercent / 100));
}
```

In the `useMemo` that calls `computeRealizedBaseline`, pass the setting's abridge encounter count:

```ts
const settingAbridgeEnc =
  (state.settingData?.[settingKey as MeasureCareSetting] as Record<string, number>)?.deploy_abridgeEncounters
  || state.deployment?.abridgeEncounters
  || 0;
const realized = computeRealizedBaseline(d, entry, settingAbridgeEnc);
```

---

## Change 2: Remove Abridge Benchmark Hint

### `exploreDrivers.ts`

Delete the `benchmarkHint` field from the wRVU driver's `measureDefaults` (already shown removed in Change 1 above).

The `benchmarkHint` rendering in `MeasureDriverCard.tsx` (lines 334–338) remains — it just won't render for wRVU since the field is absent. No code change needed in the card.

---

## Change 3: Platform Fee Model + Derived ACV

### `forecastPricing.ts` — add `platformFee` model

```ts
export type PricingModel = 'perProvider' | 'perEncounter' | 'annualLicense' | 'platformFee';
```

Add to label/suffix/scale maps:
```ts
export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  perProvider: 'Per Provider / Month',
  perEncounter: 'Per Encounter',
  annualLicense: 'Annual License',
  platformFee: 'Platform Fee',           // NEW
};

export const PRICING_MODEL_RATE_SUFFIX: Record<PricingModel, string> = {
  perProvider: '/provider/mo',
  perEncounter: '/encounter',
  annualLicense: '/year',
  platformFee: '/encounter',             // NEW — the variable component
};

export const PRICING_MODEL_SCALE_LABEL: Record<PricingModel, string> = {
  perProvider: 'providers',
  perEncounter: 'encounters',
  annualLicense: 'flat (no scale axis)',
  platformFee: 'encounters',             // NEW
};
```

### `forecastPricing.ts` — extend `PricingScenario`

```ts
export interface PricingScenario {
  id: string;
  label: string;
  model: PricingModel;
  tiers: PricingTier[];
  baseFee?: number;   // NEW — used by platformFee model: annual flat base + per-encounter tiers
}
```

### `forecastPricing.ts` — `computeScenarioInvestment`

Add platformFee case after `annualLicense`:

```ts
if (scenario.model === 'platformFee') {
  const tier = findApplicableTier(scenario.tiers, scale);   // scale = encounters
  const encounterCost = tier ? scale * tier.rate : 0;
  const base = scenario.baseFee ?? 0;
  return { value: base + encounterCost, tier: tier ?? null };
}
```

### `forecastPricing.ts` — `makeDefaultTiers`

Add platformFee default:
```ts
if (model === 'platformFee') {
  return [
    { id: `tier-${stamp}-1`, thresholdFrom: 1, thresholdTo: null, rate: 0.25 },
  ];
}
```

### `PricingScenarioCard.tsx` — Platform Fee UI

When `scenario.model === 'platformFee'`, show an extra field above the tier structure:

```tsx
{scenario.model === 'platformFee' && (
  <div className="mb-3">
    <label className="text-xs font-medium text-[#888888] uppercase tracking-wide mb-1 block">
      Annual Base Fee
    </label>
    <div className="relative flex items-center">
      <span className="absolute left-2 text-sm text-[#888888]">$</span>
      <FormattedNumberInput
        value={scenario.baseFee ?? 0}
        onChange={(v) => onUpdate({ baseFee: v })}
        className="h-8 bg-white text-sm pl-6"
        data-testid={`input-base-fee-${scenario.id}`}
      />
      <span className="ml-2 text-[10px] text-[#888888]">/year</span>
    </div>
    <p className="text-[10px] text-[#AAAAAA] mt-1">
      Plus per-encounter tier below — total = base + (encounters × rate)
    </p>
  </div>
)}
```

The tier section label changes to "Per-encounter rate" when model is `platformFee`.

### `MeasureOpportunity.tsx` — derived ACV

Replace the hardcoded `state.deployment.annualContractValue` lookup with a derived value:

```ts
const annualContractValue = useMemo(() => {
  const scenarios = state.forecastScenario?.pricingScenarios;
  if (scenarios && scenarios.length > 0) {
    // Use first scenario as "current contract"
    const primary = scenarios[0];
    const providerScale = /* combinedProviders from deployment */ state.deployment.providers || 0;
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

Add `computeScenarioInvestment` to the import from `forecastPricing`.

### `MeasureDataEntry.tsx` — ACV field note

Keep the manual ACV input as-is. Add a sub-label: `"Or configure pricing in Forecast for auto-calculation"` in `text-[10px] text-[#AAAAAA]` below the input.

---

## Change 4: Multi-Year Scenario Controls

### Data model

**`ForecastScenario` in `measureCalculator.ts`** — remove the two recently-added fields and add `forecastYears`:

```ts
export interface ForecastScenario {
  providers: number;
  utilizationPercent: number;
  encounters: number;
  staffedBeds: number;
  occupancyPercent: number;
  addedSettings: ForecastAddedSetting[];
  pricingScenarios: PricingScenario[];
  forecastYears?: 1 | 2 | 3 | 5;     // NEW — default 1 (single-year = current behavior)
  // annualProviderGrowthPct removed
  // chartYears removed
}
```

**`MeasureState` in `measureCalculator.ts`** — add per-year storage:

```ts
export interface MeasureState {
  // ... existing fields ...
  settingForecastYears?: Record<string, SettingForecastValues[]>; // NEW — indexed by settingKey, length = forecastYears
}
```

`SettingForecastValues` is the existing type `{ providers, utilizationPercent, encounters, staffedBeds, occupancyPercent }`.

When `forecastYears === 1` (default): the existing `settingForecasts` is used. No migration needed.  
When `forecastYears > 1`: `settingForecastYears[settingKey]` holds the per-year array. Index 0 = Year 1, index N-1 = final year.

Add `settingForecastYears: {}` to `DEFAULT_MEASURE_STATE`.

### Year count selector

Rendered at the top of the Scenario Controls section in `MeasureForecast.tsx`, before the setting controls loop:

```tsx
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

`forecastYears` = `(state.forecastScenario?.forecastYears ?? 1)`.

`handleForecastYearsChange(yr)` — when switching to a year count greater than current:
1. Initialize `settingForecastYears[settingKey]` as an array of length `yr`
2. Year 1 = `getSettingBaseline(settingKey)` (current state)
3. Final year = `getSettingProjected(settingKey)` (existing projected value)
4. Intermediate years = linear interpolation between Year 1 and final year
5. Call `updateForecastScenario({ forecastYears: yr })` and `updateState({ settingForecastYears: ... })`

When switching to 1yr: clear `settingForecastYears`, use existing `settingForecasts`.

### `renderSettingControls` — multi-year axis cards

When `forecastYears === 1`: render exactly as today (no change).

When `forecastYears > 1`: each axis card (`renderAxisControl`) shows N year columns instead of one "Projected" input:

```
Provider Count                          +20% (baseline → final yr)
Baseline   →   Year 1   Year 2   Year 3
  500           [520]    [560]    [600]
[Current] [1.5×] [2×] [3×]   (presets set final year column)
```

The multi-year `renderAxisControl` signature adds a `yearValues: number[]` parameter. Each column is a `FormattedNumberInput` that updates `settingForecastYears[settingKey][yearIndex][field]`.

When there are 4+ years, the intermediate columns get a narrower input (no presets). Only Year 1 and Year N show preset buttons (or just Year N for brevity).

The ratio badge (`+20%`) shows change from baseline to **final year**.

### Value projection with multi-year data

The `allTrackedDrivers` useMemo currently projects value using the single `settingForecasts[settingKey]` (projected scale factor). For multi-year, it projects using the **final year** values — same as today, just sourced from `settingForecastYears[settingKey][forecastYears - 1]` when multi-year is active.

Helper:
```ts
const getSettingFinalYear = (settingKey: string): SettingForecastValues => {
  const forecastYears = state.forecastScenario?.forecastYears ?? 1;
  if (forecastYears > 1) {
    const arr = state.settingForecastYears?.[settingKey];
    if (arr && arr.length === forecastYears) return arr[forecastYears - 1];
  }
  return getSettingProjected(settingKey);
};
```

Replace `getSettingProjected` calls in the `allTrackedDrivers` useMemo with `getSettingFinalYear`.

The right panel ("Combined Annual Value") shows final-year projections — same as today, just using `getSettingFinalYear`.

---

## Change 5: Pricing Chart Uses Actual Per-Year Values

### Remove the growth rate approach

Remove `annualProviderGrowthPct` and `chartYears` from `ForecastScenario` (added in the previous session, now superseded by `forecastYears` and `settingForecastYears`).

### `forecastPricing.ts` — new `computePricingTimeSeries` signature

Replace the current growth-rate-based signature with one that accepts actual per-year data:

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

export function computePricingTimeSeries(
  scenarios: PricingScenario[],
  yearlyInputs: PricingYearInput[],
): { points: PricingTimeSeriesPoint[]; tierCrossings: TierCrossingMarker[] }
```

Remove `QuadrantRatios`, `startProviders`, `startEncounters`, `annualProviderGrowthPct`, `chartYears` parameters — all replaced by `yearlyInputs`.

The function body stays the same structure; it just reads `providers` and `encounters` directly from `yearlyInputs[i]` instead of computing them from growth rate.

### `MeasureForecast.tsx` — build `yearlyInputs` for chart

Replace the `pricingTimeSeries` useMemo:

```ts
const pricingYearlyInputs = useMemo((): PricingYearInput[] => {
  const forecastYears = state.forecastScenario?.forecastYears ?? 1;
  return Array.from({ length: forecastYears }, (_, i) => {
    const yearIndex = i;
    // Get per-year setting values
    const yearSettingValues = (settingKey: string): SettingForecastValues => {
      if (forecastYears > 1) {
        const arr = state.settingForecastYears?.[settingKey];
        if (arr && arr.length === forecastYears) return arr[yearIndex];
      }
      return getSettingProjected(settingKey); // single-year fallback
    };
    // Compute total value at this year's scale
    // Use same scale factor approach as allTrackedDrivers, but for yearIndex
    const yearScaleFactor = activeSettings.reduce((sum, sk) => {
      const bl = getSettingBaseline(sk);
      const yr = yearSettingValues(sk);
      return sum + computeScaleFactor(/* ... */ bl, yr);
    }, 0) / activeSettings.length; // simplified — see implementation note
    const totalValue = Math.round(combinedTotal * yearScaleFactor); // rough per-year projection
    // Quadrant split (same ratios as current)
    return {
      providers: activeSettings.reduce((s, sk) => s + yearSettingValues(sk).providers, 0),
      encounters: activeSettings.reduce((s, sk) => s + yearSettingValues(sk).encounters, 0),
      capacityValue:  Math.round(totalValue * quadrantRatios.capacity),
      workforceValue: Math.round(totalValue * quadrantRatios.workforce),
      revenueValue:   Math.round(totalValue * quadrantRatios.revenue),
      qualityValue:   totalValue - Math.round(totalValue * (quadrantRatios.capacity + quadrantRatios.workforce + quadrantRatios.revenue)),
      totalValue,
    };
  });
}, [state.forecastScenario?.forecastYears, state.settingForecastYears, activeSettings, combinedTotal, quadrantRatios]);
```

> **Implementation note on per-year value:** The correct per-year value is: for each driver, compute its scale factor at year `i`'s providers/encounters/utilization, then sum. This mirrors the existing `allTrackedDrivers` useMemo logic. For simplicity, use proportional scaling: if Year 1 providers are 80% of final year, Year 1 value ≈ 80% of final year value. This approximation is valid because most drivers scale linearly with provider or encounter count.

Remove the old `quadrantRatios` and `growthPct`/`chartYears` useMemos and helpers.

### Remove growth config row from JSX

Delete the growth config row (`Annual provider growth %` + `3yr/5yr/10yr` pills) from the Pricing Comparison JSX in `MeasureForecast.tsx`. It is replaced by the `forecastYears` pill selector at the top of the Scenario Controls section.

### `PricingComparisonChart.tsx` — update for new data shape

`PricingTimeSeriesPoint` still exists and looks the same. The only change is that `computePricingTimeSeries` no longer takes growth rate params. The chart component itself does not change.

---

## State Changes Summary

### `measureCalculator.ts`

1. Add `isPerEncounterRate?: boolean` to `DriverMeasureDefaults` (via `exploreDrivers.ts`)
2. `ForecastScenario`: remove `annualProviderGrowthPct`, remove `chartYears`, add `forecastYears?: 1 | 2 | 3 | 5`
3. `MeasureState`: add `settingForecastYears?: Record<string, SettingForecastValues[]>`
4. `DEFAULT_MEASURE_STATE`: add `settingForecastYears: {}`

### `exploreDrivers.ts`

1. Add `isPerEncounterRate?: boolean` to `DriverMeasureDefaults` interface
2. wRVU driver: change `deltaLabel`, `deltaUnit`, add `isPerEncounterRate: true`, remove `benchmarkHint`

### `forecastPricing.ts`

1. Add `platformFee` to `PricingModel`
2. Add `baseFee?: number` to `PricingScenario`
3. Update all `Record<PricingModel, ...>` maps with `platformFee` entries
4. Add `platformFee` case to `computeScenarioInvestment`
5. Add `platformFee` case to `makeDefaultTiers`
6. Add `PricingYearInput` interface
7. Replace `computePricingTimeSeries` signature (remove growth rate params, add `yearlyInputs`)
8. Remove `QuadrantRatios` interface (no longer needed)

### `MeasureDriverCard.tsx`

1. Accept `abridgeEncounters?: number` prop
2. Show derived total wRVU display row when `md.isPerEncounterRate && abridgeEncounters > 0`

### `PricingScenarioCard.tsx`

1. Add `baseFee` input for `platformFee` model
2. Rename tier label to "Per-encounter rate" for `platformFee`

### `MeasureForecast.tsx`

1. Add `forecastYears` pill selector at top of Scenario Controls
2. Add `handleForecastYearsChange` handler with initialization logic
3. Add `getSettingFinalYear` helper
4. Modify `renderAxisControl` to show per-year columns when `forecastYears > 1`
5. Replace `pricingTimeSeries` useMemo with `pricingYearlyInputs` approach
6. Remove growth config row from Pricing Comparison JSX
7. Pass `settingAbridgeEnc` to `computeRealizedBaseline`

### `MeasureOpportunity.tsx`

1. Replace hardcoded `state.deployment.annualContractValue` with derived ACV logic

### `MeasureDataEntry.tsx`

1. Add sub-label hint to ACV field

---

## Execution Order

1. `exploreDrivers.ts` — add `isPerEncounterRate` to interface; update wRVU driver definition
2. `measureCalculator.ts` — `ForecastScenario` type changes (remove growth fields, add `forecastYears`); `MeasureState` add `settingForecastYears`; `DEFAULT_MEASURE_STATE` update
3. `forecastPricing.ts` — Platform Fee model; updated `computePricingTimeSeries` signature; `PricingYearInput` interface; remove `QuadrantRatios`
4. `MeasureDriverCard.tsx` — add `abridgeEncounters` prop, show per-encounter derivation row
5. `PricingScenarioCard.tsx` — add `baseFee` input for Platform Fee
6. `MeasureForecast.tsx` — `computeRealizedBaseline` gets `settingAbridgeEnc` param; `getSettingFinalYear` helper; `forecastYears` pill; multi-year `renderAxisControl`; `pricingYearlyInputs` useMemo; remove growth config row
7. `MeasureOpportunity.tsx` — derived ACV
8. `MeasureDataEntry.tsx` — ACV hint text
