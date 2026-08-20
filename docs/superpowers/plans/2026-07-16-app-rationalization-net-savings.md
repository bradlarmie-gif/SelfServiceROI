# App Rationalization — Abridge Price & Net Savings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single Abridge price to App Rationalization and surface net savings (what sunsets onto Abridge minus the price) on the Applications total bar, a new Consolidation ledger, and the roadmap summary.

**Architecture:** A pure `computeNet(items, abridgePrice)` helper is the single source for the net figures; `computeRoadmap` gains an optional `abridgePrice` and returns `netSavings`. The UI adds one flow-level `abridgePrice` input in the Applications header, a new `ConsolidationLedger` component (editorial ledger + vertical proportion bar) above the untouched two-sink chart, and flips the roadmap hero to the net run-rate. Everything is additive/optional per task so the typecheck stays green throughout.

**Tech Stack:** React + TypeScript (strict), Vite, Tailwind, framer-motion, `AnimatedValue`, `NumberField`, vitest.

## Global Constraints

- No em dashes anywhere in copy or comments; use "·", ":", or a period. For a subtracted amount use a minus sign "−".
- User-facing copy uses **"sunset" / "Sunsets onto Abridge"** (rename from "to Abridge"), never "coverage." Internal fields stay `coveragePct` / `toAbridge`.
- `.font-abridge` on the ledger heading; Manrope UI; `AnimatedValue` count-ups; tabular-nums.
- Colors: coral `#EA2C00` for savings, deep coral `#B23A12` for the Abridge-price segment, taupe `#D8CEC1` for stays, neutral ink `#1A1A1A` for a net cost. No stoplight colors, no status pills.
- The two-sink `ConsolidationFlow` visual and the `RoadmapChart` bars do not change; only inputs and summary numbers change.
- Abridge price is a single flow-level number (not per-item), clamped `>= 0`, default `0`. Price/net lines appear only when price > 0.
- Net cost (price > sunset): show it plainly; never draw a negative proportion segment.
- Verify each task with `npx tsc --noEmit -p tsconfig.json` (0 errors) and `npx vitest run` (all green). Run `npm run build` for UI tasks. This environment cannot render the app; math is unit-tested, visuals verified on Replit.

---

### Task 1: `computeNet` in the calc module

**Files:**
- Modify: `client/src/lib/appRationalizationCalc.ts`
- Test: `client/src/__tests__/appRationalizationNet.test.ts` (create)

**Interfaces:**
- Consumes: `computeTotals`, `AppRatItem` (existing).
- Produces:
  - `interface AppRatNet { stackTotal: number; sunset: number; stays: number; abridgePrice: number; netSavings: number; isNetCost: boolean; }`
  - `computeNet(items: AppRatItem[], abridgePrice: number): AppRatNet`

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/appRationalizationNet.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeNet, type AppRatItem } from "@/lib/appRationalizationCalc";

const mk = (o: Partial<AppRatItem>): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 0, coveragePct: 80, when: "thisYear", ...o,
});

// 180K@60% + 140K@50% + 100K@80% => sunset 108+70+80 = 258K, stays 162K, stack 420K
const stack: AppRatItem[] = [
  mk({ id: "a", annualSpend: 180_000, coveragePct: 60 }),
  mk({ id: "b", annualSpend: 140_000, coveragePct: 50 }),
  mk({ id: "c", annualSpend: 100_000, coveragePct: 80 }),
];

describe("computeNet", () => {
  it("net = sunset - price with a positive price", () => {
    const n = computeNet(stack, 120_000);
    expect(n.stackTotal).toBe(420_000);
    expect(n.sunset).toBe(258_000);
    expect(n.stays).toBe(162_000);
    expect(n.abridgePrice).toBe(120_000);
    expect(n.netSavings).toBe(138_000);
    expect(n.isNetCost).toBe(false);
  });
  it("price 0 -> net equals sunset, not a net cost", () => {
    const n = computeNet(stack, 0);
    expect(n.netSavings).toBe(258_000);
    expect(n.isNetCost).toBe(false);
  });
  it("price above sunset -> negative net, isNetCost true", () => {
    const n = computeNet(stack, 300_000);
    expect(n.netSavings).toBe(-42_000);
    expect(n.isNetCost).toBe(true);
  });
  it("negative price input clamps to 0", () => {
    const n = computeNet(stack, -50_000);
    expect(n.abridgePrice).toBe(0);
    expect(n.netSavings).toBe(258_000);
  });
  it("empty stack is zero-safe", () => {
    expect(computeNet([], 0)).toEqual({
      stackTotal: 0, sunset: 0, stays: 0, abridgePrice: 0, netSavings: 0, isNetCost: false,
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/appRationalizationNet.test.ts`
Expected: FAIL — `computeNet` is not exported.

- [ ] **Step 3: Implement `computeNet`**

In `client/src/lib/appRationalizationCalc.ts`, immediately after the `computeTotals` function (it ends with `return { stackTotal, toAbridge, stays, pctToAbridge };` and its closing `}`), add:

```ts
export interface AppRatNet {
  stackTotal: number;
  sunset: number;       // what consolidates onto Abridge (= computeTotals().toAbridge)
  stays: number;
  abridgePrice: number; // clamped >= 0
  netSavings: number;   // sunset - abridgePrice; may be negative (a net cost)
  isNetCost: boolean;   // netSavings < 0
}

/** Nets the single Abridge price against what sunsets onto Abridge. */
export function computeNet(items: AppRatItem[], abridgePrice: number): AppRatNet {
  const t = computeTotals(items);
  const price = Math.max(0, abridgePrice || 0);
  const netSavings = t.toAbridge - price;
  return {
    stackTotal: t.stackTotal,
    sunset: t.toAbridge,
    stays: t.stays,
    abridgePrice: price,
    netSavings,
    isNetCost: netSavings < 0,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/appRationalizationNet.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/lib/appRationalizationCalc.ts client/src/__tests__/appRationalizationNet.test.ts
git commit -m "feat: computeNet for app rationalization net savings"
```

---

### Task 2: Net savings in the roadmap model

**Files:**
- Modify: `client/src/lib/appRationalizationRoadmap.ts`
- Test: `client/src/__tests__/appRationalizationRoadmap.test.ts`

**Interfaces:**
- Consumes: `computeRoadmap` (existing).
- Produces: `computeRoadmap(items: AppRatItem[], termYears: number, abridgePrice?: number): Roadmap`; `Roadmap` gains `abridgePrice: number` and `netSavings: number`.

- [ ] **Step 1: Add the failing tests**

In `client/src/__tests__/appRationalizationRoadmap.test.ts`, add these three tests immediately before the final closing `});` of the `describe` block (the stack's `totalRetired` is `3_840_000`):

```ts
  it("nets the Abridge price into netSavings", () => {
    const rmP = computeRoadmap(stack, 3, 1_000_000);
    expect(rmP.abridgePrice).toBe(1_000_000);
    expect(rmP.netSavings).toBe(2_840_000);
  });
  it("defaults abridgePrice to 0 so netSavings equals totalRetired", () => {
    expect(rm.abridgePrice).toBe(0);
    expect(rm.netSavings).toBe(3_840_000);
  });
  it("net can go negative when the price exceeds what retires", () => {
    const rmC = computeRoadmap(stack, 3, 5_000_000);
    expect(rmC.netSavings).toBe(-1_160_000);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/appRationalizationRoadmap.test.ts`
Expected: FAIL — `abridgePrice`/`netSavings` do not exist on `Roadmap`.

- [ ] **Step 3: Add the fields to the `Roadmap` interface**

In `client/src/lib/appRationalizationRoadmap.ts`, in `export interface Roadmap`, add two fields after `totalRetired: number;`:

```ts
  totalRetired: number;
  abridgePrice: number;
  netSavings: number;
  endStays: number;
```

- [ ] **Step 4: Add the param and compute the net**

Change the signature line:

```ts
export function computeRoadmap(items: AppRatItem[], termYears: number): Roadmap {
```

to:

```ts
export function computeRoadmap(items: AppRatItem[], termYears: number, abridgePrice = 0): Roadmap {
```

Then change the final return statement:

```ts
  return { termYears: term, snapshots, deltas, totalRetired, endStays, read };
```

to:

```ts
  const price = Math.max(0, abridgePrice || 0);
  return { termYears: term, snapshots, deltas, totalRetired, abridgePrice: price, netSavings: totalRetired - price, endStays, read };
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/appRationalizationRoadmap.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: all roadmap tests PASS; tsc 0 errors (the existing 2-arg `computeRoadmap` call in `RoadmapChart` still compiles because the new arg is optional).

- [ ] **Step 6: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/lib/appRationalizationRoadmap.ts client/src/__tests__/appRationalizationRoadmap.test.ts
git commit -m "feat: net savings in the roadmap model"
```

---

### Task 3: `ConsolidationLedger` component

**Files:**
- Create: `client/src/components/forecast/ConsolidationLedger.tsx`

**Interfaces:**
- Consumes: `computeNet`, `AppRatItem` (Task 1); `AnimatedValue`.
- Produces: `export default function ConsolidationLedger({ items, abridgePrice }: { items: AppRatItem[]; abridgePrice: number })`.

- [ ] **Step 1: Create the component**

Create `client/src/components/forecast/ConsolidationLedger.tsx`:

```tsx
import { useMemo } from "react";
import { AnimatedValue } from "@/components/explore/AnimatedValue";
import { computeNet, type AppRatItem } from "@/lib/appRationalizationCalc";

function fmtM(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(a / 1_000)}K`;
  return `$${Math.round(a)}`;
}

export default function ConsolidationLedger({
  items, abridgePrice,
}: { items: AppRatItem[]; abridgePrice: number }) {
  const net = useMemo(() => computeNet(items, abridgePrice), [items, abridgePrice]);
  const hasPrice = net.abridgePrice > 0;

  // Segments of the whole stack for the vertical bar. Positive net:
  // Net savings + Abridge price + Stays = stackTotal. Net cost: no negative
  // segment, show Sunsets + Stays only.
  const total = Math.max(1, net.stackTotal);
  const pct = (v: number) => `${(v / total) * 100}%`;
  const segments = net.isNetCost
    ? [
        { key: "sunset", label: "Sunsets onto Abridge", value: net.sunset, color: "#EA2C00" },
        { key: "stays",  label: "Stays in place",       value: net.stays,  color: "#D8CEC1" },
      ]
    : [
        { key: "net",   label: "Net savings",    value: Math.max(0, net.netSavings), color: "#EA2C00" },
        ...(hasPrice ? [{ key: "price", label: "Abridge price", value: net.abridgePrice, color: "#B23A12" }] : []),
        { key: "stays", label: "Stays in place", value: net.stays, color: "#D8CEC1" },
      ];

  const netLabel = net.isNetCost ? "Net cost / yr" : "Net savings / yr";

  return (
    <div
      className="bg-white border border-[#E8E2DA] rounded-[18px] p-6 md:p-7 grid grid-cols-1 md:grid-cols-[1fr_1px_minmax(220px,0.9fr)] gap-6 md:gap-7 items-center"
      data-testid="ar-consolidation-ledger"
    >
      {/* Left: ledger */}
      <div>
        <div className="font-abridge uppercase tracking-[0.03em] text-[17px] text-[#1A1A1A] mb-4">The Consolidation</div>

        <div className="flex justify-between items-baseline text-sm mt-2.5">
          <span className="text-[#6B6B6B]">Sunsets onto Abridge</span>
          <AnimatedValue value={net.sunset} format={fmtM} className="font-bold text-[#1A1A1A] tabular-nums" />
        </div>

        {hasPrice && (
          <div className="flex justify-between items-baseline text-sm mt-2.5">
            <span className="text-[#6B6B6B]">Abridge price</span>
            <AnimatedValue value={net.abridgePrice} format={(v) => `−${fmtM(v)}`} className="font-bold text-[#8C7E6E] tabular-nums" />
          </div>
        )}

        <div className="border-t border-[#E8E2DA] mt-3.5 mb-1" />

        <div className="flex justify-between items-baseline mt-3">
          <span className="text-[13px] font-bold text-[#1A1A1A]">{netLabel}</span>
          <AnimatedValue
            value={Math.abs(net.netSavings)}
            format={fmtM}
            className={`text-[34px] font-extrabold tabular-nums ${net.isNetCost ? "text-[#1A1A1A]" : "text-[#EA2C00]"}`}
            style={{ letterSpacing: "-0.01em" }}
            data-testid="ar-ledger-net"
          />
        </div>
        <div className="text-[12px] text-[#8C7E6E] mt-1.5">+ {fmtM(net.stays)} stays in place</div>
      </div>

      {/* Divider */}
      <div className="hidden md:block bg-[#E8E2DA] w-px h-full" />

      {/* Right: vertical proportion bar */}
      <div className="flex items-center gap-4">
        <div
          className="w-[46px] h-[210px] rounded-[10px] overflow-hidden flex flex-col shrink-0"
          style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,.03)" }}
          data-testid="ar-ledger-bar"
        >
          {segments.map((s) => (
            <div key={s.key} style={{ height: pct(s.value), background: s.color }} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C7E6E] mb-3">Your {fmtM(net.stackTotal)} stack</div>
          {segments.map((s) => (
            <div key={s.key} className="mb-3">
              <div className="text-[11px] text-[#6B6B6B] flex items-center gap-2">
                <i className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: s.color }} />
                {s.label}
              </div>
              <div className="text-[15px] font-extrabold text-[#1A1A1A] tabular-nums mt-0.5">{fmtM(s.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: tsc 0 errors; build succeeds (component not imported yet, which is fine).

- [ ] **Step 3: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/components/forecast/ConsolidationLedger.tsx
git commit -m "feat: ConsolidationLedger with net savings and stack proportion bar"
```

---

### Task 4: Net hero on the roadmap

**Files:**
- Modify: `client/src/components/forecast/RoadmapChart.tsx`

**Interfaces:**
- Consumes: `Roadmap.netSavings` / `Roadmap.abridgePrice` (Task 2).
- Produces: `RoadmapChart` accepts an optional `abridgePrice?: number` prop.

- [ ] **Step 1: Add the prop and pass it through**

In `client/src/components/forecast/RoadmapChart.tsx`, change the signature line:

```tsx
export default function RoadmapChart({ items, termYears }: { items: AppRatItem[]; termYears: number }) {
  const rm = useMemo(() => computeRoadmap(items, termYears), [items, termYears]);
```

to:

```tsx
export default function RoadmapChart({ items, termYears, abridgePrice = 0 }: { items: AppRatItem[]; termYears: number; abridgePrice?: number }) {
  const rm = useMemo(() => computeRoadmap(items, termYears, abridgePrice), [items, termYears, abridgePrice]);
```

- [ ] **Step 2: Flip the hero to the net run-rate**

Replace the hero block:

```tsx
        <div className="text-right leading-none">
          <AnimatedValue value={rm.totalRetired} format={(v) => `−${fmtM(v)}`} className="text-[30px] font-extrabold text-[#EA2C00] tracking-tight tabular-nums" />
          <div className="text-[11px] text-[#8C7E6E] font-semibold mt-1.5">retired across {rm.termYears} {rm.termYears === 1 ? "year" : "years"}</div>
        </div>
```

with:

```tsx
        <div className="text-right leading-none">
          <AnimatedValue
            value={Math.abs(rm.netSavings)}
            format={fmtM}
            className={`text-[30px] font-extrabold tracking-tight tabular-nums ${rm.netSavings < 0 ? "text-[#1A1A1A]" : "text-[#EA2C00]"}`}
          />
          <div className="text-[11px] text-[#8C7E6E] font-semibold mt-1.5">
            {rm.netSavings < 0 ? "net cost / yr" : (rm.abridgePrice > 0 ? "net savings / yr, after Abridge" : "net savings / yr")}
          </div>
        </div>
```

- [ ] **Step 3: Typecheck + build**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json && npx vitest run && npm run build`
Expected: tsc 0 errors; all tests green; build succeeds. (The `AppRationalizationFlow` call `<RoadmapChart items={items} termYears={termYears} />` still compiles because `abridgePrice` is optional; the hero shows net savings equal to totalRetired until the price is wired in Task 5.)

- [ ] **Step 4: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/components/forecast/RoadmapChart.tsx
git commit -m "feat: roadmap hero shows net savings run-rate"
```

---

### Task 5: Wire the Abridge price through the flow

Add the flow-level `abridgePrice`, the header input, the net on the total bar, the Consolidation ledger, and the roadmap price.

**Files:**
- Modify (full rewrite): `client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx`
- Modify (full rewrite): `client/src/pages/forecast/AppRationalizationFlow.tsx`

**Interfaces:**
- Consumes: `computeNet` (Task 1), `ConsolidationLedger` (Task 3), `RoadmapChart` `abridgePrice` prop (Task 4), `NumberField`.
- Produces: `ArApplicationsStep` gains props `abridgePrice: number` and `onAbridgePriceChange: (v: number) => void`.

- [ ] **Step 1: Rewrite the Applications step**

Replace the entire contents of `client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx` with:

```tsx
import { useMemo } from "react";
import ArCommandSearch from "./ArCommandSearch";
import ArStackRow from "./ArStackRow";
import { NumberField } from "@/components/NumberField";
import { computeNet, type AppRatItem, type AppRatCategoryId } from "@/lib/appRationalizationCalc";

function fmtM(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(a / 1_000)}K`;
  return `$${Math.round(a)}`;
}

const COL_HEADERS = ["Application", "Annual spend", "How much could you displace?", "Over", "Displaceable"];

export default function ArApplicationsStep({
  items, orgName, onOrgNameChange, abridgePrice, onAbridgePriceChange, onAdd, onUpdate, onRemove, onContinue,
}: {
  items: AppRatItem[];
  orgName: string;
  onOrgNameChange: (v: string) => void;
  abridgePrice: number;
  onAbridgePriceChange: (v: number) => void;
  onAdd: (category: AppRatCategoryId, vendorName?: string) => void;
  onUpdate: (id: string, patch: Partial<AppRatItem>) => void;
  onRemove: (id: string) => void;
  onContinue: () => void;
}) {
  const net = useMemo(() => computeNet(items, abridgePrice), [items, abridgePrice]);
  const pctSunset = net.stackTotal > 0 ? Math.round((net.sunset / net.stackTotal) * 100) : 0;

  return (
    <div className="max-w-[1120px] mx-auto px-6 py-8">
      {/* Header: title + org + Abridge price */}
      <div className="flex items-start justify-between gap-6 mb-2">
        <div>
          <h1 className="font-abridge text-4xl uppercase tracking-tight text-[#1A1A1A]">Applications</h1>
          <p className="text-sm text-[#6B6B6B] mt-2.5">Browse the capabilities, or type a vendor and we place it for you.</p>
        </div>
        <div className="flex items-end gap-3 shrink-0">
          <div className="flex flex-col items-start gap-1.5">
            <label htmlFor="ar-org" className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8C7E6E]">Organization</label>
            <input
              id="ar-org"
              value={orgName}
              onChange={(e) => onOrgNameChange(e.target.value)}
              placeholder="Organization name"
              className="w-[180px] h-9 bg-white border border-[#E8E2DA] rounded-[9px] px-3 text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A] placeholder-[#B4A99B]"
              data-testid="ar-org-name"
            />
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <label className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8C7E6E]">Abridge price / yr</label>
            <div className="flex items-center h-9 bg-white border border-[#E8E2DA] rounded-[9px] px-3 gap-1 focus-within:border-[#1A1A1A]">
              <span className="text-[#8C7E6E] text-[13px]">$</span>
              <NumberField
                value={abridgePrice}
                onValueChange={onAbridgePriceChange}
                min={0}
                className="w-[120px] bg-transparent text-[13px] text-[#1A1A1A] outline-none tabular-nums"
                data-testid="ar-abridge-price"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hero command search */}
      <div className="mt-6"><ArCommandSearch onSelect={onAdd} /></div>

      {items.length > 0 && (
        <>
          <div className="text-[11px] font-bold uppercase tracking-[2px] text-[#8C7E6E] mt-8 mb-3" data-testid="ar-stack-count">
            Your stack · {items.length} added
          </div>

          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[1fr_120px_190px_150px_120px] gap-3.5 px-4 pb-2">
            {COL_HEADERS.map((h, i) => (
              <span key={h} className={`text-[9px] font-bold uppercase tracking-[0.13em] text-[#B4A99B] ${i === COL_HEADERS.length - 1 ? "text-right" : ""}`}>{h}</span>
            ))}
          </div>

          {items.map((it) => (
            <ArStackRow key={it.id} item={it} onChange={(p) => onUpdate(it.id, p)} onRemove={() => onRemove(it.id)} />
          ))}

          {/* Slim total bar with the net */}
          <div className="flex flex-wrap items-center gap-4 mt-4 px-5 py-4 bg-[#FAF8F5] border border-[#E8E2DA] rounded-2xl">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8C7E6E]">Stack today</div>
              <div className="text-[19px] font-extrabold text-[#1A1A1A] tabular-nums">
                {fmtM(net.stackTotal)} <span className="text-[12px] font-medium text-[#8C7E6E]">/ yr</span>
              </div>
            </div>
            <div className="h-2 rounded-md overflow-hidden flex" style={{ width: 170 }}>
              <div style={{ width: `${pctSunset}%`, background: "#EA2C00" }} />
              <div style={{ width: `${100 - pctSunset}%`, background: "#D8CEC1" }} />
            </div>
            <div className="text-[12.5px] text-[#6B6B6B] tabular-nums">
              <b className="text-[#1A1A1A]">{fmtM(net.sunset)}</b> sunsets onto Abridge
              {net.abridgePrice > 0 && (
                <>
                  {" · −"}{fmtM(net.abridgePrice)} Abridge{" · "}
                  <b className={net.isNetCost ? "text-[#1A1A1A]" : "text-[#EA2C00]"}>{fmtM(Math.abs(net.netSavings))}</b>
                  {net.isNetCost ? " net cost" : " net"}
                </>
              )}
              {" · "}{fmtM(net.stays)} stays
            </div>
            <button
              onClick={onContinue}
              className="ml-auto h-11 px-5 rounded-xl bg-[#EA2C00] text-white text-sm font-bold"
              data-testid="ar-see-consolidation"
            >
              See the consolidation →
            </button>
          </div>
        </>
      )}

      {items.length === 0 && (
        <p className="text-center text-[13px] text-[#8C7E6E] mt-10" data-testid="ar-empty-hint">
          Search a vendor or pick a capability above to start building the stack.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the flow**

Replace the entire contents of `client/src/pages/forecast/AppRationalizationFlow.tsx` with:

```tsx
import { useRef, useState } from "react";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { type AppRatItem, type AppRatCategoryId, makeItem } from "@/lib/appRationalizationCalc";
import ArApplicationsStep from "./appRationalization/ArApplicationsStep";
import ConsolidationFlow from "@/components/forecast/ConsolidationFlow";
import ConsolidationLedger from "@/components/forecast/ConsolidationLedger";
import RoadmapChart from "@/components/forecast/RoadmapChart";

type ArStep = "applications" | "consolidation" | "change";

interface AppRationalizationFlowProps {
  onBack: () => void;
  onHome: () => void;
}

const STEP_INDEX: Record<ArStep, number> = { applications: 1, consolidation: 2, change: 3 };
const STEP_LABELS = ["Applications", "Consolidation", "The change"];
const TERM_OPTIONS = [2, 3, 4, 5];

export default function AppRationalizationFlow({ onBack, onHome }: AppRationalizationFlowProps) {
  const [step, setStep] = useState<ArStep>("applications");
  const [orgName, setOrgName] = useState("");
  const [abridgePrice, setAbridgePrice] = useState(0);
  const [termYears, setTermYears] = useState(3);
  const [items, setItems] = useState<AppRatItem[]>([]);
  const nextId = useRef(0);

  const addItem = (category: AppRatCategoryId, vendorName?: string) =>
    setItems((prev) => [...prev, { ...makeItem(`ar-${nextId.current++}`, category), vendorName }]);
  const updateItem = (id: string, patch: Partial<AppRatItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <UnifiedHeader
        pathType="forecast"
        stepName="App Rationalization"
        currentStep={STEP_INDEX[step]}
        totalSteps={3}
        stepLabels={STEP_LABELS}
        onBack={onBack}
        onHome={onHome}
      />
      <div className="pt-14 sm:pt-16">
        {step === "applications" && (
          <ArApplicationsStep
            items={items}
            orgName={orgName}
            onOrgNameChange={setOrgName}
            abridgePrice={abridgePrice}
            onAbridgePriceChange={setAbridgePrice}
            onAdd={addItem}
            onUpdate={updateItem}
            onRemove={removeItem}
            onContinue={() => setStep("consolidation")}
          />
        )}

        {step === "consolidation" && (
          <div data-testid="ar-step-consolidation" className="max-w-[1120px] mx-auto px-6 py-8">
            <ConsolidationLedger items={items} abridgePrice={abridgePrice} />
            <div className="mt-6"><ConsolidationFlow items={items} /></div>

            {/* On-demand "why" proof, on the way. Placeholder until the team lands the rationale copy. */}
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#E8E2DA] bg-white/60 px-5 py-4" data-testid="ar-why-coming-soon">
              <span className="text-sm font-semibold text-[#1A1A1A]">Why Abridge can take these on</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#8C7E6E] bg-[#F5F0EB] border border-[#E8E2DA] rounded-full px-2.5 py-1">Coming soon</span>
              <span className="text-[12.5px] text-[#8C7E6E] ml-auto hidden sm:block">The case for each capability is on the way.</span>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6">
              <button onClick={() => setStep("applications")} className="text-sm font-semibold text-[#8C7E6E] hover:text-[#1A1A1A] transition-colors" data-testid="ar-back-to-applications">← Back to applications</button>
              <button onClick={() => setStep("change")} className="h-11 px-6 rounded-xl bg-[#EA2C00] text-white text-sm font-semibold" data-testid="ar-see-the-change">See the change →</button>
            </div>
          </div>
        )}

        {step === "change" && (
          <div data-testid="ar-step-change" className="max-w-[940px] mx-auto px-6 py-8">
            <h1 className="font-abridge text-4xl uppercase tracking-tight text-[#1A1A1A] text-center">The change</h1>
            <p className="text-[15px] text-[#6B6B6B] text-center mt-3 mb-6">
              Watch the stack come apart, tool by tool, as each reaches a point where Abridge can take it on.
            </p>
            <div className="flex items-center justify-center gap-2.5 mb-6" data-testid="ar-term-control">
              <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#8C7E6E]">Contract term</span>
              <select
                value={termYears}
                onChange={(e) => setTermYears(Number(e.target.value))}
                className="h-9 bg-white border border-[#E8E2DA] rounded-[9px] px-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                data-testid="ar-term-select"
              >
                {TERM_OPTIONS.map((y) => <option key={y} value={y}>{y} years</option>)}
              </select>
            </div>
            <RoadmapChart items={items} termYears={termYears} abridgePrice={abridgePrice} />
            <div className="mt-8 text-center">
              <button onClick={() => setStep("consolidation")} className="text-sm font-semibold text-[#8C7E6E] hover:text-[#1A1A1A] transition-colors" data-testid="ar-back-to-consolidation">← Back to the consolidation</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

Note: the page-level `<h1>Consolidation</h1>` and the old one-line headline are intentionally removed; the `ConsolidationLedger`'s "The Consolidation" heading now leads the step. The `AnimatedValue` and `computeTotals` imports are dropped from the flow because the ledger owns those numbers now.

- [ ] **Step 3: Typecheck, test, build**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json && npx vitest run && npm run build`
Expected: tsc 0 errors; all tests green; build succeeds.

- [ ] **Step 4: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/pages/forecast/AppRationalizationFlow.tsx client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx
git commit -m "feat: wire Abridge price into applications, consolidation ledger, and roadmap"
```

---

## Self-Review

**1. Spec coverage:**
- `AppRatNet` + `computeNet` (§4) → Task 1. ✓
- Single flow-level `abridgePrice`, default 0, clamped (§4, §5) → Task 5 state + `computeNet` clamp. ✓
- Abridge price input in the header (§5) → Task 5 ArApplicationsStep. ✓
- Applications total bar net, only when price > 0 (§6a) → Task 5. ✓
- Consolidation editorial ledger + vertical proportion bar, net-cost edge, "The Consolidation" Abridge-font heading (§6b) → Task 3 + rendered in Task 5. ✓
- Roadmap `abridgePrice`/`netSavings` + net hero, bars unchanged (§7) → Tasks 2 + 4. ✓
- Rename "to Abridge" → "Sunsets onto Abridge"; internal fields unchanged (§10) → ledger/total-bar copy; `coveragePct`/`toAbridge` untouched. ✓
- Two-sink `ConsolidationFlow` untouched (§3) → still rendered as-is in Task 5. ✓

**2. Placeholder scan:** No TBD/TODO; every code step is complete; commands have expected output. ✓

**3. Type consistency:** `AppRatNet` field names (`stackTotal`/`sunset`/`stays`/`abridgePrice`/`netSavings`/`isNetCost`) are used identically in `ConsolidationLedger` and the total bar; `computeNet(items, abridgePrice)` and `computeRoadmap(items, termYears, abridgePrice?)` signatures match all call sites; `ArApplicationsStep` new props (`abridgePrice`, `onAbridgePriceChange`) match the flow's usage; `RoadmapChart` optional `abridgePrice` matches the flow's pass. ✓

**4. Green-per-task:** Tasks 1–4 are additive/optional (existing 2-arg `computeRoadmap` and prop-less `RoadmapChart` calls keep compiling); Task 5 introduces the required `ArApplicationsStep` props and updates the flow in the same task. Every task ends on tsc 0 + tests green. ✓

**5. Copy/brand:** No em dashes (subtraction uses "−"); "sunset" language; coral/deep-coral/taupe/ink palette; `.font-abridge` heading; `AnimatedValue` + tabular-nums; no stoplight colors/pills. ✓
