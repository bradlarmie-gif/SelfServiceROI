# App Rationalization — Phase 3 Implementation Plan ("The change" roadmap)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "The change" step: a renewal-gated roadmap that shows the adjacent stack coming apart year by year, as a beige stacked-bar chart with a decline trend, per-year deltas, a data-aware read, and a running-total strip.

**Architecture:** Two pure, unit-tested modules — `retirementYear` (renewal string to contract year) added to the item calc, and `computeRoadmap` (snapshots + deltas + running + read) in a new module — plus a self-contained `RoadmapChart` SVG panel that renders them, wired into the flow shell as a new terminal step reached from the consolidation step.

**Tech Stack:** React + TypeScript, SVG, vitest. Reuses `appRationalizationCalc` derive math and the shared `AnimatedValue`.

## Global Constraints

- Copy: **no em dashes**; **no corporate jargon**; defensible voice ("candidates to retire", "what Abridge can take on"); never assert Abridge replaced a named competitor.
- Visual: coral `#EA2C00` + warm neutrals only; **no stoplight colors** (no green/amber/orange; the "stays"/band neutrals are warm taupes like `#5A5148`..`#B6A78F`); **no status pills**. The chart panel is a warm cream surface (`linear-gradient(180deg,#F8F3EA,#F3ECE0)`) with a soft shadow.
- Type: the Abridge display font (`.font-abridge`) for the step title; Manrope for all UI and SVG text; tabular numerals on figures.
- Motion: entrance animations must honor `prefers-reduced-motion` (final state visible without motion when reduced).
- Reuse: `appRationalizationCalc` (`itemRetired`, `itemStays`, `itemDisplayName`, `computeTotals`, `type AppRatItem`) and `AnimatedValue` from `@/components/explore/AnimatedValue`. Do NOT re-implement money math in the UI.
- Only `AppRationalizationFlow.tsx` changes among prior-phase files. Do NOT change the ArStackCard Renews options, Compare Pricing, or `pricingComparisonCalc.ts`.
- Verify each task: `npx tsc --noEmit -p tsconfig.json` (0 errors) and `npx vitest run` (all green); UI tasks also `npm run build`. This environment cannot render SVG; roadmap math is unit-tested, visuals verified by the user on Replit.

---

### Task 1: `retirementYear` (renewal to contract year) + tests

**Files:**
- Modify: `client/src/lib/appRationalizationCalc.ts` (append the function)
- Test: `client/src/__tests__/appRationalizationRetirementYear.test.ts`

**Interfaces:**
- Consumes: `type AppRatItem` (already in the file).
- Produces: `function retirementYear(item: AppRatItem, termYears: number, currentYear?: number): number` (returns an integer 1..termYears).

- [ ] **Step 1: Write the failing test**

```ts
// client/src/__tests__/appRationalizationRetirementYear.test.ts
import { describe, it, expect } from "vitest";
import { retirementYear, type AppRatItem } from "@/lib/appRationalizationCalc";

const item = (renewal?: string): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 1_000_000, coveragePct: 80, transitionMonths: 12, renewal,
});

describe("retirementYear (currentYear injected = 2026, termYears = 3)", () => {
  const ry = (renewal?: string, term = 3) => retirementYear(item(renewal), term, 2026);
  it("Open term retires now (year 1)", () => expect(ry("Open term")).toBe(1));
  it("current year retires in year 1", () => expect(ry("2026")).toBe(1));
  it("a mid-year-2027 string retires in year 2", () => expect(ry("Mid 2027")).toBe(2));
  it("2028 retires in year 3", () => expect(ry("2028")).toBe(3));
  it("a year beyond the term clamps to the last year", () => expect(ry("2030")).toBe(3));
  it("a year before now clamps to year 1", () => expect(ry("2024")).toBe(1));
  it("Unknown holds to the last year", () => expect(ry("Unknown")).toBe(3));
  it("empty renewal holds to the last year", () => expect(ry(undefined)).toBe(3));
  it("respects a different term length", () => expect(ry("2030", 5)).toBe(5)); // 2030-2026+1 = 5
  it("term is floored at 1", () => expect(retirementYear(item("2028"), 0, 2026)).toBe(1));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/__tests__/appRationalizationRetirementYear.test.ts`
Expected: FAIL — `retirementYear` is not exported.

- [ ] **Step 3: Append the implementation**

Add to the end of `client/src/lib/appRationalizationCalc.ts`:

```ts
/**
 * The contract year (1..termYears) in which a tool becomes a candidate to
 * retire, derived from its renewal descriptor. "Open term" retires now;
 * a 4-digit year maps relative to the current year; empty/"Unknown" holds to
 * the last year (conservative). currentYear is injectable for deterministic tests.
 */
export function retirementYear(item: AppRatItem, termYears: number, currentYear: number = new Date().getFullYear()): number {
  const term = Math.max(1, Math.floor(termYears));
  const clamp = (n: number) => Math.min(term, Math.max(1, n));
  const r = (item.renewal ?? "").trim();
  if (!r || /unknown/i.test(r)) return term;
  if (/open term/i.test(r)) return 1;
  const m = r.match(/\b(\d{4})\b/);
  if (m) return clamp(parseInt(m[1], 10) - currentYear + 1);
  return term;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/__tests__/appRationalizationRetirementYear.test.ts`
Expected: PASS (10 cases).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/appRationalizationCalc.ts client/src/__tests__/appRationalizationRetirementYear.test.ts
git commit -m "App Rationalization: renewal to retirement-year mapping + tests"
```

---

### Task 2: `computeRoadmap` pure model + tests

**Files:**
- Create: `client/src/lib/appRationalizationRoadmap.ts`
- Test: `client/src/__tests__/appRationalizationRoadmap.test.ts`

**Interfaces:**
- Consumes: `itemRetired`, `itemStays`, `itemDisplayName`, `computeTotals`, `retirementYear`, `type AppRatItem` from `@/lib/appRationalizationCalc`.
- Produces:
  - `interface RoadmapSnapshot { label: string; year: number; total: number; perTool: { id: string; name: string; remaining: number }[] }`
  - `interface RoadmapDelta { year: number; amount: number; running: number; tools: string[] }`
  - `interface Roadmap { termYears: number; snapshots: RoadmapSnapshot[]; deltas: RoadmapDelta[]; totalRetired: number; endStays: number; read: string }`
  - `function computeRoadmap(items: AppRatItem[], termYears: number, currentYear?: number): Roadmap`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/__tests__/appRationalizationRoadmap.test.ts
import { describe, it, expect } from "vitest";
import { computeRoadmap } from "@/lib/appRationalizationRoadmap";
import { type AppRatItem } from "@/lib/appRationalizationCalc";

const mk = (o: Partial<AppRatItem>): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 0, coveragePct: 80, transitionMonths: 12, ...o,
});

// Renewals mapped with currentYear=2026, term=3:
// UpToDate "Open term"->Y1, Ambient "2026"->Y1, Fluency "Mid 2027"->Y2, Iodine "2028"->Y3, Stanson "2028"->Y3
const stack: AppRatItem[] = [
  mk({ id: "flu", vendorName: "Fluency", annualSpend: 1_800_000, coveragePct: 80, renewal: "Mid 2027" }),
  mk({ id: "utd", vendorName: "UpToDate", annualSpend: 1_000_000, coveragePct: 90, renewal: "Open term" }),
  mk({ id: "amb", vendorName: "Ambient AI", annualSpend: 700_000, coveragePct: 100, renewal: "2026" }),
  mk({ id: "iod", vendorName: "Iodine", annualSpend: 600_000, coveragePct: 75, renewal: "2028" }),
  mk({ id: "sta", vendorName: "Stanson", annualSpend: 500_000, coveragePct: 70, renewal: "2028" }),
];

describe("computeRoadmap (currentYear 2026, term 3)", () => {
  const rm = computeRoadmap(stack, 3, 2026);

  it("has term+1 snapshots labelled Today then Year 1..N", () => {
    expect(rm.snapshots.map((s) => s.label)).toEqual(["Today", "Year 1", "Year 2", "Year 3"]);
  });
  it("snapshot totals step down as tools retire", () => {
    expect(rm.snapshots.map((s) => s.total)).toEqual([4_600_000, 3_000_000, 1_560_000, 760_000]);
  });
  it("per-year deltas sum the retired amounts and carry tool names", () => {
    expect(rm.deltas.map((d) => d.amount)).toEqual([1_600_000, 1_440_000, 800_000]);
    expect(rm.deltas[0].tools.sort()).toEqual(["Ambient AI", "UpToDate"]);
    expect(rm.deltas[1].tools).toEqual(["Fluency"]);
  });
  it("running totals accumulate", () => {
    expect(rm.deltas.map((d) => d.running)).toEqual([1_600_000, 3_040_000, 3_840_000]);
  });
  it("reports totalRetired and endStays", () => {
    expect(rm.totalRetired).toBe(3_840_000);
    expect(rm.endStays).toBe(760_000);
  });
  it("the read names the year with the largest delta and notes renewal gating", () => {
    expect(rm.read).toContain("Year 1");
    expect(rm.read.toLowerCase()).toContain("renewal");
  });
  it("filters zero-spend items and is empty-safe", () => {
    const rm0 = computeRoadmap([mk({ id: "z", annualSpend: 0 })], 3, 2026);
    expect(rm0.snapshots[0].perTool).toHaveLength(0);
    expect(rm0.totalRetired).toBe(0);
    expect(rm0.deltas.every((d) => d.amount === 0)).toBe(true);
  });
  it("reads clearly when nothing retires", () => {
    const rmNone = computeRoadmap([mk({ id: "n", annualSpend: 500_000, coveragePct: 0, renewal: "Open term" })], 3, 2026);
    expect(rmNone.totalRetired).toBe(0);
    expect(rmNone.read.toLowerCase()).toContain("nothing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/__tests__/appRationalizationRoadmap.test.ts`
Expected: FAIL — cannot resolve `@/lib/appRationalizationRoadmap`.

- [ ] **Step 3: Write the implementation**

```ts
// client/src/lib/appRationalizationRoadmap.ts
// Pure roadmap model for "The change": how the adjacent stack comes apart over
// the contract term. Snapshots (Today + each year) with per-tool remaining
// spend, per-year retirement deltas with running totals, and a data-aware read.
import {
  itemRetired, itemStays, itemDisplayName, computeTotals, retirementYear,
  type AppRatItem,
} from "./appRationalizationCalc";

export interface RoadmapSnapshot {
  label: string;
  year: number; // 0 = today, 1..N = end of that year
  total: number;
  perTool: { id: string; name: string; remaining: number }[];
}

export interface RoadmapDelta {
  year: number;
  amount: number;
  running: number;
  tools: string[];
}

export interface Roadmap {
  termYears: number;
  snapshots: RoadmapSnapshot[];
  deltas: RoadmapDelta[];
  totalRetired: number;
  endStays: number;
  read: string;
}

export function computeRoadmap(items: AppRatItem[], termYears: number, currentYear?: number): Roadmap {
  const term = Math.max(1, Math.floor(termYears));
  const rows = items.filter((i) => (i.annualSpend || 0) > 0);
  const totals = computeTotals(rows);

  const enriched = rows.map((r) => ({
    id: r.id,
    name: itemDisplayName(r),
    spend: r.annualSpend,
    retired: itemRetired(r),
    stays: itemStays(r),
    ry: retirementYear(r, term, currentYear),
  }));

  const snapshots: RoadmapSnapshot[] = [];
  for (let y = 0; y <= term; y++) {
    const perTool = enriched.map((e) => ({
      id: e.id,
      name: e.name,
      remaining: y === 0 ? e.spend : e.ry <= y ? e.stays : e.spend,
    }));
    snapshots.push({
      label: y === 0 ? "Today" : `Year ${y}`,
      year: y,
      total: perTool.reduce((s, t) => s + t.remaining, 0),
      perTool,
    });
  }

  const deltas: RoadmapDelta[] = [];
  let running = 0;
  for (let y = 1; y <= term; y++) {
    const thisYear = enriched.filter((e) => e.ry === y);
    const amount = thisYear.reduce((s, e) => s + e.retired, 0);
    running += amount;
    deltas.push({ year: y, amount, running, tools: thisYear.filter((e) => e.retired > 0).map((e) => e.name) });
  }

  const totalRetired = totals.toAbridge;
  const endStays = snapshots[snapshots.length - 1]?.total ?? 0;

  let read: string;
  if (rows.length === 0) {
    read = "Add applications with spend to see the roadmap.";
  } else if (totalRetired === 0) {
    read = "Nothing retires at the current coverage. Raise coverage on a tool to see it come off the stack.";
  } else {
    let maxYear = 1;
    for (let i = 0; i < deltas.length; i++) if (deltas[i].amount > deltas[maxYear - 1].amount) maxYear = deltas[i].year;
    const gated = enriched.some((e) => e.ry > 1 && e.retired > 0);
    read = `Most of the retirement lands in Year ${maxYear}.` +
      (gated
        ? " The rest is renewal-gated, so it holds until those contracts turn over."
        : " It can all move now.");
  }

  return { termYears: term, snapshots, deltas, totalRetired, endStays, read };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/__tests__/appRationalizationRoadmap.test.ts`
Expected: PASS (9 cases).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/appRationalizationRoadmap.ts client/src/__tests__/appRationalizationRoadmap.test.ts
git commit -m "App Rationalization: roadmap model (snapshots, deltas, read) + tests"
```

---

### Task 3: `RoadmapChart` panel component

**Files:**
- Create: `client/src/components/forecast/RoadmapChart.tsx`

**Interfaces:**
- Consumes: `computeRoadmap` from `@/lib/appRationalizationRoadmap`; `AnimatedValue` from `@/components/explore/AnimatedValue`; `type AppRatItem` from `@/lib/appRationalizationCalc`.
- Produces: `RoadmapChart` default export, props `{ items: AppRatItem[]; termYears: number }`. Renders the full beige panel (top label + hero retired stat + read + legend + stacked-bar SVG + year strip).

- [ ] **Step 1: Write the component**

Bars, trend, and delta pills are positioned from the snapshot totals; the taupe ramp and pixel stacking live here. Animations are gated behind `prefers-reduced-motion: no-preference` so the reduced-motion default is the final, visible state. No unit test (SVG; the data is tested in Task 2). Verify via tsc + build.

```tsx
// client/src/components/forecast/RoadmapChart.tsx
import { useMemo } from "react";
import { computeRoadmap } from "@/lib/appRationalizationRoadmap";
import { AnimatedValue } from "@/components/explore/AnimatedValue";
import type { AppRatItem } from "@/lib/appRationalizationCalc";

const TAUPE = ["#5A5148", "#7A6E60", "#8E8172", "#A2937F", "#B6A78F", "#C6B9A2"];

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export default function RoadmapChart({ items, termYears }: { items: AppRatItem[]; termYears: number }) {
  const rm = useMemo(() => computeRoadmap(items, termYears), [items, termYears]);
  const tools = rm.snapshots[0]?.perTool ?? [];
  const colorFor = (id: string) => {
    const idx = tools.findIndex((t) => t.id === id);
    return TAUPE[(idx < 0 ? 0 : idx) % TAUPE.length];
  };

  // geometry
  const W = 860, baseline = 270, plotTop = 60, plotLeft = 70, plotRight = 800;
  const n = rm.snapshots.length;
  const slotW = (plotRight - plotLeft) / Math.max(1, n);
  const barW = Math.min(76, slotW * 0.5);
  const centerX = (i: number) => plotLeft + slotW * (i + 0.5);
  const maxTotal = Math.max(1, rm.snapshots[0]?.total ?? 1);
  const k = (baseline - plotTop) / maxTotal;
  const yOf = (v: number) => baseline - v * k;

  const trendPts = rm.snapshots.map((s, i) => `${centerX(i)},${yOf(s.total)}`).join(" ");

  if (tools.length === 0) {
    return (
      <div className="rounded-[24px] p-10 text-center text-[#8C7E6E] text-sm" style={{ background: "linear-gradient(180deg,#F8F3EA,#F3ECE0)", border: "1px solid #EBE2D3" }}>
        Add applications with annual spend to see the roadmap.
      </div>
    );
  }

  return (
    <div
      className="rounded-[24px] p-7 md:p-8"
      style={{ background: "linear-gradient(180deg,#F8F3EA,#F3ECE0)", border: "1px solid #EBE2D3", boxShadow: "0 24px 60px rgba(120,100,70,.10), 0 2px 6px rgba(120,100,70,.05)" }}
    >
      <div className="flex justify-between items-start">
        <div className="text-[10.5px] font-bold uppercase tracking-[2px] text-[#8C7E6E] pt-2">Adjacent stack cost · over the term</div>
        <div className="text-right leading-none">
          <AnimatedValue value={rm.totalRetired} format={(v) => `−${fmtM(v)}`} className="text-[30px] font-extrabold text-[#EA2C00] tracking-tight tabular-nums" />
          <div className="text-[11px] text-[#8C7E6E] font-semibold mt-1.5">retired across {rm.termYears} {rm.termYears === 1 ? "year" : "years"}</div>
        </div>
      </div>

      <div className="flex gap-2.5 mt-4 mb-1 items-start" style={{ padding: "11px 15px", background: "rgba(234,44,0,.05)", borderLeft: "3px solid #EA2C00", borderRadius: 8 }}>
        <span className="text-[10px] font-extrabold uppercase tracking-[1.5px] text-[#EA2C00] pt-0.5 whitespace-nowrap">The read</span>
        <span className="text-[13px] text-[#4A443D] leading-relaxed">{rm.read}</span>
      </div>

      <div className="flex gap-[15px] flex-wrap my-3.5 text-[11.5px] text-[#6B6B6B]">
        {tools.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5">
            <i className="w-[11px] h-[11px] rounded-[3px] inline-block" style={{ background: colorFor(t.id) }} />
            {t.name}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} 300`} width="100%" style={{ fontFamily: "Manrope, sans-serif" }} data-testid="roadmap-svg">
        <defs>
          {rm.snapshots.map((s, i) => (
            <clipPath key={i} id={`rm-clip-${i}`}>
              <rect x={centerX(i) - barW / 2} y={yOf(s.total)} width={barW} height={baseline - yOf(s.total) + 12} rx={7} />
            </clipPath>
          ))}
          <filter id="rm-ps" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* y refs */}
        {[0, maxTotal / 2, maxTotal].map((v, i) => (
          <g key={i}>
            <line x1={plotLeft} y1={yOf(v)} x2={plotRight} y2={yOf(v)} stroke={v === 0 ? "#DED4C3" : "#EAE1D2"} />
            <text x={plotLeft - 10} y={yOf(v) + 4} textAnchor="end" fill="#B4A99B" fontSize={10}>{fmtM(v)}</text>
          </g>
        ))}

        {/* trend */}
        <polyline className="rm-trend" points={trendPts} fill="none" stroke="#EA2C00" strokeWidth={1.5} strokeDasharray="6 5" opacity={0.6} />

        {/* bars */}
        {rm.snapshots.map((s, i) => {
          const bx = centerX(i) - barW / 2;
          let cursor = baseline;
          return (
            <g key={i} className="rm-bar" style={{ animationDelay: `${0.05 + i * 0.13}s` }}>
              <g clipPath={`url(#rm-clip-${i})`}>
                {s.perTool.filter((t) => t.remaining > 0).map((t) => {
                  const h = t.remaining * k;
                  const y = cursor - h;
                  cursor = y;
                  return <rect key={t.id} x={bx} y={y} width={barW} height={h} fill={colorFor(t.id)} />;
                })}
              </g>
              <text x={centerX(i)} y={yOf(s.total) - 8} textAnchor="middle" fill="#1A1A1A" fontSize={13.5} fontWeight={800} style={{ fontVariantNumeric: "tabular-nums" }}>{fmtM(s.total)}</text>
              <text x={centerX(i)} y={baseline + 20} textAnchor="middle" fill="#8C7E6E" fontSize={10.5} fontWeight={700} letterSpacing={1}>{s.label.toUpperCase()}</text>
            </g>
          );
        })}

        {/* delta pills */}
        {rm.deltas.filter((d) => d.amount > 0).map((d) => {
          const x = (centerX(d.year - 1) + centerX(d.year)) / 2;
          const py = (yOf(rm.snapshots[d.year - 1].total) + yOf(rm.snapshots[d.year].total)) / 2;
          const label = `−${fmtM(d.amount)}`;
          const w = 30 + label.length * 8;
          return (
            <g key={d.year} className="rm-pill" style={{ animationDelay: `${0.9 + d.year * 0.18}s` }} filter="url(#rm-ps)">
              <rect x={x - w / 2} y={py - 11} width={w} height={22} rx={11} fill="#EA2C00" />
              <text x={x} y={py + 4} textAnchor="middle" fill="#fff" fontSize={11.5} fontWeight={800} style={{ fontVariantNumeric: "tabular-nums" }}>{label}</text>
            </g>
          );
        })}
      </svg>

      <div className="grid gap-2.5 mt-5" style={{ gridTemplateColumns: `repeat(${Math.min(rm.deltas.length, 4)}, 1fr)` }}>
        {rm.deltas.filter((d) => d.amount > 0).slice(0, 4).map((d) => (
          <div key={d.year} className="rounded-[12px] p-[13px_15px]" style={{ background: "#FCFAF5", border: "1px solid #ECE4D6" }}>
            <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#8C7E6E]">Year {d.year}</div>
            <div className="text-[12.5px] text-[#4A443D] mt-1.5">{d.tools.join(", ")}</div>
            <div className="text-[16px] font-extrabold text-[#EA2C00] mt-1.5 tabular-nums">−{fmtM(d.amount)}</div>
            <div className="text-[10.5px] text-[#8C7E6E] mt-1 tabular-nums">running {fmtM(d.running)} retired</div>
          </div>
        ))}
      </div>

      <style>{`
        .rm-bar{opacity:1}
        .rm-pill{opacity:1}
        @media (prefers-reduced-motion: no-preference){
          .rm-bar{opacity:0;transform:translateY(20px);animation:rmRise .7s cubic-bezier(.2,.7,.3,1) forwards}
          .rm-trend{stroke-dashoffset:900;animation:rmDraw 1.1s .5s ease-out forwards}
          .rm-pill{opacity:0;transform:scale(.85);animation:rmPop .4s both}
        }
        @keyframes rmRise{to{opacity:1;transform:translateY(0)}}
        @keyframes rmDraw{to{stroke-dashoffset:0}}
        @keyframes rmPop{to{opacity:1;transform:scale(1)}}
      `}</style>
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
git add client/src/components/forecast/RoadmapChart.tsx
git commit -m "App Rationalization: RoadmapChart beige stacked-bar panel"
```

---

### Task 4: Wire the "change" step into the flow shell

**Files:**
- Modify: `client/src/pages/forecast/AppRationalizationFlow.tsx`

**Interfaces:**
- Consumes: `RoadmapChart` from `@/components/forecast/RoadmapChart` (Task 3).
- Produces: nothing new (final wiring).

- [ ] **Step 1: Add the import and extend the step union**

At the top of `AppRationalizationFlow.tsx`, add:

```tsx
import RoadmapChart from "@/components/forecast/RoadmapChart";
```

Change the step type from:

```tsx
type ArStep = "setup" | "applications" | "consolidation";
```

to:

```tsx
type ArStep = "setup" | "applications" | "consolidation" | "change";
```

- [ ] **Step 2: Add a forward button on the consolidation step**

In the consolidation step block (added in Phase 2), find its footer control:

```tsx
              <div className="mt-8 text-center">
                <button
                  onClick={() => setStep("applications")}
                  className="text-sm font-semibold text-[#EA2C00]"
                  data-testid="ar-back-to-applications"
                >
                  ← Back to applications
                </button>
              </div>
```

Replace it with a back + forward pair:

```tsx
              <div className="mt-8 flex items-center justify-center gap-6">
                <button
                  onClick={() => setStep("applications")}
                  className="text-sm font-semibold text-[#8C7E6E] hover:text-[#1A1A1A] transition-colors"
                  data-testid="ar-back-to-applications"
                >
                  ← Back to applications
                </button>
                <button
                  onClick={() => setStep("change")}
                  className="h-11 px-6 rounded-xl bg-[#EA2C00] text-white text-sm font-semibold"
                  data-testid="ar-see-the-change"
                >
                  See the change →
                </button>
              </div>
```

- [ ] **Step 3: Add the "change" step block**

Immediately after the closing `)}` of the `{step === "consolidation" && ...}` block, add:

```tsx
        {step === "change" && (
          <div data-testid="ar-step-change" className="max-w-[940px] mx-auto px-6 py-8">
            <h1 className="font-abridge text-4xl uppercase tracking-tight text-[#1A1A1A] text-center">The change</h1>
            <p className="text-[15px] text-[#6B6B6B] text-center mt-3 mb-8">
              Watch the stack come apart, tool by tool, as each reaches a point where Abridge can take it on.
            </p>
            <RoadmapChart items={items} termYears={termYears} />
            <div className="mt-8 text-center">
              <button
                onClick={() => setStep("consolidation")}
                className="text-sm font-semibold text-[#8C7E6E] hover:text-[#1A1A1A] transition-colors"
                data-testid="ar-back-to-consolidation"
              >
                ← Back to the consolidation
              </button>
            </div>
          </div>
        )}
```

The change step is the current terminal (back only); the Phase-4 "why we can" forward is deferred. The hero retired stat and "The read" live inside `RoadmapChart`, so the step itself only carries the title and lede.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` → 0 errors.
Run: `npx vitest run` → all green.
Run: `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/forecast/AppRationalizationFlow.tsx
git commit -m "App Rationalization: wire The change step + consolidation forward button"
```

- [ ] **Step 6: Manual verification note**

This environment cannot render SVG. The user verifies on Replit: Forecast → App Rationalization → add tools with spend, coverage, and varied Renews values → See the consolidation → See the change. Confirm the beige roadmap: bars step down Today → Year N, the trend draws, delta pills pop, the retired stat counts up, "The read" names the biggest-drop year, the Year strip shows running totals, and (with reduced motion enabled at the OS level) everything is visible without animation. Confirm palette (coral + warm neutrals, no green/amber), Abridge title, and correct behavior at term lengths 1, 3, and 5.

---

## Self-Review

**Spec coverage:** renewal→retirement-year (with clamp/Unknown/Open-term) + tests → Task 1. Roadmap snapshots/deltas/running/read/endStays + tests → Task 2. Beige stacked-bar SVG with trend, delta pills, legend, reduced-motion-safe animation, hero count-up, read, year strip → Task 3. The "change" step + consolidation forward button + terminal wiring → Task 4. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Every code step is complete. The empty-state and "nothing retires" branches are real rendered copy.

**Type consistency:** `retirementYear(item, termYears, currentYear?)` defined in Task 1, consumed in Task 2. `computeRoadmap` returns `Roadmap` with `snapshots`/`deltas`/`totalRetired`/`endStays`/`read`/`termYears`, all consumed identically in Task 3 (`rm.snapshots`, `rm.deltas`, `rm.totalRetired`, `rm.read`, `rm.termYears`). `RoadmapChart` props `{ items: AppRatItem[]; termYears: number }` match the Task-4 usage (`items`, `termYears` from shell state). `AnimatedValue` used with `value`/`format`/`className`. `RoadmapDelta` fields (`year`/`amount`/`running`/`tools`) match the strip + pill usage.

**Constraint check:** coral + warm neutrals only (taupe ramp, no green/amber/orange); no status pills; no em dashes/jargon in copy; `.font-abridge` on the title; tabular-nums on figures; AnimatedValue count-up; animation gated behind `prefers-reduced-motion: no-preference` with visible default; only `AppRationalizationFlow.tsx` changed among prior-phase files; no Compare Pricing / ArStackCard changes.
