# App Rationalization — Phase 2 Implementation Plan (Consolidation hero)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase-1 consolidation placeholder with the real two-sink hero: each tool's spend splits into a coral flow to Abridge and a grey flow to "what stays," driven by a unit-tested pure layout function.

**Architecture:** A pure geometry module (`consolidationLayout.ts`) turns the item list into sankey coordinates (unit-tested, no rendering); a bespoke SVG component (`ConsolidationFlow.tsx`) renders those coordinates; the flow shell's consolidation step renders the honest headline plus that component. Ribbons are constant-thickness strokes proportional to dollars; each sink node's height is the sum of the ribbons landing in it, so sinks fill exactly by construction. Row spacing is fixed so labels stay legible regardless of a tool's spend.

**Tech Stack:** React + TypeScript, SVG, vitest. Reuses `appRationalizationCalc` derive math and the shared `AnimatedValue`.

## Global Constraints

- Copy: **no em dashes**; **no corporate jargon**; defensible voice ("what Abridge can take on", "stays"); never assert Abridge replaced a named competitor.
- Visual: coral `#EA2C00` + warm neutrals only; **no stoplight colors** (no green/amber/orange); **no status pills**. Dark hero panel uses `linear-gradient(155deg,#211D18,#141210)` (the app hero family). Grey "stays" is warm `#6B6258`/`#2A2621`, never green.
- Type: the Abridge display font (`.font-abridge`) for the step title; Manrope for all UI and SVG text; tabular numerals on figures.
- Reuse: `appRationalizationCalc` (`itemRetired`, `itemStays`, `computeTotals`, `itemDisplayName`, `categoryLabel`), and `AnimatedValue` from `@/components/explore/AnimatedValue`. Do NOT re-implement money math in the UI.
- Do NOT modify any Phase 1 file except the single consolidation placeholder block in `AppRationalizationFlow.tsx`. Do NOT touch Compare Pricing or `pricingComparisonCalc.ts`.
- Verify each task: `npx tsc --noEmit -p tsconfig.json` (0 errors) and `npx vitest run` (all green); UI tasks also `npm run build`. This environment cannot render SVG; the layout math is unit-tested and the visual is verified by the user on Replit.

---

### Task 1: Pure consolidation layout function + tests

**Files:**
- Create: `client/src/lib/consolidationLayout.ts`
- Test: `client/src/__tests__/consolidationLayout.test.ts`

**Interfaces:**
- Consumes: `itemRetired`, `itemStays`, `computeTotals`, `itemDisplayName`, `categoryLabel`, `type AppRatItem` from `@/lib/appRationalizationCalc`.
- Produces:
  - `interface LayoutSource { id; name; category; spend; coveragePct; retired; stays; rowCenterY; coralSrcY; greySrcY }` (all numbers except id/name/category strings)
  - `interface LayoutRibbon { id: string; kind: "retired" | "stays"; y1: number; y2: number; thickness: number }`
  - `interface LayoutNode { y: number; height: number }`
  - `interface ConsolidationLayout { width; height; ribbonStartX; sinkX; sinkWidth; sources: LayoutSource[]; ribbons: LayoutRibbon[]; abridge: LayoutNode; stays: LayoutNode; totals: { stackTotal; toAbridge; stays } }`
  - `interface LayoutOpts { width?; ribbonStartX?; sinkX?; sinkWidth?; topPad?; bottomPad?; rowGap?; sinkGap?; maxRibbonFrac? }`
  - `function computeConsolidationLayout(items: AppRatItem[], opts?: LayoutOpts): ConsolidationLayout`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/__tests__/consolidationLayout.test.ts
import { describe, it, expect } from "vitest";
import { computeConsolidationLayout } from "@/lib/consolidationLayout";
import { type AppRatItem } from "@/lib/appRationalizationCalc";

const item = (over: Partial<AppRatItem>): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 1_000_000, coveragePct: 80, transitionMonths: 12, ...over,
});

const coral = (l: ReturnType<typeof computeConsolidationLayout>) => l.ribbons.filter((r) => r.kind === "retired");
const grey = (l: ReturnType<typeof computeConsolidationLayout>) => l.ribbons.filter((r) => r.kind === "stays");
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

describe("computeConsolidationLayout", () => {
  it("ribbon thickness is proportional to the dollars it carries", () => {
    const l = computeConsolidationLayout([
      item({ id: "a", annualSpend: 1_800_000, coveragePct: 80 }), // retired 1.44M
      item({ id: "b", annualSpend: 1_000_000, coveragePct: 90 }), // retired 0.90M
    ]);
    const a = coral(l).find((r) => r.id === "a")!;
    const b = coral(l).find((r) => r.id === "b")!;
    expect(a.thickness / b.thickness).toBeCloseTo(1_440_000 / 900_000, 5);
  });

  it("the Abridge sink height equals the sum of coral ribbon thicknesses (filled exactly)", () => {
    const l = computeConsolidationLayout([
      item({ id: "a", annualSpend: 1_800_000, coveragePct: 80 }),
      item({ id: "b", annualSpend: 1_000_000, coveragePct: 90 }),
    ]);
    expect(sum(coral(l).map((r) => r.thickness))).toBeCloseTo(l.abridge.height, 5);
    expect(sum(grey(l).map((r) => r.thickness))).toBeCloseTo(l.stays.height, 5);
  });

  it("a 100%-coverage item produces no grey ribbon", () => {
    const l = computeConsolidationLayout([item({ id: "full", annualSpend: 700_000, coveragePct: 100 })]);
    expect(grey(l).some((r) => r.id === "full")).toBe(false);
    expect(coral(l).some((r) => r.id === "full")).toBe(true);
  });

  it("a 0%-coverage item produces no coral ribbon", () => {
    const l = computeConsolidationLayout([item({ id: "none", annualSpend: 500_000, coveragePct: 0 })]);
    expect(coral(l).some((r) => r.id === "none")).toBe(false);
    expect(grey(l).some((r) => r.id === "none")).toBe(true);
  });

  it("filters out items with zero spend and is empty-safe", () => {
    const l = computeConsolidationLayout([item({ id: "z", annualSpend: 0 })]);
    expect(l.sources).toHaveLength(0);
    expect(l.ribbons).toHaveLength(0);
    expect(l.abridge.height).toBe(0);
    expect(l.stays.height).toBe(0);
  });

  it("handles a single item", () => {
    const l = computeConsolidationLayout([item({ id: "solo", annualSpend: 1_000_000, coveragePct: 80 })]);
    expect(l.sources).toHaveLength(1);
    expect(coral(l)).toHaveLength(1);
    expect(grey(l)).toHaveLength(1);
    expect(l.sources[0].name).toBe("Dictation"); // no vendorName -> category label
  });

  it("coral ribbons land in source order (targets strictly increasing)", () => {
    const l = computeConsolidationLayout([
      item({ id: "a", annualSpend: 1_800_000, coveragePct: 80 }),
      item({ id: "b", annualSpend: 1_000_000, coveragePct: 90 }),
      item({ id: "c", annualSpend: 600_000, coveragePct: 75 }),
    ]);
    const ys = coral(l).map((r) => r.y2);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/__tests__/consolidationLayout.test.ts`
Expected: FAIL — cannot resolve `@/lib/consolidationLayout`.

- [ ] **Step 3: Write the implementation**

```ts
// client/src/lib/consolidationLayout.ts
// Pure geometry for the two-sink consolidation hero. No rendering here.
// Ribbons are constant-thickness strokes proportional to dollars (thickness =
// value * k); each sink's height is the sum of the ribbons landing in it, so
// sinks fill exactly. Row spacing is fixed so labels stay legible regardless of
// a tool's spend. k is capped so a source's combined ribbon never exceeds the
// row spacing (no overlap at the source edge).
import {
  itemRetired, itemStays, computeTotals, itemDisplayName, categoryLabel,
  type AppRatItem,
} from "./appRationalizationCalc";

export interface LayoutSource {
  id: string;
  name: string;
  category: string;
  spend: number;
  coveragePct: number;
  retired: number;
  stays: number;
  rowCenterY: number;
  coralSrcY: number;
  greySrcY: number;
}

export interface LayoutRibbon {
  id: string;
  kind: "retired" | "stays";
  y1: number;
  y2: number;
  thickness: number;
}

export interface LayoutNode { y: number; height: number }

export interface ConsolidationLayout {
  width: number;
  height: number;
  ribbonStartX: number;
  sinkX: number;
  sinkWidth: number;
  sources: LayoutSource[];
  ribbons: LayoutRibbon[];
  abridge: LayoutNode;
  stays: LayoutNode;
  totals: { stackTotal: number; toAbridge: number; stays: number };
}

export interface LayoutOpts {
  width?: number;
  ribbonStartX?: number;
  sinkX?: number;
  sinkWidth?: number;
  topPad?: number;
  bottomPad?: number;
  rowGap?: number;
  sinkGap?: number;
  maxRibbonFrac?: number;
}

export function computeConsolidationLayout(items: AppRatItem[], opts: LayoutOpts = {}): ConsolidationLayout {
  const width = opts.width ?? 1000;
  const ribbonStartX = opts.ribbonStartX ?? 300;
  const sinkX = opts.sinkX ?? 900;
  const sinkWidth = opts.sinkWidth ?? 66;
  const topPad = opts.topPad ?? 16;
  const bottomPad = opts.bottomPad ?? 16;
  const rowGap = opts.rowGap ?? 64;
  const sinkGap = opts.sinkGap ?? 44;
  const maxRibbonFrac = opts.maxRibbonFrac ?? 0.7;

  const rows = items.filter((i) => (i.annualSpend || 0) > 0);
  const t = computeTotals(rows);
  const totals = { stackTotal: t.stackTotal, toAbridge: t.toAbridge, stays: t.stays };

  if (rows.length === 0) {
    return {
      width, height: topPad + bottomPad, ribbonStartX, sinkX, sinkWidth,
      sources: [], ribbons: [],
      abridge: { y: topPad, height: 0 }, stays: { y: topPad, height: 0 }, totals,
    };
  }

  const maxSpend = Math.max(...rows.map((r) => r.annualSpend));
  const k = maxSpend > 0 ? (rowGap * maxRibbonFrac) / maxSpend : 0;

  const sourceColHeight = rows.length * rowGap;
  const Hab = t.toAbridge * k;
  const Hst = t.stays * k;
  const bothSinks = Hab > 0 && Hst > 0;
  const rightGroupHeight = Hab + (bothSinks ? sinkGap : 0) + Hst;
  const rightTop = topPad + Math.max(0, (sourceColHeight - rightGroupHeight) / 2);

  const abridge: LayoutNode = { y: rightTop, height: Hab };
  const stays: LayoutNode = { y: rightTop + Hab + (bothSinks ? sinkGap : 0), height: Hst };

  const sources: LayoutSource[] = [];
  const ribbons: LayoutRibbon[] = [];
  let abrCursor = abridge.y;
  let stayCursor = stays.y;

  rows.forEach((r, i) => {
    const retired = itemRetired(r);
    const stays_ = itemStays(r);
    const spend = r.annualSpend;
    const coralTh = retired * k;
    const greyTh = stays_ * k;
    const combined = spend * k;
    const rowCenterY = topPad + rowGap / 2 + i * rowGap;
    const stackTop = rowCenterY - combined / 2;
    const coralSrcY = stackTop + coralTh / 2;
    const greySrcY = stackTop + coralTh + greyTh / 2;

    sources.push({
      id: r.id,
      name: itemDisplayName(r),
      category: categoryLabel(r.category),
      spend,
      coveragePct: r.coveragePct,
      retired,
      stays: stays_,
      rowCenterY,
      coralSrcY,
      greySrcY,
    });

    if (retired > 0) {
      const ty = abrCursor + coralTh / 2;
      abrCursor += coralTh;
      ribbons.push({ id: r.id, kind: "retired", y1: coralSrcY, y2: ty, thickness: coralTh });
    }
    if (stays_ > 0) {
      const ty = stayCursor + greyTh / 2;
      stayCursor += greyTh;
      ribbons.push({ id: r.id, kind: "stays", y1: greySrcY, y2: ty, thickness: greyTh });
    }
  });

  const height = topPad + Math.max(sourceColHeight, rightGroupHeight) + bottomPad;
  return { width, height, ribbonStartX, sinkX, sinkWidth, sources, ribbons, abridge, stays, totals };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/__tests__/consolidationLayout.test.ts`
Expected: PASS (7 cases).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/consolidationLayout.ts client/src/__tests__/consolidationLayout.test.ts
git commit -m "App Rationalization: consolidation sankey layout math + tests"
```

---

### Task 2: ConsolidationFlow SVG component

**Files:**
- Create: `client/src/components/forecast/ConsolidationFlow.tsx`

**Interfaces:**
- Consumes: `computeConsolidationLayout` from `@/lib/consolidationLayout`; `type AppRatItem` from `@/lib/appRationalizationCalc`.
- Produces: `ConsolidationFlow` default export, props `{ items: AppRatItem[] }`.

- [ ] **Step 1: Write the component**

Each source gets one `<g class="fg">` holding its ribbons (drawn first) and its labels, so hovering a source isolates its whole flow. The sink rectangles are drawn last, on top of the ribbon ends. No unit test (SVG rendering; the geometry is tested in Task 1). Verify via tsc + build.

```tsx
// client/src/components/forecast/ConsolidationFlow.tsx
import { useMemo } from "react";
import { computeConsolidationLayout } from "@/lib/consolidationLayout";
import type { AppRatItem } from "@/lib/appRationalizationCalc";

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function ribbonPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export default function ConsolidationFlow({ items }: { items: AppRatItem[] }) {
  const layout = useMemo(() => computeConsolidationLayout(items), [items]);
  const { width, height, ribbonStartX, sinkX, sinkWidth, sources, ribbons, abridge, stays, totals } = layout;

  if (sources.length === 0) {
    return (
      <div
        className="rounded-[22px] p-10 text-center text-white/60 text-sm"
        style={{ background: "linear-gradient(155deg,#211D18,#141210)" }}
      >
        Add applications with annual spend to see the consolidation.
      </div>
    );
  }

  return (
    <div className="rounded-[22px] p-6 md:p-8" style={{ background: "linear-gradient(155deg,#211D18,#141210)" }}>
      <div className="flex justify-between px-1 pb-4 text-[11px] font-bold uppercase tracking-[2px] text-white/40">
        <span>Your tools · what Abridge takes</span>
        <span>Two ways it lands</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: "Manrope, sans-serif" }} data-testid="consolidation-svg">
        {sources.map((s) => {
          const mine = ribbons.filter((r) => r.id === s.id);
          return (
            <g key={s.id} className="fg">
              {mine.map((r) => (
                <path
                  key={r.kind}
                  d={ribbonPath(ribbonStartX, r.y1, sinkX, r.y2)}
                  fill="none"
                  stroke={r.kind === "retired" ? "#EA2C00" : "#6B6258"}
                  strokeOpacity={r.kind === "retired" ? 0.6 : 0.4}
                  strokeWidth={Math.max(1.5, r.thickness)}
                  strokeLinecap="butt"
                />
              ))}
              <text x={40} y={s.rowCenterY - 4} fill="#ffffff" fontSize={15} fontWeight={700}>{s.name}</text>
              <text x={40} y={s.rowCenterY + 13} fill="#8C8377" fontSize={11}>{s.category} · {fmtM(s.spend)}</text>
              <text x={ribbonStartX - 20} y={s.rowCenterY + 2} textAnchor="end" fill="#EA2C00" fontSize={20} fontWeight={800}>{s.coveragePct}%</text>
            </g>
          );
        })}

        <rect x={sinkX} y={abridge.y} width={sinkWidth} height={abridge.height} rx={12} fill="#EA2C00" />
        <text x={sinkX + sinkWidth / 2} y={abridge.y + abridge.height / 2 - 2} textAnchor="middle" fill="#ffffff" fontSize={15} fontWeight={800}>Abridge</text>
        <text x={sinkX + sinkWidth / 2} y={abridge.y + abridge.height / 2 + 16} textAnchor="middle" fill="#ffffff" fontSize={11.5} fontWeight={700} opacity={0.95}>{fmtM(totals.toAbridge)}</text>

        {stays.height > 0 && (
          <>
            <rect x={sinkX} y={stays.y} width={sinkWidth} height={stays.height} rx={8} fill="#2A2621" stroke="#3A342D" />
            <text x={sinkX + sinkWidth + 8} y={stays.y + stays.height / 2 + 4} fill="#8C8377" fontSize={11} fontWeight={600}>Stays {fmtM(totals.stays)}</text>
          </>
        )}
      </svg>
      <style>{`svg:hover .fg { opacity: .25; transition: opacity .18s } svg .fg:hover { opacity: 1 }`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` → 0 errors.
Run: `npx vitest run` → all green.
Run: `npm run build` → succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/forecast/ConsolidationFlow.tsx
git commit -m "App Rationalization: ConsolidationFlow two-sink SVG"
```

---

### Task 3: Wire the consolidation step in the flow shell

**Files:**
- Modify: `client/src/pages/forecast/AppRationalizationFlow.tsx`

**Interfaces:**
- Consumes: `ConsolidationFlow` (Task 2); `computeTotals` from `@/lib/appRationalizationCalc`; `AnimatedValue` from `@/components/explore/AnimatedValue`.
- Produces: nothing new (final wiring of the existing `step === "consolidation"` branch).

- [ ] **Step 1: Add imports**

At the top of `AppRationalizationFlow.tsx`, add (alongside the existing imports):

```tsx
import ConsolidationFlow from "@/components/forecast/ConsolidationFlow";
import { AnimatedValue } from "@/components/explore/AnimatedValue";
import { computeTotals } from "@/lib/appRationalizationCalc";
```

The file already imports `type AppRatItem`, `type AppRatCategoryId`, `makeItem` from the calc module; add `computeTotals` to that existing import line rather than duplicating the import if the linter prefers — either is acceptable since tsc has no no-duplicate-import rule here, but prefer merging it into the existing `@/lib/appRationalizationCalc` import.

- [ ] **Step 2: Add a local money formatter**

Just above the `return (` in the `AppRationalizationFlow` component body, add:

```tsx
  const fmtM = (n: number): string => {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${Math.round(n)}`;
  };
```

- [ ] **Step 3: Replace the consolidation placeholder block**

Find the existing block (added in Phase 1):

```tsx
        {step === "consolidation" && (
          <div data-testid="ar-step-consolidation" className="max-w-3xl mx-auto px-6 py-24 text-center">
            <h2 className="font-abridge text-3xl uppercase tracking-tight text-[#1A1A1A]">The consolidation</h2>
            <p className="text-sm text-[#6B6B6B] mt-3">Coming next: the two-sink flow that shows what Abridge takes on and what stays.</p>
            <button
              onClick={() => setStep("applications")}
              className="mt-6 text-sm font-semibold text-[#EA2C00]"
              data-testid="ar-back-to-applications"
            >
              ← Back to applications
            </button>
          </div>
        )}
```

Replace it entirely with:

```tsx
        {step === "consolidation" && (() => {
          const totals = computeTotals(items);
          return (
            <div data-testid="ar-step-consolidation" className="max-w-[1120px] mx-auto px-6 py-8">
              <h1 className="font-abridge text-4xl uppercase tracking-tight text-[#1A1A1A] text-center">Consolidation</h1>
              <p className="text-[15px] text-[#1A1A1A] text-center mt-3 mb-8">
                <AnimatedValue value={totals.toAbridge} format={fmtM} className="font-bold text-[#EA2C00] tabular-nums" /> to Abridge
                {" · "}
                <AnimatedValue value={totals.stays} format={fmtM} className="font-bold tabular-nums" /> stays
                {" · from a "}
                <AnimatedValue value={totals.stackTotal} format={fmtM} className="font-bold tabular-nums" /> stack
              </p>
              <ConsolidationFlow items={items} />
              <div className="mt-8 text-center">
                <button
                  onClick={() => setStep("applications")}
                  className="text-sm font-semibold text-[#EA2C00]"
                  data-testid="ar-back-to-applications"
                >
                  ← Back to applications
                </button>
              </div>
            </div>
          );
        })()}
```

Forward navigation to the roadmap (Phase 3) is intentionally omitted: this step is the current terminal of the flow, with only a back control. That is cleaner than a disabled "next" that goes nowhere.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` → 0 errors.
Run: `npx vitest run` → all green.
Run: `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/forecast/AppRationalizationFlow.tsx
git commit -m "App Rationalization: real consolidation step (headline + two-sink hero)"
```

- [ ] **Step 6: Manual verification note**

This environment cannot render SVG. The user verifies on Replit: Forecast → App Rationalization → add a few tools with spend and varied coverage → "See the consolidation" now shows the two-sink flow (coral to Abridge, grey to what stays), the coverage % loud on the left per tool, the honest headline counting up, hover isolates one flow, and a 100%-coverage tool has no grey strand. Confirm palette (coral + warm neutrals, no green/amber), Abridge display title, and that it reads clean at 2, 5, and 8 tools.

---

## Self-Review

**Spec coverage:** Pure two-sink layout with proportional thicknesses, sinks filled, per-color skip on zero, min row spacing, empty/single safety → Task 1 (with tests). Bespoke SVG (coral→Abridge, grey→stays, loud left %, hover-isolate, dark panel, no ribbon text) → Task 2. Real consolidation step (font-abridge title, honest headline via AnimatedValue, ConsolidationFlow, back control, forward deferred) → Task 3. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Every code step shows complete code. The empty-state branch in Task 2 is real rendered copy, not a placeholder.

**Type consistency:** `computeConsolidationLayout(items, opts?)` returns `ConsolidationLayout` with `sources`/`ribbons`/`abridge`/`stays`/`totals` used identically in Task 2. `LayoutRibbon.kind` is `"retired" | "stays"` in both the layout and the component's stroke selection. `ConsolidationFlow` props `{ items: AppRatItem[] }` match the shell's `items` state and the Task-3 usage. `AnimatedValue` uses `value`/`format`/`className` as in its real signature. `computeTotals`/`itemRetired`/`itemStays`/`itemDisplayName`/`categoryLabel` are the real Phase-1 exports.

**Constraint check:** coral + warm neutrals only (no green/amber/orange; grey is `#6B6258`/`#2A2621`); no status pills; no em dashes/jargon in copy ("what Abridge takes", "Stays", "to Abridge"); `.font-abridge` on the title; AnimatedValue count-ups; tabular-nums; only the one placeholder block in `AppRationalizationFlow.tsx` changes; no Compare Pricing changes.
