# App Rationalization — Consolidation Hero (future-stack magnitude bars) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Consolidation step so it reads as "your future tech stack on Abridge" — a dollars-free movement chart on top, then a magnitude-driven before/after bar section (money stacked with the bars), then the Coming soon rationale — at a premium, non-slop bar.

**Architecture:** A pure `buildStackBars` helper derives the per-tool spend/sunset/stays; a new `ConsolidationBars` component renders the editorial money header plus two same-scale horizontal bars (Today fragmented, On Abridge = flat coral + per-tool residual slivers color-matched to the Today bar), with hover tooltips and reduced-motion-gated wipe-in. The snaky chart is stripped of dollar text (movement only), the flow reorders to sankey → bars → coming soon, and the old vertical-bar ledger is removed. Tasks are ordered additive-first so the typecheck stays green throughout.

**Tech Stack:** React + TypeScript (strict), Vite, Tailwind, `AnimatedValue`, vitest.

## Global Constraints

- No em dashes anywhere in copy or comments; use "·", ":", or a period. A subtracted amount uses the minus sign "−".
- User-facing copy uses **"sunset" / "Sunsets onto Abridge"**, never "coverage". Internal fields stay `coveragePct` / `toAbridge`.
- Coral `#EA2C00` for Abridge/savings, **flat — no gradient, no glow**. Taupe ramp `#5A5148 #7A6E60 #8E8172 #A2937F #B6A78F #C6B9A2` for tools/stays. Neutral ink `#1A1A1A` for a net cost. Warm neutrals only; no stoplight colors, no status pills.
- `.font-abridge` on the "The Consolidation" heading only; Manrope everywhere else; `AnimatedValue` count-ups; `tabular-nums` on every figure.
- Premium craft is a first-class requirement (spec §6): ~48px rounded bars, crisp 2px white dividers, subtle 1px inset, a real hover tooltip (not native `title`) echoing the sankey's hover-isolate, smooth physical motion, generous whitespace.
- Motion gated behind `@media (prefers-reduced-motion: no-preference)` with the settled state as the reduced-motion default.
- The two bars are the same scale (both represent `stackTotal`).
- Snaky chart shows no dollars; ribbons, coverage %, and names stay.
- Verify each task with `npx tsc --noEmit -p tsconfig.json` (0 errors) and `npx vitest run` (all green). Run `npm run build` for UI tasks. This environment cannot render the app; math is unit-tested, the feel is verified on Replit.

---

### Task 1: `buildStackBars` in the calc module

**Files:**
- Modify: `client/src/lib/appRationalizationCalc.ts`
- Test: `client/src/__tests__/appRationalizationStackBars.test.ts` (create)

**Interfaces:**
- Consumes: `itemDisplayName`, `itemRetired`, `itemStays`, `AppRatItem` (existing).
- Produces:
  - `interface StackBarTool { id: string; name: string; spend: number; sunset: number; stays: number; }`
  - `interface StackBars { stackTotal: number; sunset: number; stays: number; tools: StackBarTool[]; }`
  - `buildStackBars(items: AppRatItem[]): StackBars`

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/appRationalizationStackBars.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildStackBars, type AppRatItem } from "@/lib/appRationalizationCalc";

const mk = (o: Partial<AppRatItem>): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 0, coveragePct: 80, when: "thisYear", ...o,
});

describe("buildStackBars", () => {
  it("derives per-tool spend/sunset/stays and totals, spend-only, in order", () => {
    const bars = buildStackBars([
      mk({ id: "a", vendorName: "DAX", annualSpend: 180_000, coveragePct: 100 }),
      mk({ id: "b", vendorName: "Scribe", annualSpend: 120_000, coveragePct: 90 }),
      mk({ id: "c", vendorName: "Iodine", annualSpend: 70_000, coveragePct: 60 }),
    ]);
    expect(bars.stackTotal).toBe(370_000);
    expect(bars.sunset).toBe(180_000 + 108_000 + 42_000); // 330,000
    expect(bars.stays).toBe(0 + 12_000 + 28_000);          // 40,000
    expect(bars.tools.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(bars.tools[0]).toEqual({ id: "a", name: "DAX", spend: 180_000, sunset: 180_000, stays: 0 });
    expect(bars.tools[1]).toMatchObject({ name: "Scribe", sunset: 108_000, stays: 12_000 });
  });
  it("drops zero-spend tools", () => {
    const bars = buildStackBars([mk({ id: "z", annualSpend: 0 }), mk({ id: "y", annualSpend: 50_000, coveragePct: 80 })]);
    expect(bars.tools.map((t) => t.id)).toEqual(["y"]);
    expect(bars.stackTotal).toBe(50_000);
  });
  it("is zero-safe on an empty stack", () => {
    expect(buildStackBars([])).toEqual({ stackTotal: 0, sunset: 0, stays: 0, tools: [] });
  });
  it("falls back to the category label when a tool has no vendor name", () => {
    const bars = buildStackBars([mk({ id: "s", category: "scribe", vendorName: undefined, annualSpend: 10_000 })]);
    expect(bars.tools[0].name).toBe("Medical scribe");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/appRationalizationStackBars.test.ts`
Expected: FAIL — `buildStackBars` is not exported.

- [ ] **Step 3: Implement `buildStackBars`**

In `client/src/lib/appRationalizationCalc.ts`, immediately after the `computeNet` function (it ends with the returned object and its closing `}`), add:

```ts
export interface StackBarTool {
  id: string;
  name: string;
  spend: number;
  sunset: number; // itemRetired
  stays: number;  // itemStays
}

export interface StackBars {
  stackTotal: number;
  sunset: number;
  stays: number;
  tools: StackBarTool[]; // spend-only tools, in the given order
}

/** Per-tool spend/sunset/stays for the consolidation magnitude bars. */
export function buildStackBars(items: AppRatItem[]): StackBars {
  const tools: StackBarTool[] = items
    .filter((i) => (i.annualSpend || 0) > 0)
    .map((i) => ({
      id: i.id,
      name: itemDisplayName(i),
      spend: i.annualSpend,
      sunset: itemRetired(i),
      stays: itemStays(i),
    }));
  return {
    stackTotal: tools.reduce((s, t) => s + t.spend, 0),
    sunset: tools.reduce((s, t) => s + t.sunset, 0),
    stays: tools.reduce((s, t) => s + t.stays, 0),
    tools,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/appRationalizationStackBars.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/lib/appRationalizationCalc.ts client/src/__tests__/appRationalizationStackBars.test.ts
git commit -m "feat: buildStackBars for consolidation magnitude bars"
```

---

### Task 2: Strip dollars from the snaky chart (movement only)

**Files:**
- Modify: `client/src/components/forecast/ConsolidationFlow.tsx`

**Interfaces:**
- No exported-signature change. The component keeps `{ items }`.

- [ ] **Step 1: Remove the `fmtM` helper**

In `client/src/components/forecast/ConsolidationFlow.tsx`, delete the entire `fmtM` function (the block starting `function fmtM(n: number): string {` through its closing `}`). It becomes unused once the dollar text is gone.

- [ ] **Step 2: Drop `totals` from the layout destructure**

Change:

```tsx
  const { width, height, ribbonStartX, sinkX, sinkWidth, sources, ribbons, abridge, stays, totals } = layout;
```

to (remove `totals`, which is only used by the dollar text):

```tsx
  const { width, height, ribbonStartX, sinkX, sinkWidth, sources, ribbons, abridge, stays } = layout;
```

- [ ] **Step 3: Remove the per-tool spend from the source subline**

Change:

```tsx
              <text x={40} y={s.rowCenterY + 13} fill="#8C8377" fontSize={11} style={{ fontVariantNumeric: "tabular-nums" }}>{s.category} · {fmtM(s.spend)}</text>
```

to:

```tsx
              <text x={40} y={s.rowCenterY + 13} fill="#8C8377" fontSize={11}>{s.category}</text>
```

- [ ] **Step 4: Remove the Abridge sink dollar amount (keep the label, recentre it)**

Change:

```tsx
        <rect x={sinkX} y={abridge.y} width={sinkWidth} height={abridge.height} rx={12} fill="#EA2C00" />
        <text x={sinkX + sinkWidth / 2} y={abridge.y + abridge.height / 2 - 2} textAnchor="middle" fill="#ffffff" fontSize={15} fontWeight={800}>Abridge</text>
        <text x={sinkX + sinkWidth / 2} y={abridge.y + abridge.height / 2 + 16} textAnchor="middle" fill="#ffffff" fontSize={11.5} fontWeight={700} opacity={0.95} style={{ fontVariantNumeric: "tabular-nums" }}>{fmtM(totals.toAbridge)}</text>
```

to (drop the second `<text>`, vertically centre "Abridge"):

```tsx
        <rect x={sinkX} y={abridge.y} width={sinkWidth} height={abridge.height} rx={12} fill="#EA2C00" />
        <text x={sinkX + sinkWidth / 2} y={abridge.y + abridge.height / 2 + 5} textAnchor="middle" fill="#ffffff" fontSize={15} fontWeight={800}>Abridge</text>
```

- [ ] **Step 5: Remove the Stays dollar amount (keep the label)**

Change:

```tsx
            <text x={sinkX + sinkWidth} y={stays.y - 8} textAnchor="end" fill="#8C8377" fontSize={11} fontWeight={600} style={{ fontVariantNumeric: "tabular-nums" }}>Stays {fmtM(totals.stays)}</text>
```

to:

```tsx
            <text x={sinkX + sinkWidth} y={stays.y - 8} textAnchor="end" fill="#8C8377" fontSize={11} fontWeight={600}>Stays</text>
```

- [ ] **Step 6: Typecheck + build**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: tsc 0 errors (no unused `fmtM`/`totals`); build succeeds.

- [ ] **Step 7: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/components/forecast/ConsolidationFlow.tsx
git commit -m "feat: snaky chart shows movement only, no dollar figures"
```

---

### Task 3: `ConsolidationBars` component (money header + magnitude bars)

**Files:**
- Create: `client/src/components/forecast/ConsolidationBars.tsx`

**Interfaces:**
- Consumes: `buildStackBars`, `computeNet`, `AppRatItem` (Task 1 + existing); `AnimatedValue`.
- Produces: `export default function ConsolidationBars({ items, abridgePrice }: { items: AppRatItem[]; abridgePrice: number })`.

- [ ] **Step 1: Create the component**

Create `client/src/components/forecast/ConsolidationBars.tsx`:

```tsx
import { useMemo, useState } from "react";
import { AnimatedValue } from "@/components/explore/AnimatedValue";
import { buildStackBars, computeNet, type AppRatItem } from "@/lib/appRationalizationCalc";

const TAUPE = ["#5A5148", "#7A6E60", "#8E8172", "#A2937F", "#B6A78F", "#C6B9A2"];

function fmtM(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(a / 1_000)}K`;
  return `$${Math.round(a)}`;
}

interface Seg { key: string; label: string; value: string; widthPct: number; centerPct: number; color: string; }

function Bar({ segments, animClass, height = 48 }: { segments: Seg[]; animClass: string; height?: number }) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const hovered = segments.find((s) => s.key === hoverKey) ?? null;
  return (
    <div className="relative">
      {hovered && (
        <div
          className="absolute z-10 pointer-events-none -translate-x-1/2"
          style={{ left: `${hovered.centerPct}%`, bottom: `${height + 10}px` }}
        >
          <div className="bg-[#1A1A1A] text-white rounded-lg px-3 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)] whitespace-nowrap">
            <div className="text-[11px] font-semibold leading-tight">{hovered.label}</div>
            <div className="text-[11px] text-white/70 tabular-nums leading-tight">{hovered.value}</div>
          </div>
        </div>
      )}
      <div
        className={`flex rounded-xl overflow-hidden ${animClass}`}
        style={{ height, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.05)" }}
      >
        {segments.map((s, i) => (
          <div
            key={s.key}
            className="h-full transition-[filter] duration-150"
            style={{
              width: `${s.widthPct}%`,
              background: s.color,
              borderLeft: i > 0 ? "2px solid #fff" : undefined,
              filter: hoverKey && hoverKey !== s.key ? "brightness(0.88)" : hoverKey === s.key ? "brightness(1.06)" : undefined,
            }}
            onMouseEnter={() => setHoverKey(s.key)}
            onMouseLeave={() => setHoverKey(null)}
          />
        ))}
      </div>
    </div>
  );
}

export default function ConsolidationBars({ items, abridgePrice }: { items: AppRatItem[]; abridgePrice: number }) {
  const bars = useMemo(() => buildStackBars(items), [items]);
  const net = useMemo(() => computeNet(items, abridgePrice), [items, abridgePrice]);

  const { todaySegs, abridgeSegs } = useMemo(() => {
    const total = Math.max(1, bars.stackTotal);
    const shade = (i: number) => TAUPE[i % TAUPE.length];

    let a = 0;
    const todaySegs: Seg[] = bars.tools.map((t, i) => {
      const widthPct = (t.spend / total) * 100;
      const seg: Seg = { key: t.id, label: t.name, value: `${fmtM(t.spend)} / yr`, widthPct, centerPct: a + widthPct / 2, color: shade(i) };
      a += widthPct;
      return seg;
    });

    let b = 0;
    const abridgeSegs: Seg[] = [];
    if (bars.sunset > 0) {
      const coralW = (bars.sunset / total) * 100;
      abridgeSegs.push({ key: "abridge", label: "Sunsets onto Abridge", value: fmtM(bars.sunset), widthPct: coralW, centerPct: b + coralW / 2, color: "#EA2C00" });
      b += coralW;
    }
    bars.tools.forEach((t, i) => {
      if (t.stays <= 0) return;
      const w = (t.stays / total) * 100;
      abridgeSegs.push({ key: `${t.id}-stays`, label: `${t.name} stays`, value: fmtM(t.stays), widthPct: w, centerPct: b + w / 2, color: shade(i) });
      b += w;
    });

    return { todaySegs, abridgeSegs };
  }, [bars]);

  if (bars.stackTotal === 0) {
    return (
      <div className="rounded-[18px] border border-[#E8E2DA] bg-white p-10 text-center text-sm text-[#8C7E6E]" data-testid="ar-consolidation-bars-empty">
        Add applications with annual spend to see the consolidation.
      </div>
    );
  }

  const futureSpend = net.abridgePrice + net.stays;

  return (
    <div className="rounded-[18px] border border-[#E8E2DA] bg-white p-6 md:p-7" data-testid="ar-consolidation-bars">
      {/* Header: The Consolidation + net savings hero */}
      <div className="flex items-start justify-between gap-6 mb-7">
        <div className="font-abridge uppercase tracking-[0.03em] text-[18px] text-[#1A1A1A] pt-1">The Consolidation</div>
        <div className="text-right leading-none">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C7E6E] mb-1.5">
            {net.isNetCost ? "Net cost / yr" : "Net savings / yr"}
          </div>
          <AnimatedValue
            value={Math.abs(net.netSavings)}
            format={fmtM}
            className={`text-[34px] font-extrabold tabular-nums ${net.isNetCost ? "text-[#1A1A1A]" : "text-[#EA2C00]"}`}
            style={{ letterSpacing: "-0.01em" }}
            data-testid="ar-bars-net"
          />
          <div className="text-[12px] text-[#8C7E6E] tabular-nums mt-1.5">
            {fmtM(bars.stackTotal)} today → {fmtM(futureSpend)} on Abridge
          </div>
        </div>
      </div>

      {/* Today bar */}
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[12px] font-bold text-[#1A1A1A]">Today · fragmented</span>
        <span className="text-[12px] text-[#8C7E6E] tabular-nums">{fmtM(bars.stackTotal)} / yr</span>
      </div>
      <Bar segments={todaySegs} animClass="cb-wipe cb-wipe-1" />
      <div className="mt-2 text-[11px] text-[#8C7E6E]">Each tool, sized by spend</div>

      {/* On Abridge bar */}
      <div className="flex justify-between items-baseline mb-2 mt-6">
        <span className="text-[12px] font-bold text-[#1A1A1A]">On Abridge</span>
        <span className="text-[12px] text-[#8C7E6E] tabular-nums">{fmtM(bars.stackTotal)} / yr</span>
      </div>
      <Bar segments={abridgeSegs} animClass="cb-wipe cb-wipe-2" />
      <div className="mt-2 flex justify-between text-[11px]">
        <span className="text-[#8C7E6E]"><b className="text-[#EA2C00]">{fmtM(bars.sunset)}</b> sunsets onto Abridge</span>
        <span className="text-[#8C7E6E] tabular-nums">{fmtM(bars.stays)} stays</span>
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference){
          .cb-wipe { clip-path: inset(0 100% 0 0); animation: cbWipe .7s cubic-bezier(.4,.7,.3,1) forwards; }
          .cb-wipe-2 { animation-delay: .38s; }
        }
        @keyframes cbWipe { to { clip-path: inset(0 0 0 0); } }
      `}</style>
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
git add client/src/components/forecast/ConsolidationBars.tsx
git commit -m "feat: ConsolidationBars future-stack magnitude bars with hover and wipe-in"
```

---

### Task 4: Rewire the consolidation step + remove the old ledger

**Files:**
- Modify: `client/src/pages/forecast/AppRationalizationFlow.tsx`
- Delete: `client/src/components/forecast/ConsolidationLedger.tsx`

**Interfaces:**
- Consumes: `ConsolidationBars` (Task 3), `ConsolidationFlow` (Task 2, existing import).

- [ ] **Step 1: Swap the import**

In `client/src/pages/forecast/AppRationalizationFlow.tsx`, change the ledger import:

```tsx
import ConsolidationLedger from "@/components/forecast/ConsolidationLedger";
```

to:

```tsx
import ConsolidationBars from "@/components/forecast/ConsolidationBars";
```

- [ ] **Step 2: Reorder the consolidation step (movement → bars → coming soon)**

Replace this block:

```tsx
          <div data-testid="ar-step-consolidation" className="max-w-[1120px] mx-auto px-6 py-8">
            <ConsolidationLedger items={items} abridgePrice={abridgePrice} />
            <div className="mt-6"><ConsolidationFlow items={items} /></div>
```

with (snaky chart first, then the bars):

```tsx
          <div data-testid="ar-step-consolidation" className="max-w-[1120px] mx-auto px-6 py-8">
            <ConsolidationFlow items={items} />
            <div className="mt-6"><ConsolidationBars items={items} abridgePrice={abridgePrice} /></div>
```

(The "Why Abridge can take these on" Coming soon panel and the "See the change →" button below it are unchanged.)

- [ ] **Step 3: Delete the superseded ledger**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git rm client/src/components/forecast/ConsolidationLedger.tsx
```

- [ ] **Step 4: Typecheck, test, build**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json && npx vitest run && npm run build`
Expected: tsc 0 errors (nothing imports `ConsolidationLedger` anymore); all tests green; build succeeds.

- [ ] **Step 5: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/pages/forecast/AppRationalizationFlow.tsx
git commit -m "feat: consolidation step = movement chart, then magnitude bars; drop old ledger"
```

---

## Self-Review

**1. Spec coverage:**
- §2 layout (sankey no-$ → money+bars → coming soon) → Task 2 (strip $) + Task 4 (reorder). ✓
- §3 sankey dollar removal (source $, sink $, stays $; keep names/%/ribbons) → Task 2. ✓
- §4 money header (Abridge-font heading, net hero AnimatedValue, "$X today → $Y on Abridge") + two same-scale bars (Today taupe ramp by spend; On Abridge flat coral + per-tool residual color-matched) + sub-labels + hover tooltip → Task 3. ✓
- §5 `buildStackBars` pure + tested → Task 1. ✓
- §6 craft (48px rounded bars, 2px dividers, inset, real tooltip with brighten/dim, wipe-in motion reduced-motion-gated, count-up) → Task 3. ✓
- §7 files (calc, ConsolidationFlow, new ConsolidationBars, flow rewire, remove ledger) → Tasks 1-4. ✓

**2. Placeholder scan:** No TBD/TODO; every code step is complete; commands have expected output. ✓

**3. Type consistency:** `StackBars`/`StackBarTool` field names used in `buildStackBars` (Task 1) match `ConsolidationBars` consumption (Task 3: `bars.stackTotal`, `bars.sunset`, `bars.stays`, `bars.tools[].id/name/spend/sunset/stays`). `computeNet` fields (`netSavings`, `isNetCost`, `abridgePrice`, `stays`) used in the header match the existing helper. `ConsolidationBars` props (`items`, `abridgePrice`) match the flow's usage (Task 4). `AnimatedValue` props (`value`, `format`, `className`, `style`, `data-testid`) match its interface. ✓

**4. Green-per-task:** Task 1 additive; Task 2 removes only now-dead `fmtM`/`totals`; Task 3 is an unused new component; Task 4 swaps the import and deletes the ledger in the same task (nothing else imports it). Each ends tsc 0 + tests green. ✓

**5. Copy/brand:** No em dashes (minus sign only where subtracting); "sunset" language; flat coral, taupe ramp, ink net-cost; `.font-abridge` heading only; tabular-nums; no stoplight/pills/glow. ✓
