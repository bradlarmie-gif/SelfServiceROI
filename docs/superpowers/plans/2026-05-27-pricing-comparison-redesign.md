# Pricing Comparison Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-point pricing comparison card stack with a full-width time-series chart showing value vs. investment over time, with ±25% sensitivity bands, tier crossing markers, editable growth config, and pricing model cards positioned below the chart.

**Architecture:** New `computePricingTimeSeries` function in `forecastPricing.ts` computes per-year data; a new `PricingComparisonChart` Recharts component renders it; `PricingScenarioCard` gets prop renames; `MeasureForecast` wires the time series, growth config row, chart, and card grid together.

**Tech Stack:** React, TypeScript, Recharts (already installed — `ComposedChart`, `Bar`, `Line`, `ReferenceDot`), Tailwind CSS, Framer Motion (already installed)

---

### Task 1: Extend ForecastScenario with growth config fields

**Files:**
- Modify: `client/src/lib/measureCalculator.ts` — add 2 fields to `ForecastScenario` interface (lines 24–32)

- [ ] **Step 1: Add fields to ForecastScenario**

In `client/src/lib/measureCalculator.ts`, the `ForecastScenario` interface currently ends at line 32:

```ts
export interface ForecastScenario {
  providers: number;
  utilizationPercent: number;
  encounters: number;
  staffedBeds: number;
  occupancyPercent: number;
  addedSettings: ForecastAddedSetting[];
  pricingScenarios: PricingScenario[];
  annualProviderGrowthPct?: number;  // ADD: default 0 = flat
  chartYears?: number;               // ADD: default 3; options: 3, 5, 10
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -30`

Expected: no new errors (there may be pre-existing errors — they are fine as long as no new ones appeared related to `ForecastScenario`)

- [ ] **Step 3: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/lib/measureCalculator.ts
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat: add annualProviderGrowthPct and chartYears to ForecastScenario"
```

---

### Task 2: Add computePricingTimeSeries to forecastPricing.ts

**Files:**
- Modify: `client/src/lib/forecastPricing.ts` — append interfaces and function

- [ ] **Step 1: Add PricingTimeSeriesPoint and TierCrossingMarker interfaces**

Append to the end of `client/src/lib/forecastPricing.ts`:

```ts
export interface PricingTimeSeriesPoint {
  year: number;
  label: string;
  providers: number;
  encounters: number;
  capacityValue: number;
  workforceValue: number;
  revenueValue: number;
  qualityValue: number;
  totalValue: number;
  valueLow: number;
  valueHigh: number;
  investments: Record<string, number>;
}

export interface TierCrossingMarker {
  scenarioId: string;
  year: number;
  providers: number;
  investment: number;
  label: string;
}

export interface QuadrantRatios {
  capacity: number;
  workforce: number;
  revenue: number;
  quality: number;
}
```

- [ ] **Step 2: Add computePricingTimeSeries function**

Append the function to `client/src/lib/forecastPricing.ts`:

```ts
export function computePricingTimeSeries(
  scenarios: PricingScenario[],
  startProviders: number,
  startEncounters: number,
  annualProviderGrowthPct: number,
  chartYears: number,
  baseAnnualValue: number,
  quadrantRatios: QuadrantRatios,
): { points: PricingTimeSeriesPoint[]; tierCrossings: TierCrossingMarker[] } {
  const points: PricingTimeSeriesPoint[] = [];
  const tierCrossings: TierCrossingMarker[] = [];

  for (let year = 1; year <= chartYears; year++) {
    const growthFactor = (1 + annualProviderGrowthPct / 100) ** (year - 1);
    const providers = Math.round(startProviders * growthFactor);
    const encounters = Math.round(startEncounters * growthFactor);
    const totalValue = Math.round(baseAnnualValue * growthFactor);
    const valueLow = Math.round(totalValue * 0.75);
    const valueHigh = Math.round(totalValue * 1.25);
    const capacityValue = Math.round(totalValue * quadrantRatios.capacity);
    const workforceValue = Math.round(totalValue * quadrantRatios.workforce);
    const revenueValue = Math.round(totalValue * quadrantRatios.revenue);
    const qualityValue = totalValue - capacityValue - workforceValue - revenueValue;

    const investments: Record<string, number> = {};
    for (const scenario of scenarios) {
      const scale = scenario.model === 'perProvider' ? providers
                  : scenario.model === 'perEncounter' ? encounters
                  : 0;
      investments[scenario.id] = computeScenarioInvestment(scenario, scale).value;
    }

    points.push({
      year,
      label: `Year ${year}`,
      providers,
      encounters,
      capacityValue,
      workforceValue,
      revenueValue,
      qualityValue,
      totalValue,
      valueLow,
      valueHigh,
      investments,
    });
  }

  // Tier crossing detection — compare applied tier year-over-year
  for (const scenario of scenarios) {
    if (scenario.model === 'annualLicense') continue;
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currPoint = points[i];
      const prevScale = scenario.model === 'perProvider' ? prevPoint.providers : prevPoint.encounters;
      const currScale = scenario.model === 'perProvider' ? currPoint.providers : currPoint.encounters;
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

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -30`

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/lib/forecastPricing.ts
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat: add computePricingTimeSeries to forecastPricing"
```

---

### Task 3: Create PricingComparisonChart component

**Files:**
- Create: `client/src/components/measure/PricingComparisonChart.tsx`

- [ ] **Step 1: Create the component file**

Create `client/src/components/measure/PricingComparisonChart.tsx` with the following content:

```tsx
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ResponsiveContainer,
} from 'recharts';
import type { PricingScenario } from '@/lib/forecastPricing';
import type { PricingTimeSeriesPoint, TierCrossingMarker } from '@/lib/forecastPricing';

interface PricingComparisonChartProps {
  points: PricingTimeSeriesPoint[];
  tierCrossings: TierCrossingMarker[];
  scenarios: PricingScenario[];
}

const DOMAIN_COLORS = {
  capacity:  '#3B82F6',
  workforce: '#8B5CF6',
  revenue:   '#10B981',
  quality:   '#F59E0B',
};

const VALUE_BAND_COLOR = 'rgba(139, 92, 246, 0.40)';

const SCENARIO_LINE_COLORS = ['#EA2C00', '#1A1A1A', '#0891B2', '#6B7280'];

function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

interface CustomXTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
  points: PricingTimeSeriesPoint[];
}

function CustomXTick({ x = 0, y = 0, payload, points }: CustomXTickProps) {
  const point = points.find(p => p.year === payload?.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#555555" fontSize={11}>
        {`Year ${payload?.value ?? ''}`}
      </text>
      {point && (
        <text x={0} y={0} dy={26} textAnchor="middle" fill="#AAAAAA" fontSize={9}>
          {`${point.providers.toLocaleString()} providers`}
        </text>
      )}
    </g>
  );
}

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number;
  points: PricingTimeSeriesPoint[];
  scenarios: PricingScenario[];
}

function CustomTooltip({ active, label, points, scenarios }: CustomTooltipProps) {
  if (!active || label == null) return null;
  const point = points.find(p => p.year === label);
  if (!point) return null;

  const formatC = (n: number) => '$' + Math.round(n).toLocaleString();

  return (
    <div className="bg-white rounded-xl shadow-lg p-3 text-xs border border-[#E5E5E5] min-w-[200px]">
      <p className="font-semibold text-black mb-2">Year {label} · {point.providers.toLocaleString()} providers</p>

      <div className="mb-2">
        <p className="text-[#888888] uppercase tracking-wide text-[10px] mb-1">Value</p>
        <div className="space-y-0.5">
          <div className="flex justify-between gap-4">
            <span className="text-[#3B82F6]">Capacity</span>
            <span className="font-medium">{formatC(point.capacityValue)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#8B5CF6]">Workforce</span>
            <span className="font-medium">{formatC(point.workforceValue)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#10B981]">Revenue</span>
            <span className="font-medium">{formatC(point.revenueValue)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#F59E0B]">Quality</span>
            <span className="font-medium">{formatC(point.qualityValue)}</span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t border-[#F0ECE7]">
            <span className="font-semibold text-black">Total</span>
            <span className="font-semibold">{formatC(point.totalValue)}</span>
          </div>
          <div className="flex justify-between gap-4 text-[#AAAAAA]">
            <span>±25% range</span>
            <span>{formatC(point.valueLow)} – {formatC(point.valueHigh)}</span>
          </div>
        </div>
      </div>

      {scenarios.length > 0 && (
        <div>
          <p className="text-[#888888] uppercase tracking-wide text-[10px] mb-1">Investment</p>
          <div className="space-y-0.5">
            {scenarios.map((s, i) => {
              const inv = point.investments[s.id] ?? 0;
              const net = point.totalValue - inv;
              return (
                <div key={s.id} className="flex justify-between gap-4">
                  <span style={{ color: SCENARIO_LINE_COLORS[i % SCENARIO_LINE_COLORS.length] }}>{s.label}</span>
                  <span className="font-medium">{formatC(inv)} <span className="text-[#888888]">net {formatC(net)}</span></span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PricingComparisonChart({ points, tierCrossings, scenarios }: PricingComparisonChartProps) {
  if (points.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 32, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE7" vertical={false} />
        <XAxis
          dataKey="year"
          tick={(props) => <CustomXTick {...props} points={points} />}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tickFormatter={formatCurrencyShort}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#AAAAAA' }}
          width={56}
        />
        <Tooltip content={(props) => <CustomTooltip {...props} points={points} scenarios={scenarios} />} />

        {/* Stacked domain value bars */}
        <Bar dataKey="capacityValue"  stackId="value" fill={DOMAIN_COLORS.capacity}  name="Capacity"  barSize={32} />
        <Bar dataKey="workforceValue" stackId="value" fill={DOMAIN_COLORS.workforce} name="Workforce" barSize={32} />
        <Bar dataKey="revenueValue"   stackId="value" fill={DOMAIN_COLORS.revenue}   name="Revenue"   barSize={32} />
        <Bar dataKey="qualityValue"   stackId="value" fill={DOMAIN_COLORS.quality}   name="Quality"   barSize={32} />

        {/* Sensitivity envelope */}
        <Line dataKey="valueHigh" stroke={VALUE_BAND_COLOR} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Value +25%" legendType="none" />
        <Line dataKey="valueLow"  stroke={VALUE_BAND_COLOR} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Value −25%" legendType="none" />

        {/* Cost line per scenario */}
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

        {/* Tier crossing dots */}
        {tierCrossings.map((tc, i) => {
          const scenarioIdx = scenarios.findIndex(s => s.id === tc.scenarioId);
          return (
            <ReferenceDot
              key={i}
              x={tc.year}
              y={tc.investment}
              r={5}
              fill={SCENARIO_LINE_COLORS[scenarioIdx % SCENARIO_LINE_COLORS.length]}
              stroke="white"
              strokeWidth={2}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -30`

Expected: no new errors related to `PricingComparisonChart.tsx`

- [ ] **Step 3: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/components/measure/PricingComparisonChart.tsx
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat: add PricingComparisonChart component"
```

---

### Task 4: Rename props in PricingScenarioCard.tsx

**Files:**
- Modify: `client/src/components/measure/PricingScenarioCard.tsx`

The goal: rename `combinedProviders` → `displayProviders`, `combinedEncounters` → `displayEncounters`, `combinedValue` → `displayValue` everywhere in this file. No logic changes.

- [ ] **Step 1: Update interface and destructure**

In `client/src/components/measure/PricingScenarioCard.tsx`, replace the interface (lines 13–21) and destructuring (lines 23–31):

```ts
interface PricingScenarioCardProps {
  scenario: PricingScenario;
  displayProviders: number;
  displayEncounters: number;
  displayValue: number;
  isBestValue: boolean;
  onUpdate: (updates: Partial<PricingScenario>) => void;
  onRemove: () => void;
}

export default function PricingScenarioCard({
  scenario,
  displayProviders,
  displayEncounters,
  displayValue,
  isBestValue,
  onUpdate,
  onRemove,
}: PricingScenarioCardProps) {
```

- [ ] **Step 2: Update body references**

In the component body, replace:
- `combinedProviders` → `displayProviders` (line 32)
- `combinedEncounters` → `displayEncounters` (line 33)
- `combinedValue` → `displayValue` (line 36–37)

The `scale` computation (line 32) becomes:
```ts
const scale = scenario.model === 'perProvider' ? displayProviders
            : scenario.model === 'perEncounter' ? displayEncounters
            : 0;
const { value: investment, tier: appliedTier, warning } = computeScenarioInvestment(scenario, scale);
const net = displayValue - investment;
const roi = investment > 0 ? displayValue / investment : 0;
```

The tier-applied label (line 233) references `scale` (unchanged — already uses the local `scale` variable).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -30`

Expected: TypeScript errors on `MeasureForecast.tsx` because it still passes the old prop names — that's correct and expected. Only `PricingScenarioCard.tsx` errors would be a problem.

- [ ] **Step 4: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/components/measure/PricingScenarioCard.tsx
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "refactor: rename combined* props to display* in PricingScenarioCard"
```

---

### Task 5: Wire everything in MeasureForecast.tsx

**Files:**
- Modify: `client/src/pages/measure/MeasureForecast.tsx`

- [ ] **Step 1: Add new imports**

At the top of `MeasureForecast.tsx`, add to the existing `forecastPricing` import line (line 10):

```ts
import {
  computeScenarioInvestment,
  computePricingTimeSeries,
  makeDefaultTiers,
  type PricingScenario,
  type PricingTimeSeriesPoint,
} from "@/lib/forecastPricing";
```

Also add:
```ts
import PricingComparisonChart from "@/components/measure/PricingComparisonChart";
```

- [ ] **Step 2: Add quadrantRatios and pricingTimeSeries useMemos**

After the existing `bestValueScenarioId` useMemo (around line 226), add:

```ts
const quadrantRatios = useMemo(() => {
  const total = combinedTotal;
  if (total === 0) return { capacity: 0.25, workforce: 0.25, revenue: 0.25, quality: 0.25 };
  return {
    capacity:  totalsByQuadrant.Capacity.projected  / total,
    workforce: totalsByQuadrant.Workforce.projected / total,
    revenue:   totalsByQuadrant.Revenue.projected   / total,
    quality:   totalsByQuadrant.Quality.projected   / total,
  };
}, [totalsByQuadrant, combinedTotal]);

const pricingTimeSeries = useMemo(() => {
  if (pricingScenarios.length === 0 || combinedTotal === 0) {
    return { points: [] as PricingTimeSeriesPoint[], tierCrossings: [] };
  }
  return computePricingTimeSeries(
    pricingScenarios,
    combinedProviders,
    combinedEncounters,
    state.forecastScenario?.annualProviderGrowthPct ?? 0,
    state.forecastScenario?.chartYears ?? 3,
    combinedTotal,
    quadrantRatios,
  );
}, [pricingScenarios, combinedProviders, combinedEncounters, combinedTotal, quadrantRatios, state.forecastScenario?.annualProviderGrowthPct, state.forecastScenario?.chartYears]);

const finalPoint = pricingTimeSeries.points[pricingTimeSeries.points.length - 1];
const finalYearProviders  = finalPoint?.providers  ?? combinedProviders;
const finalYearEncounters = finalPoint?.encounters ?? combinedEncounters;
const finalYearValue      = finalPoint?.totalValue ?? combinedTotal;
```

- [ ] **Step 3: Add updateGrowthConfig helper**

After `updateForecastScenario` (around line 131), add:

```ts
const updateGrowthPct = (v: number) => updateForecastScenario({ annualProviderGrowthPct: Math.max(0, Math.min(100, v)) });
const updateChartYears = (v: 3 | 5 | 10) => updateForecastScenario({ chartYears: v });
const growthPct = state.forecastScenario?.annualProviderGrowthPct ?? 0;
const chartYears = (state.forecastScenario?.chartYears ?? 3) as 3 | 5 | 10;
```

- [ ] **Step 4: Replace Pricing Comparison section JSX**

Find the `{/* Pricing Comparison */}` motion.div block (lines 491–536). Replace its contents with:

```tsx
{/* Pricing Comparison */}
<motion.div
  className="mt-8"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.3 }}
>
  <div className="flex items-center justify-between mb-3">
    <p className="text-xs font-medium text-[#888888] uppercase tracking-[1.5px]">Pricing Comparison</p>
  </div>

  {pricingScenarios.length === 0 && (
    <div className="bg-[#F5F0EB] rounded-lg p-6 text-center mb-3" data-testid="text-no-pricing-scenarios">
      <DollarSign className="w-8 h-8 text-[#888888] mx-auto mb-2" />
      <p className="text-sm text-[#666666] mb-1">Compare pricing models at projected scale.</p>
      <p className="text-xs text-[#888888]">Add the customer's current contract terms and any alternatives you want to model.</p>
    </div>
  )}

  {pricingScenarios.length > 0 && (
    <>
      {/* Growth config row */}
      <div className="flex items-center gap-6 mb-4 flex-wrap">
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
              className="w-12 text-center text-sm font-medium border border-[#E5E5E5] rounded-lg px-1 py-0.5 focus:outline-none focus:border-[#EA2C00]"
              data-testid="input-annual-growth-pct"
            />
            <span className="text-xs text-[#8C7E6E]">%</span>
          </div>
        </div>
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

      {/* Chart */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 mb-4">
        <PricingComparisonChart
          points={pricingTimeSeries.points}
          tierCrossings={pricingTimeSeries.tierCrossings}
          scenarios={pricingScenarios}
        />
      </div>

      {/* Cards */}
      <div className={pricingScenarios.length >= 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
        {pricingScenarios.map(scenario => (
          <PricingScenarioCard
            key={scenario.id}
            scenario={scenario}
            displayProviders={finalYearProviders}
            displayEncounters={finalYearEncounters}
            displayValue={finalYearValue}
            isBestValue={bestValueScenarioId === scenario.id}
            onUpdate={(updates) => updatePricingScenario(scenario.id, updates)}
            onRemove={() => removePricingScenario(scenario.id)}
          />
        ))}
      </div>
    </>
  )}

  <button
    onClick={addPricingScenario}
    className="w-full mt-3 py-3 px-4 rounded-lg border-2 border-dashed border-[#E5E5E5] text-sm font-medium text-[#666666] hover:border-[#EA2C00] hover:text-[#EA2C00] transition-all flex items-center justify-center gap-1.5"
    data-testid="button-add-pricing-scenario"
  >
    <Plus className="w-4 h-4" /> Add a pricing scenario
  </button>
</motion.div>
```

- [ ] **Step 5: Verify TypeScript compiles clean**

Run: `cd "/Users/brad/Downloads/The-ROI-Calculator 2" && npx tsc --noEmit 2>&1 | head -40`

Expected: no new type errors. The `combined*` → `display*` rename is now resolved since MeasureForecast now passes `display*` props.

- [ ] **Step 6: Commit**

```bash
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" add client/src/pages/measure/MeasureForecast.tsx
git -C "/Users/brad/Downloads/The-ROI-Calculator 2" commit -m "feat: wire PricingComparisonChart and growth config into MeasureForecast"
```
