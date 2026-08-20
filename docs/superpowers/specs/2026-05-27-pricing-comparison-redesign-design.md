# Pricing Comparison Redesign — Design

**Date:** 2026-05-27  
**Scope:** `MeasureForecast.tsx`, `forecastPricing.ts`, `measureCalculator.ts`, `PricingScenarioCard.tsx`, new `PricingComparisonChart.tsx`

---

## Overview

The current Pricing Comparison section shows a single point-in-time cost calculation per pricing model in stacked cards — small, hard to read, and disconnected from the value story. The redesign replaces this with a full-width chart that shows value vs. investment over time, with built-in sensitivity analysis, tier crossing markers, and editable growth projections. The chart answers the question a rep faces in the room: *"As this customer grows, which pricing model serves them best — and when do the crossover points happen?"*

---

## Approved Design

**Chart (above the fold):**
- X axis: Years (Year 1 … Year N), with secondary labels showing projected provider count per year
- Y axis: Dollar amounts (shared scale for value and cost)
- Stacked bars per year: realized value broken down by domain (Capacity / Workforce / Revenue / Quality)
- Sensitivity envelope: dashed ±25% lines above and below the value bars
- One dashed cost line per pricing scenario
- Tier crossing markers on cost lines when provider growth crosses a tier boundary
- Growth config row above the chart (annual growth rate, years to model)

**Cards (below the chart):**
- One `PricingScenarioCard` per scenario, in a responsive grid
- Cards show final-year Investment / Net / ROI (not current-year)
- Existing tier configuration UI stays inside the cards

---

## Data Model

### `measureCalculator.ts` — `ForecastScenario`

Add two optional fields:

```ts
export interface ForecastScenario {
  // ... existing fields ...
  annualProviderGrowthPct?: number;  // default 0 — flat growth
  chartYears?: number;               // default 3; options: 3, 5, 10
}
```

These control the time axis for the pricing chart. Starting provider/encounter count is always derived from `combinedProviders` / `combinedEncounters` (already computed in `MeasureForecast.tsx`) — not stored separately.

---

## New Function: `computePricingTimeSeries` in `forecastPricing.ts`

### Types

```ts
export interface PricingTimeSeriesPoint {
  year: number;                          // 1-based
  label: string;                         // "Year 1", "Year 2", etc.
  providers: number;
  encounters: number;
  capacityValue: number;
  workforceValue: number;
  revenueValue: number;
  qualityValue: number;
  totalValue: number;
  valueLow: number;                      // totalValue * 0.75
  valueHigh: number;                     // totalValue * 1.25
  investments: Record<string, number>;   // keyed by scenario.id
}

export interface TierCrossingMarker {
  scenarioId: string;
  year: number;         // the year WHERE the crossing is visible (year N)
  providers: number;    // provider count at crossing year
  investment: number;   // investment at crossing year — for dot Y position
  label: string;        // e.g. "Tier 2 starts at 100 providers"
}
```

### Function signature

```ts
export function computePricingTimeSeries(
  scenarios: PricingScenario[],
  startProviders: number,
  startEncounters: number,
  annualProviderGrowthPct: number,
  chartYears: number,
  baseAnnualValue: number,
  quadrantRatios: {
    capacity: number;
    workforce: number;
    revenue: number;
    quality: number;
  },
): { points: PricingTimeSeriesPoint[]; tierCrossings: TierCrossingMarker[] }
```

### Computation logic

```ts
// Per year (year = 1 to chartYears):
const growthFactor = (1 + annualProviderGrowthPct / 100) ** (year - 1);
const providers = Math.round(startProviders * growthFactor);
const encounters = Math.round(startEncounters * growthFactor);
const totalValue = Math.round(baseAnnualValue * growthFactor);  // value scales with provider growth
const valueLow = Math.round(totalValue * 0.75);
const valueHigh = Math.round(totalValue * 1.25);
const capacityValue = Math.round(totalValue * quadrantRatios.capacity);
const workforceValue = Math.round(totalValue * quadrantRatios.workforce);
const revenueValue = Math.round(totalValue * quadrantRatios.revenue);
const qualityValue = totalValue - capacityValue - workforceValue - revenueValue; // remainder avoids rounding drift

// Per scenario investment:
const scale = scenario.model === 'perProvider' ? providers
            : scenario.model === 'perEncounter' ? encounters
            : 0;
investments[scenario.id] = computeScenarioInvestment(scenario, scale).value;
```

### Tier crossing detection

For each `perProvider` or `perEncounter` scenario, compare the applicable tier at year N vs year N-1. If the tier ID changes, record a `TierCrossingMarker`:

```ts
// Pseudo-code:
const prevScale = scenario.model === 'perProvider' ? points[year-2].providers : points[year-2].encounters;
const currScale = scenario.model === 'perProvider' ? points[year-1].providers : points[year-1].encounters;
const prevTier = findApplicableTier(scenario.tiers, prevScale);
const currTier = findApplicableTier(scenario.tiers, currScale);
if (prevTier && currTier && prevTier.id !== currTier.id) {
  tierCrossings.push({
    scenarioId: scenario.id,
    year,
    providers: currScale,
    investment: investments[scenario.id],
    label: `Tier 2 kicks in at ${currTier.thresholdFrom.toLocaleString()} providers`,
  });
}
```

`annualLicense` scenarios have no scale — skip tier crossing detection for them.

---

## New Component: `PricingComparisonChart.tsx`

**File:** `client/src/components/measure/PricingComparisonChart.tsx`

### Props

```ts
interface PricingComparisonChartProps {
  points: PricingTimeSeriesPoint[];
  tierCrossings: TierCrossingMarker[];
  scenarios: PricingScenario[];
}
```

### Chart structure (Recharts `ComposedChart`)

```tsx
<ResponsiveContainer width="100%" height={320}>
  <ComposedChart data={points} margin={{ top: 10, right: 16, bottom: 20, left: 16 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE7" vertical={false} />
    <XAxis dataKey="year" tick={<CustomXTick points={points} />} axisLine={false} tickLine={false} />
    <YAxis tickFormatter={formatCurrencyShort} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#AAAAAA' }} width={56} />
    <Tooltip content={<CustomTooltip scenarios={scenarios} />} />

    {/* Stacked domain value bars */}
    <Bar dataKey="capacityValue"  stackId="value" fill={DOMAIN_COLORS.capacity}  name="Capacity"  />
    <Bar dataKey="workforceValue" stackId="value" fill={DOMAIN_COLORS.workforce} name="Workforce" />
    <Bar dataKey="revenueValue"   stackId="value" fill={DOMAIN_COLORS.revenue}   name="Revenue"   />
    <Bar dataKey="qualityValue"   stackId="value" fill={DOMAIN_COLORS.quality}   name="Quality"   barSize={32} />

    {/* Sensitivity envelope lines */}
    <Line dataKey="valueHigh" stroke={VALUE_BAND_COLOR} strokeWidth={1} strokeDasharray="4 3" dot={false} name="Value +25%" legendType="none" />
    <Line dataKey="valueLow"  stroke={VALUE_BAND_COLOR} strokeWidth={1} strokeDasharray="4 3" dot={false} name="Value −25%" legendType="none" />

    {/* One cost line per scenario */}
    {scenarios.map((s, i) => (
      <Line
        key={s.id}
        dataKey={(d: PricingTimeSeriesPoint) => d.investments[s.id] ?? 0}
        name={s.label}
        stroke={SCENARIO_LINE_COLORS[i % SCENARIO_LINE_COLORS.length]}
        strokeWidth={2}
        strokeDasharray="7 4"
        dot={false}
      />
    ))}

    {/* Tier crossing markers */}
    {tierCrossings.map((tc, i) => (
      <ReferenceDot
        key={i}
        x={tc.year}
        y={tc.investment}
        r={5}
        fill={SCENARIO_LINE_COLORS[scenarios.findIndex(s => s.id === tc.scenarioId) % SCENARIO_LINE_COLORS.length]}
        stroke="white"
        strokeWidth={2}
        label={{ value: '⬆', fontSize: 9, fill: '#666' }}
      />
    ))}
  </ComposedChart>
</ResponsiveContainer>
```

### Color constants

```ts
const DOMAIN_COLORS = {
  capacity:  '#3B82F6',  // blue
  workforce: '#8B5CF6',  // purple
  revenue:   '#10B981',  // emerald
  quality:   '#F59E0B',  // amber
};

const VALUE_BAND_COLOR = 'rgba(139, 92, 246, 0.35)';  // muted purple, semi-transparent

const SCENARIO_LINE_COLORS = ['#EA2C00', '#1A1A1A', '#0891B2', '#6B7280'];
// First scenario = brand red (usually current contract); subsequent = dark/teal/gray
```

### Custom X tick component

```tsx
function CustomXTick({ x, y, payload, points }: CustomXTickProps) {
  const point = points.find(p => p.year === payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#666" fontSize={11}>
        {`Year ${payload.value}`}
      </text>
      <text x={0} y={0} dy={26} textAnchor="middle" fill="#AAAAAA" fontSize={9}>
        {point ? `${point.providers.toLocaleString()} providers` : ''}
      </text>
    </g>
  );
}
```

### Custom tooltip

Show for each hovered year:
- Value total + ±25% range (e.g., "Value: $4.2M  (range: $3.2M – $5.3M)")
- Per-domain breakdown (capacity / workforce / revenue / quality)
- Per-scenario investment (e.g., "Per Provider: $1.8M", "Annual License: $2.1M")
- Net value per scenario (value − investment)

Tooltip container: white card, `shadow-lg rounded-xl p-3 text-xs`, brand colors for labels.

---

## Growth Config Row

A compact row rendered **above the chart**, below the "Pricing Comparison" section header.

```tsx
<div className="flex items-center gap-6 mb-4 flex-wrap">
  {/* Annual growth rate */}
  <div className="flex items-center gap-2">
    <label className="text-xs text-[#8C7E6E] whitespace-nowrap">Annual provider growth</label>
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={growthPct}
        onChange={e => updateGrowthPct(Number(e.target.value))}
        className="w-12 text-center text-sm font-medium border border-[#E5E5E5] rounded-lg px-1 py-0.5"
        data-testid="input-annual-growth-pct"
      />
      <span className="text-xs text-[#8C7E6E]">%</span>
    </div>
  </div>

  {/* Years to model — pill switcher */}
  <div className="flex items-center gap-2">
    <label className="text-xs text-[#8C7E6E]">Model</label>
    <div className="flex items-center gap-0.5 bg-[#F5F0EB] rounded-full p-0.5">
      {([3, 5, 10] as const).map(yr => (
        <button
          key={yr}
          onClick={() => updateChartYears(yr)}
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
            chartYears === yr ? 'bg-white text-neutral-900 shadow-sm' : 'text-[#8C7E6E] hover:text-neutral-900'
          }`}
          data-testid={`pill-chart-years-${yr}`}
        >
          {yr}yr
        </button>
      ))}
    </div>
  </div>
</div>
```

`growthPct` = `state.forecastScenario?.annualProviderGrowthPct ?? 0`  
`chartYears` = `state.forecastScenario?.chartYears ?? 3`

Updates: `updateForecastScenario({ annualProviderGrowthPct: value })` / `updateForecastScenario({ chartYears: value })`

---

## `PricingScenarioCard.tsx` — Card Updates

The cards shift from inline stack to below-chart grid. The data displayed in the Investment/Net/ROI rows now uses final-year scale values instead of current-year.

**Prop changes:**

```ts
interface PricingScenarioCardProps {
  scenario: PricingScenario;
  // These replace combinedProviders / combinedEncounters / combinedValue:
  displayProviders: number;    // final-year provider count from time series
  displayEncounters: number;   // final-year encounter count from time series
  displayValue: number;        // final-year total value from time series
  isBestValue: boolean;
  onUpdate: (updates: Partial<PricingScenario>) => void;
  onRemove: () => void;
}
```

The existing `combinedProviders`, `combinedEncounters`, `combinedValue` props are renamed to `displayProviders`, `displayEncounters`, `displayValue`. Internally the card computes investment the same way: `computeScenarioInvestment(scenario, scale).value` where scale = `displayProviders` or `displayEncounters` depending on model.

No visual changes to the card itself — only the prop names and the values that flow into the investment/net/ROI display.

---

## `MeasureForecast.tsx` — Layout Changes

### Remove

- The `"Combined scale: N providers · N encounters"` text (`data-testid="text-combined-scale"`) — the chart makes this redundant

### Add

In the Pricing Comparison section:

1. Compute `quadrantRatios` from existing `totalsByQuadrant` and `combinedTotal`
2. Call `computePricingTimeSeries` in a `useMemo` when `pricingScenarios.length > 0`
3. Render growth config row (only when scenarios.length > 0, above the chart)
4. Render `<PricingComparisonChart>` (only when scenarios.length > 0, below growth config row)
5. Change `space-y-3` card stack → `grid grid-cols-1 md:grid-cols-2 gap-4` card grid (when scenarios.length >= 2; stay single-column for 0-1)
6. Pass `displayProviders`, `displayEncounters`, `displayValue` (final-year values from time series) to each `PricingScenarioCard`
7. Keep the "Add a pricing scenario" button below the grid

### `useMemo` for time series

```ts
const pricingTimeSeries = useMemo(() => {
  if (pricingScenarios.length === 0 || combinedTotal === 0) {
    return { points: [], tierCrossings: [] };
  }
  const total = combinedTotal;
  const ratios = {
    capacity:  total > 0 ? totalsByQuadrant.Capacity.projected  / total : 0.25,
    workforce: total > 0 ? totalsByQuadrant.Workforce.projected / total : 0.25,
    revenue:   total > 0 ? totalsByQuadrant.Revenue.projected   / total : 0.25,
    quality:   total > 0 ? totalsByQuadrant.Quality.projected   / total : 0.25,
  };
  return computePricingTimeSeries(
    pricingScenarios,
    combinedProviders,
    combinedEncounters,
    state.forecastScenario?.annualProviderGrowthPct ?? 0,
    state.forecastScenario?.chartYears ?? 3,
    combinedTotal,
    ratios,
  );
}, [pricingScenarios, combinedProviders, combinedEncounters, combinedTotal, totalsByQuadrant, state.forecastScenario?.annualProviderGrowthPct, state.forecastScenario?.chartYears]);
```

Final-year values for card props:
```ts
const finalPoint = pricingTimeSeries.points[pricingTimeSeries.points.length - 1];
const finalYearProviders  = finalPoint?.providers  ?? combinedProviders;
const finalYearEncounters = finalPoint?.encounters ?? combinedEncounters;
const finalYearValue      = finalPoint?.totalValue ?? combinedTotal;
```

---

## Empty State

When `pricingScenarios.length === 0`, show the existing empty state card (DollarSign icon + explainer text). The growth config row and chart are hidden.

---

## UX Details

- Growth rate defaults to 0% (flat) — safe for customers not projecting expansion
- `chartYears` defaults to 3 — matches the most common Abridge contract term
- Tier crossing markers show a filled dot on the cost line; tooltip on hover explains the threshold
- Sensitivity band lines use dashes to visually de-emphasize versus the cost lines (which are also dashed but heavier)
- Chart height: 320px fixed — enough to read the bars without dominating the page
- No legend component — the tooltip explains colors; adding an inline legend can be done later
- PDF export: chart is not included in the PDF; the existing single-point pricing summary remains the PDF representation

---

## State Changes Summary

### `measureCalculator.ts`
1. Add `annualProviderGrowthPct?: number` to `ForecastScenario`
2. Add `chartYears?: number` to `ForecastScenario`

### `forecastPricing.ts`
1. Add `PricingTimeSeriesPoint` interface
2. Add `TierCrossingMarker` interface
3. Add `computePricingTimeSeries` function

### `PricingComparisonChart.tsx` (new)
- Full chart component with stacked bars, sensitivity lines, cost lines, tier crossing dots, custom X tick, custom tooltip

### `PricingScenarioCard.tsx`
- Rename `combinedProviders` → `displayProviders`
- Rename `combinedEncounters` → `displayEncounters`
- Rename `combinedValue` → `displayValue`

### `MeasureForecast.tsx`
- Remove combined-scale text
- Add `pricingTimeSeries` useMemo
- Add growth config row
- Render `PricingComparisonChart` above cards
- Change card layout to responsive grid
- Pass final-year values to cards

---

## Execution Order

1. `measureCalculator.ts` — add `annualProviderGrowthPct`, `chartYears` to `ForecastScenario`
2. `forecastPricing.ts` — add `PricingTimeSeriesPoint`, `TierCrossingMarker`, `computePricingTimeSeries`
3. `PricingComparisonChart.tsx` — build chart component (depends on types from step 2)
4. `PricingScenarioCard.tsx` — rename props (`combined*` → `display*`)
5. `MeasureForecast.tsx` — wire everything together: time series memo, growth config row, chart, grid layout, updated card props
