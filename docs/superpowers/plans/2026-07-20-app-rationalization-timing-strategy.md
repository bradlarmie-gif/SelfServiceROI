# App Rationalization · Timing Strategy (Cumulative Savings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable "Cumulative savings" view to the App Rationalization consolidation screen — an interactive timing instrument (aggregate savings curve + per-tool draggable sunset timelines) that shows how acting sooner captures more — while the waterfall stays the default "what" view. Move per-tool timing off the Applications screen and retire the static rollout beat.

**Architecture:** The consolidation screen becomes a two-view card behind a segmented toggle (default "The consolidation" = existing waterfall; "Cumulative savings" = new `ConsolidationTiming`). Per-tool timing is remodeled from a coarse `when` bucket to `contractMonths` + `sunsetMonths` in `AppRatItem`; a new pure `buildCumulativeSavings` powers both the on-screen curve and the PDF. The Applications screen loses its "Comes off" column; the PDF gains a cumulative-savings section beside the waterfall.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + Tailwind; framer-motion (not required here); lucide-react; @react-pdf/renderer; Radix Slider/Dialog; vitest (node env, no jsdom). Verify with `npx tsc --noEmit -p tsconfig.json`, `npx vitest run`, `npm run build`.

## Global Constraints

- No em dashes anywhere, including code comments and CSS. The minus sign "−" is allowed for negative money.
- Coral `#EA2C00` is the accent only (sunset marker, plan line, savings figures) — never a flooded fill. "Still paying" runway is neutral taupe `#9C8F7D`; timeline base `#E4DBCC`; muted labels `#B4A99B`; today/tool neutral `#7E7263`; stays `#C6B9A2`; statement `#3A342E`; secondary text `#8C7E6E` / `#6B6B6B`.
- Abridge display font via `.font-abridge` on titles/eyebrows ONLY; Manrope for UI; `tabular-nums` on every number.
- `AnimatedValue` count-ups on headline figures. All motion gated behind `@media (prefers-reduced-motion: no-preference)`, with the settled state as the reduced-motion default.
- Every number input uses the shared `NumberField` (`@/components/NumberField`) to avoid the empty-input coercion bug.
- Defensible copy: "sunset" / "consolidates onto Abridge"; never "coverage". State upside, never scold.
- Env cannot render the app: math is unit-tested; the visual feel is verified by Brad on Replit. Do NOT add jsdom/testing-library.
- `ConsolidationTiming` defines ONE `xPct(month)` shared by the curve overlay labels and every per-tool timeline track, so they align to the same Today→horizon axis.

---

### Task 1: Calc — month-based timing model + cumulative savings

**Files:**
- Modify: `client/src/lib/appRationalizationCalc.ts`
- Create: `client/src/__tests__/appRationalizationCumulative.test.ts`
- Modify: `client/src/__tests__/appRationalizationAddFlow.test.ts`
- Delete: `client/src/__tests__/appRationalizationRetirementYear.test.ts`
- Delete: `client/src/__tests__/appRationalizationRollout.test.ts`

**Interfaces:**
- Produces: `AppRatItem` with `contractMonths: number` and `sunsetMonths: number` (no `when`); `makeItem(id, category)` seeds `contractMonths: 12, sunsetMonths: 12`. `toolMonthlySaving(item): number`; `CumulativeTool`, `CumulativeSavings`; `buildCumulativeSavings(items, horizonMonths): CumulativeSavings`; `cumulativeSavedAt(tools, month, mode): number`; `sunsetDateLabel(monthsFromNow, from?): string`.
- Consumes: existing `itemRetired`, `itemDisplayName`, `categoryLabel`.
- Removed (no consumers after Tasks 2/4/5): `AppRatWhen`, `AR_WHEN_OPTIONS`, `WHEN_TO_YEAR`, `retirementYear`, `RolloutPhase`, `Rollout`, `buildRollout`, `rolloutYearLabel`.

- [ ] **Step 1: Write the failing test** — create `client/src/__tests__/appRationalizationCumulative.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  makeItem, toolMonthlySaving, buildCumulativeSavings, cumulativeSavedAt, sunsetDateLabel,
  type AppRatItem,
} from "@/lib/appRationalizationCalc";

const tool = (id: string, spend: number, pct: number, contractMonths: number, sunsetMonths: number): AppRatItem =>
  ({ ...makeItem(id, "ambientDoc"), annualSpend: spend, coveragePct: pct, contractMonths, sunsetMonths });

describe("timing defaults", () => {
  it("makeItem seeds a 12-month contract sunsetting at renewal", () => {
    const i = makeItem("a", "cds");
    expect(i.contractMonths).toBe(12);
    expect(i.sunsetMonths).toBe(12);
  });
});

describe("toolMonthlySaving", () => {
  it("spreads the annual sunset value over 12 months", () => {
    // 120000 spend * 100% displace = 120000/yr sunset -> 10000/mo
    expect(toolMonthlySaving(tool("a", 120_000, 100, 12, 12))).toBe(10_000);
  });
});

describe("buildCumulativeSavings", () => {
  it("computes plan/now totals, gap, and early-exit deltas over the horizon", () => {
    // one tool: 120k/yr sunset = 10k/mo, contract 12mo, sunset pulled to 6mo, horizon 36mo
    const cs = buildCumulativeSavings([tool("a", 120_000, 100, 12, 6)], 36);
    expect(cs.hasCurve).toBe(true);
    expect(cs.tools).toHaveLength(1);
    // plan: saves for (36-6)=30 months * 10k = 300k
    expect(cs.planTotal).toBe(300_000);
    // now: saves for 36 months * 10k = 360k
    expect(cs.nowTotal).toBe(360_000);
    expect(cs.gap).toBe(60_000);
    // early: pulled 12-6=6 months early -> 6*10k = 60k captured sooner
    expect(cs.tools[0].earlyMonths).toBe(6);
    expect(cs.tools[0].earlySaving).toBe(60_000);
  });

  it("excludes tools that never sunset (monthlySaving === 0)", () => {
    const cs = buildCumulativeSavings([tool("a", 100_000, 0, 12, 12)], 36);
    expect(cs.hasCurve).toBe(false);
    expect(cs.tools).toHaveLength(0);
  });

  it("clamps sunsetMonths into [0, contractMonths]", () => {
    // sunset 99 but contract 12 -> treated as 12
    const cs = buildCumulativeSavings([tool("a", 120_000, 100, 12, 99)], 36);
    // saves for (36-12)=24 months * 10k = 240k
    expect(cs.planTotal).toBe(240_000);
    expect(cs.tools[0].sunsetMonths).toBe(12);
  });
});

describe("cumulativeSavedAt", () => {
  it("is zero before sunset and linear after, per mode", () => {
    const cs = buildCumulativeSavings([tool("a", 120_000, 100, 12, 6)], 36);
    expect(cumulativeSavedAt(cs.tools, 6, "plan")).toBe(0);
    expect(cumulativeSavedAt(cs.tools, 12, "plan")).toBe(60_000); // 6 months * 10k
    expect(cumulativeSavedAt(cs.tools, 12, "now")).toBe(120_000); // 12 months * 10k
  });
});

describe("sunsetDateLabel", () => {
  const from = new Date(2026, 6, 1); // Jul 2026 (month index 6)
  it("returns 'now' at month 0", () => {
    expect(sunsetDateLabel(0, from)).toBe("now");
  });
  it("returns a MMM YYYY date derived from months-from-now", () => {
    expect(sunsetDateLabel(6, from)).toBe("Jan 2027");
    expect(sunsetDateLabel(12, from)).toBe("Jul 2027");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails** — `npx vitest run client/src/__tests__/appRationalizationCumulative.test.ts` → FAIL (imports/functions not defined).

- [ ] **Step 3: Edit `appRationalizationCalc.ts`.**

  (a) Replace the `when` field and the `AppRatWhen`/`AR_WHEN_OPTIONS` block. Remove lines 12-19 (`AppRatWhen` type + `AR_WHEN_OPTIONS`). In `AppRatItem` (lines 124-132) replace `when: AppRatWhen;` with:

```ts
  contractMonths: number;   // months from today until the contract ends (the runway)
  sunsetMonths: number;     // months from today until they sunset it; 0..contractMonths
```

  (b) In `makeItem` (line 156-158) return:

```ts
export function makeItem(id: string, category: AppRatCategoryId): AppRatItem {
  return { id, category, annualSpend: 0, coveragePct: CATEGORY_DEFAULT_COVERAGE[category] ?? 80, contractMonths: 12, sunsetMonths: 12 };
}
```

  (c) Delete the entire rollout/retirement block (lines 254-320): `WHEN_TO_YEAR`, `retirementYear`, the `Rollout` comment banner, `RolloutPhase`, `Rollout`, `rolloutYearLabel`, `buildRollout`.

  (d) Append the new timing calc at the end of the file:

```ts
// -------- Timing: cumulative savings over the horizon (the "when" view) --------

/** Monthly dollars a tool saves once it has sunset: its annual sunset value / 12. */
export function toolMonthlySaving(item: AppRatItem): number {
  return itemRetired(item) / 12;
}

export interface CumulativeTool {
  id: string;
  name: string;
  capability: string;
  spend: number;
  monthlySaving: number;
  contractMonths: number;
  sunsetMonths: number;   // clamped to [0, contractMonths]
  earlyMonths: number;    // contractMonths - sunsetMonths (months pulled forward)
  earlySaving: number;    // earlyMonths * monthlySaving (captured sooner by acting early)
}

export interface CumulativeSavings {
  horizonMonths: number;
  tools: CumulativeTool[]; // only tools that actually save (monthlySaving > 0)
  planTotal: number;       // cumulative saved by the horizon under the current sunset plan
  nowTotal: number;        // cumulative saved by the horizon if every tool sunset today (the ceiling)
  gap: number;             // nowTotal - planTotal: what waiting leaves on the table
  hasCurve: boolean;       // at least one tool saves
}

/**
 * Per-tool monthly savings and the aggregate plan-vs-now curve totals over a
 * horizon (in months). "Plan" starts each tool saving at its sunsetMonths;
 * "now" is the ceiling where every tool sunsets at month 0. sunsetMonths is
 * clamped to [0, contractMonths]; contractMonths is floored at 0.
 */
export function buildCumulativeSavings(items: AppRatItem[], horizonMonths: number): CumulativeSavings {
  const horizon = Math.max(0, Math.round(horizonMonths));
  const tools: CumulativeTool[] = items
    .map((i) => {
      const monthlySaving = toolMonthlySaving(i);
      const contractMonths = Math.max(0, Math.round(i.contractMonths ?? 0));
      const sunsetMonths = Math.min(contractMonths, Math.max(0, Math.round(i.sunsetMonths ?? 0)));
      const earlyMonths = Math.max(0, contractMonths - sunsetMonths);
      return {
        id: i.id,
        name: itemDisplayName(i),
        capability: categoryLabel(i.category),
        spend: i.annualSpend || 0,
        monthlySaving,
        contractMonths,
        sunsetMonths,
        earlyMonths,
        earlySaving: earlyMonths * monthlySaving,
      };
    })
    .filter((t) => t.monthlySaving > 0);

  const planTotal = cumulativeSavedAt(tools, horizon, "plan");
  const nowTotal = cumulativeSavedAt(tools, horizon, "now");
  return {
    horizonMonths: horizon,
    tools,
    planTotal,
    nowTotal,
    gap: Math.max(0, nowTotal - planTotal),
    hasCurve: tools.length > 0,
  };
}

/** Cumulative dollars saved by `month`. "plan" uses each tool's sunsetMonths; "now" uses 0. */
export function cumulativeSavedAt(tools: CumulativeTool[], month: number, mode: "plan" | "now"): number {
  return tools.reduce((sum, t) => {
    const start = mode === "now" ? 0 : t.sunsetMonths;
    return sum + Math.max(0, month - start) * t.monthlySaving;
  }, 0);
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

/** "now" at 0, else the MMM YYYY date `monthsFromNow` after `from` (default today). */
export function sunsetDateLabel(monthsFromNow: number, from: Date = new Date()): string {
  const m = Math.max(0, Math.round(monthsFromNow));
  if (m === 0) return "now";
  return MONTH_FMT.format(new Date(from.getFullYear(), from.getMonth() + m, 1));
}
```

- [ ] **Step 4: Run the new test** — `npx vitest run client/src/__tests__/appRationalizationCumulative.test.ts` → PASS.

- [ ] **Step 5: Delete the obsolete tests** — remove `client/src/__tests__/appRationalizationRetirementYear.test.ts` and `client/src/__tests__/appRationalizationRollout.test.ts`.

- [ ] **Step 6: Update `appRationalizationAddFlow.test.ts`.** It imports `buildRollout` and asserts `when`. Change the import line (line 3) to drop `buildRollout`:

```ts
  makeItem, buildStackBars, computeNet,
```

  Replace every `when: "..."` in the `addItem(...)` calls with `contractMonths`/`sunsetMonths` pairs that keep intent (a "thisYear" tool ≈ `contractMonths: 12, sunsetMonths: 12`; "nextYear" ≈ `contractMonths: 24, sunsetMonths: 24`). Replace the `buildRollout(...)` assertions (the "rolls out" cases) with `buildCumulativeSavings(items, 36)` assertions: assert `hasCurve`, `tools.length`, and that `planTotal <= nowTotal`. Replace the `makeItem(...).when` assertion (line 82) with `expect(makeItem("c", "custom").sunsetMonths).toBe(12);`. Add `buildCumulativeSavings` to the import.

- [ ] **Step 7: Full suite + typecheck** — `npx vitest run` (green) and `npx tsc --noEmit -p tsconfig.json` (0). NOTE: `ArStackRow`, `ArAddToolModal`, `AppRationalizationPDFExport`, `RolloutBeat`, `AppRationalizationFlow` still reference removed symbols and will fail tsc here. That is expected mid-plan; run tsc scoped is not possible, so this step's tsc will report errors ONLY in those five files. Confirm no errors originate in `appRationalizationCalc.ts` or the test files, then proceed. (Tasks 2/4/5 clear the rest; the suite itself must be green.)

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(app-rat): month-based contract/sunset timing model + cumulative savings calc"`

---

### Task 2: Applications — remove the "Comes off" column and the modal's when picker

**Files:**
- Modify: `client/src/pages/forecast/appRationalization/ArStackRow.tsx`
- Modify: `client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx`
- Modify: `client/src/pages/forecast/appRationalization/ArAddToolModal.tsx`

**Interfaces:**
- Consumes: `AppRatItem` without `when` (Task 1). `onConfirm(category, init)` no longer includes `when` in `init`.

- [ ] **Step 1: `ArStackRow.tsx` — drop the when select.** Remove `ChevronDown` from the lucide import (line 2) and `AR_WHEN_OPTIONS` + `type AppRatWhen` from the calc import (lines 7-8) — keep `itemRetired, itemStays, APP_RAT_CATEGORIES, type AppRatItem`. Change the grid template on line 26 from `md:grid-cols-[1fr_120px_190px_150px_120px]` to `md:grid-cols-[1fr_120px_220px_130px]`. Delete the entire "Over (when)" block (lines 72-84, the `<div className="relative"><select ...>...</select><ChevronDown/></div>`).

- [ ] **Step 2: `ArApplicationsStep.tsx` — drop the header + match grid.** Line 17: `const COL_HEADERS = ["Application", "Annual spend", "How much could you displace?", "Displaceable"];`. Line 131: change the column-header grid from `grid-cols-[1fr_120px_190px_150px_120px]` to `grid-cols-[1fr_120px_220px_130px]`.

- [ ] **Step 3: `ArAddToolModal.tsx` — remove the "When does it sunset?" picker.** Remove `type AppRatWhen` and `AR_WHEN_OPTIONS` from the calc import (line 19 area). Delete the `const [when, setWhen] = useState<AppRatWhen>("thisYear");` state (line 42) and the `setWhen(s.when)` reset (line 53). Delete the entire "When does it sunset?" segmented block (around lines 149-160). In `onConfirm` (line 186) drop `, when` so it reads `onConfirm(activeCategory, { vendorName: vendor.trim() || undefined, annualSpend: spend, coveragePct: pct })`. Update the file's top comment (line 5) to remove the `"When does it sunset?"` mention.

- [ ] **Step 4: Verify** — `npx tsc --noEmit -p tsconfig.json` should now show errors ONLY in `AppRationalizationFlow.tsx`, `RolloutBeat.tsx`, `AppRationalizationPDFExport.tsx` (cleared in Tasks 4/5). `npx vitest run` green. `grep -n "Comes off\|AppRatWhen\|AR_WHEN" client/src/pages/forecast/appRationalization/*.tsx` returns nothing.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(app-rat): move timing off Applications (remove Comes-off column + modal when picker)"`

---

### Task 3: New `ConsolidationTiming` component (curve + per-tool timelines)

**Files:**
- Create: `client/src/components/forecast/ConsolidationTiming.tsx`

**Interfaces:**
- Consumes: `buildCumulativeSavings`, `cumulativeSavedAt`, `sunsetDateLabel`, `type AppRatItem` (Task 1); `AnimatedValue`; `NumberField`.
- Produces: `export default function ConsolidationTiming(props: { items: AppRatItem[]; horizonYears: number; onHorizonChange: (y: number) => void; onUpdateItem: (id: string, patch: Partial<AppRatItem>) => void })`.

This is a new, self-contained component (not yet mounted). Port the approved companion mock `aligned-v3.html` to React. Shared geometry constants drive both the curve overlay and the timelines.

- [ ] **Step 1: Write the component.** Create `client/src/components/forecast/ConsolidationTiming.tsx`:

```tsx
// The "Cumulative savings" view: one instrument. On top, an aggregate curve of
// dollars saved over the horizon (coral "your plan" vs a dashed "if you moved
// now" ceiling). Below, each tool on the SAME x-axis: a neutral "still paying"
// runway from today to its sunset, a draggable coral sunset thumb, and a
// contract-end tick. Drag a sunset earlier and the curve lifts. The what lives
// in the waterfall; this is purely the when.
import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatedValue } from "@/components/explore/AnimatedValue";
import { NumberField } from "@/components/NumberField";
import {
  buildCumulativeSavings, cumulativeSavedAt, sunsetDateLabel, type AppRatItem,
} from "@/lib/appRationalizationCalc";

const HORIZON_OPTIONS = [2, 3, 4, 5];

// SVG viewBox for the curve; overlays positioned by percentage of these dims.
const VB_W = 1000, VB_H = 250;
const PL = 8, PR = 720, PT = 26, PB = 196; // plot rect inside the viewBox (right gutter for labels)
// One shared x-mapping (percent of width) for the curve overlay AND every timeline track.
const L_PCT = (PL / VB_W) * 100;                 // 0.8
const SPAN_PCT = ((PR - PL) / VB_W) * 100;       // 71.2
const xPct = (month: number, horizon: number) => L_PCT + (horizon <= 0 ? 0 : (month / horizon)) * SPAN_PCT;

function fmtM(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(a / 1_000)}K`;
  return `$${Math.round(a)}`;
}

export default function ConsolidationTiming({
  items, horizonYears, onHorizonChange, onUpdateItem,
}: {
  items: AppRatItem[];
  horizonYears: number;
  onHorizonChange: (y: number) => void;
  onUpdateItem: (id: string, patch: Partial<AppRatItem>) => void;
}) {
  const horizon = horizonYears * 12;
  const cs = useMemo(() => buildCumulativeSavings(items, horizon), [items, horizon]);

  if (!cs.hasCurve) {
    return (
      <div className="rounded-[20px] p-10 text-center text-sm text-[#8C7E6E]" style={{ background: "linear-gradient(160deg,#FDFBF8,#F6F1EA)", border: "1px solid #E8E2DA" }} data-testid="ar-timing-empty">
        Add applications with annual spend to see the savings build over time.
      </div>
    );
  }

  // Curve paths, sampled monthly.
  const maxY = Math.max(1, cs.nowTotal) * 1.06;
  const X = (m: number) => PL + (m / horizon) * (PR - PL);
  const Y = (v: number) => PB - (v / maxY) * (PB - PT);
  const path = (mode: "plan" | "now") => {
    let d = "";
    for (let m = 0; m <= horizon; m++) d += `${m ? "L" : "M"} ${X(m).toFixed(1)} ${Y(cumulativeSavedAt(cs.tools, m, mode)).toFixed(1)} `;
    return d.trim();
  };
  const planD = path("plan");
  const nowD = path("now");
  const pctX = (x: number) => (x / VB_W) * 100;
  const pctY = (y: number) => (y / VB_H) * 100;
  const yearMarks = Array.from({ length: horizonYears }, (_, i) => (i + 1) * 12);

  return (
    <div className="rounded-[20px] p-6 md:p-8" style={{ background: "linear-gradient(160deg,#FDFBF8,#F6F1EA)", border: "1px solid #E8E2DA" }} data-testid="ar-timing">
      {/* header: eyebrow + horizon selector */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <span className="font-abridge uppercase tracking-[0.16em] text-[11px] text-[#B4A99B]">Cumulative savings, over time</span>
        <div className="flex items-center gap-2 text-[11px] text-[#8C7E6E]">
          <span>over a</span>
          <div className="relative">
            <select
              value={horizonYears}
              onChange={(e) => onHorizonChange(Number(e.target.value))}
              className="h-8 appearance-none bg-white border border-[#E8E2DA] rounded-lg pl-2.5 pr-7 text-[12px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A] cursor-pointer"
              data-testid="ar-horizon-select"
            >
              {HORIZON_OPTIONS.map((y) => <option key={y} value={y}>{y}-year</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8C7E6E]" strokeWidth={2.25} />
          </div>
          <span>horizon</span>
        </div>
      </div>

      {/* the aggregate curve */}
      <div className="relative" data-testid="ar-timing-chart">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" className="block">
          <line x1={PL} y1={PB} x2={PR + 170} y2={PB} stroke="#DDD5C8" />
          {yearMarks.map((m) => <line key={m} x1={X(m)} y1={PT} x2={X(m)} y2={PB} stroke="#EFE7DC" strokeDasharray="2 4" />)}
          <path d={`${planD} L ${X(horizon)} ${PB} L ${X(0)} ${PB} Z`} fill="rgba(234,44,0,0.09)" />
          <path d={nowD} fill="none" stroke="#B4A99B" strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />
          <path className="ar-plan" d={planD} fill="none" stroke="#EA2C00" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={X(horizon)} cy={Y(cs.planTotal)} r={6} fill="#EA2C00" />
          <circle cx={X(horizon)} cy={Y(cs.nowTotal)} r={5} fill="#B4A99B" />
        </svg>

        {/* x labels */}
        <div className="absolute text-[9.5px] font-bold uppercase tracking-[0.04em] text-[#9CA3AF]" style={{ left: `${pctX(PL)}%`, top: `${pctY(PB + 12)}%` }}>Today</div>
        {yearMarks.map((m, i) => (
          <div key={m} className="absolute text-[9.5px] font-bold uppercase tracking-[0.04em] text-[#9CA3AF]" style={{ left: `${pctX(X(m))}%`, top: `${pctY(PB + 12)}%`, transform: "translateX(-50%)" }}>Year {i + 1}</div>
        ))}

        {/* endpoint labels */}
        <div className="absolute" style={{ left: `${pctX(X(horizon) + 14)}%`, top: `${pctY(Y(cs.nowTotal))}%`, transform: "translateY(-50%)" }}>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.13em] text-[#B4A99B]">If you moved now</div>
          <div className="text-[14px] font-extrabold tabular-nums text-[#B4A99B] leading-none mt-0.5">{fmtM(cs.nowTotal)}</div>
        </div>
        <div className="absolute" style={{ left: `${pctX(X(horizon) + 14)}%`, top: `${pctY(Y(cs.planTotal))}%`, transform: "translateY(-50%)" }}>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.13em] text-[#B4A99B]">Your plan</div>
          <AnimatedValue value={cs.planTotal} format={fmtM} className="text-[21px] font-extrabold tabular-nums text-[#EA2C00] leading-none block mt-0.5" style={{ letterSpacing: "-0.01em" }} />
          <div className="text-[10px] text-[#6B7280] mt-0.5">captured over {horizonYears} yrs</div>
        </div>
      </div>

      {/* per-tool levers */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#E8E2DA]">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#B4A99B]">Your tools · drag when each comes off</span>
        <div className="flex items-center gap-4 text-[10.5px] text-[#6B7280]">
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-1.5 rounded-[3px] bg-[#9C8F7D]" /> Still paying</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#EA2C00] border-2 border-[#FDFBF8]" /> Sunsets</span>
        </div>
      </div>

      <div className="mt-1">
        {cs.tools.map((t) => {
          const item = items.find((i) => i.id === t.id)!;
          const sliderMax = Math.min(t.contractMonths, horizon);
          const runwayRightPct = 100 - xPct(Math.min(t.sunsetMonths, horizon), horizon);
          const tickLeftPct = xPct(Math.min(t.contractMonths, horizon), horizon);
          const thumbLeftPct = xPct(Math.min(t.sunsetMonths, horizon), horizon);
          const contractDate = sunsetDateLabel(t.contractMonths);
          return (
            <div key={t.id} className="py-4 border-t border-[#EFE7DC] first:border-t-0" data-testid={`ar-timing-row-${t.id}`}>
              <div className="flex items-baseline justify-between mb-3.5 gap-3 flex-wrap">
                <div className="text-[14px] font-bold text-[#1A1A1A] min-w-0 truncate">
                  {t.name}
                  <span className="text-[12px] font-bold text-[#EA2C00] tabular-nums ml-2">{fmtM(t.spend)}/yr</span>
                  <span className="text-[11px] font-medium text-[#9CA3AF] ml-2">{t.capability}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                    <span>Contract ends in</span>
                    <div className="flex items-center h-7 w-11 bg-white border border-[#E8E2DA] rounded-md px-1.5 focus-within:border-[#EA2C00]">
                      <NumberField
                        value={item.contractMonths}
                        onValueChange={(v) => {
                          const c = Math.max(0, Math.min(120, v));
                          onUpdateItem(t.id, { contractMonths: c, sunsetMonths: Math.min(item.sunsetMonths, c) });
                        }}
                        min={0}
                        className="w-full bg-transparent text-center text-[12.5px] font-bold text-[#1A1A1A] outline-none tabular-nums"
                        data-testid={`ar-timing-contract-${t.id}`}
                      />
                    </div>
                    <span>mo</span>
                    <span className="text-[#C4B8A8]">·</span>
                    <span className="text-[10.5px] text-[#9CA3AF]">{contractDate}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 min-w-[140px] justify-end">
                    <span className="text-[8.5px] font-extrabold uppercase tracking-[0.11em] text-[#B4A99B]">Sunsets</span>
                    <span className="text-[13.5px] font-extrabold text-[#1A1A1A] tabular-nums" data-testid={`ar-timing-sunset-${t.id}`}>{sunsetDateLabel(t.sunsetMonths)}</span>
                  </div>
                </div>
              </div>

              <div className="relative h-[26px]">
                <div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-[2px] bg-[#E4DBCC] opacity-60" style={{ left: `${xPct(0, horizon)}%`, right: `${100 - xPct(horizon, horizon)}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-[3px] bg-[#9C8F7D]" style={{ left: `${xPct(0, horizon)}%`, right: `${runwayRightPct}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-[1px] bg-[#B4A99B]" style={{ left: `${tickLeftPct}%`, transform: "translate(-50%,-50%)" }} />
                <div className="absolute text-[8.5px] font-semibold text-[#9CA3AF] whitespace-nowrap" style={{ left: `${tickLeftPct}%`, top: "100%", transform: "translateX(-50%)" }}>contract ends</div>
                <div className="absolute top-1/2 w-[15px] h-[15px] rounded-full bg-[#EA2C00] border-[2.5px] border-[#FDFBF8] shadow-[0_1px_4px_rgba(234,44,0,0.35)] pointer-events-none" style={{ left: `${thumbLeftPct}%`, transform: "translate(-50%,-50%)" }} />
                <input
                  type="range" min={0} max={sliderMax} step={1}
                  value={Math.min(t.sunsetMonths, sliderMax)}
                  onChange={(e) => onUpdateItem(t.id, { sunsetMonths: Number(e.target.value) })}
                  className="absolute top-1/2 -translate-y-1/2 h-[22px] m-0 opacity-0 cursor-pointer"
                  style={{ left: `${xPct(0, horizon)}%`, width: `${xPct(sliderMax, horizon) - xPct(0, horizon)}%` }}
                  aria-label={`When ${t.name} sunsets`}
                  data-testid={`ar-timing-slider-${t.id}`}
                />
              </div>

              <div className="text-[10px] font-bold text-[#EA2C00] mt-4 min-h-[12px]">
                {t.earlyMonths > 0 ? `Exit ${t.earlyMonths} mo early · ${fmtM(t.earlySaving)} sooner` : ""}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference){
          .ar-plan{ stroke-dasharray: 2400; stroke-dashoffset: 2400; animation: arPlanDraw 1s ease-out forwards; }
          @keyframes arPlanDraw{ to{ stroke-dashoffset: 0; } }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit -p tsconfig.json`. The new file must add no errors (remaining errors are only the Task 1 leftovers in Flow/RolloutBeat/PDF).

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(app-rat): ConsolidationTiming cumulative-savings view (curve + per-tool timelines)"`

---

### Task 4: Flow rewire — the toggle, mount both views, retire the rollout beat

**Files:**
- Modify: `client/src/pages/forecast/AppRationalizationFlow.tsx`
- Delete: `client/src/components/forecast/RolloutBeat.tsx`

**Interfaces:**
- Consumes: `ConsolidationWaterfall` (unchanged), `ConsolidationTiming` (Task 3, props `{ items, horizonYears, onHorizonChange, onUpdateItem }`).

- [ ] **Step 1: Rewire `AppRationalizationFlow.tsx`.** Replace the `RolloutBeat` import (line 7) with `import ConsolidationTiming from "@/components/forecast/ConsolidationTiming";`. Add a view-toggle state near the other state (line 33 area): `const [conView, setConView] = useState<"waterfall" | "timing">("waterfall");`. Replace the chart block (current lines 125-128, the `<ConsolidationWaterfall .../>` + `<RolloutBeat .../>`) with:

```tsx
            {/* Toggle: what (waterfall, default) vs when (cumulative savings) */}
            <div className="flex justify-center mb-5">
              <div className="relative inline-flex bg-[#EFE7DC] rounded-[10px] p-[3px]" data-testid="ar-view-toggle">
                <span
                  className="absolute top-[3px] bottom-[3px] rounded-lg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.10)] transition-[left] duration-200 ease-out"
                  style={{ left: conView === "waterfall" ? "3px" : "50%", right: conView === "waterfall" ? "50%" : "3px" }}
                />
                {([["waterfall", "The consolidation"], ["timing", "Cumulative savings"]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setConView(v)}
                    className={`relative z-10 px-4 py-2 text-[12px] font-bold rounded-lg transition-colors ${conView === v ? "text-[#EA2C00]" : "text-[#8C7E6E]"}`}
                    data-testid={`ar-view-${v}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {conView === "waterfall"
              ? <ConsolidationWaterfall items={items} />
              : <ConsolidationTiming items={items} horizonYears={termYears} onHorizonChange={setTermYears} onUpdateItem={updateItem} />}
```

  The toggle thumb uses `left`/`right` percentages; verify it slides cleanly (each button ~50%). Keep the header, Export PDF, net hero, and the "Why · Coming soon" block untouched.

- [ ] **Step 2: Delete `RolloutBeat.tsx`** — `git rm client/src/components/forecast/RolloutBeat.tsx` (or delete the file).

- [ ] **Step 3: Verify** — `npx tsc --noEmit -p tsconfig.json` should now report errors ONLY in `AppRationalizationPDFExport.tsx` (Task 5). `npx vitest run` green.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(app-rat): consolidation view toggle (waterfall default | cumulative savings); retire rollout beat"`

---

### Task 5: PDF — cumulative-savings section + sunset-date timeline column

**Files:**
- Modify: `client/src/components/forecast/AppRationalizationPDFExport.tsx`
- Modify: `client/src/__tests__/appRationalizationPdfSmoke.test.tsx`

**Interfaces:**
- Consumes: `buildCumulativeSavings`, `cumulativeSavedAt`, `sunsetDateLabel` (Task 1). No `buildRollout`/`AR_WHEN_OPTIONS`.

- [ ] **Step 1: Swap imports.** In `AppRationalizationPDFExport.tsx` change the calc import (lines 10-13) to:

```ts
import {
  buildStackBars, computeNet, buildCumulativeSavings, cumulativeSavedAt, sunsetDateLabel,
  itemDisplayName, categoryLabel, itemRetired, type AppRatItem,
} from "@/lib/appRationalizationCalc";
```

  Delete the `WHEN_LABEL` line (line 24) and the `AR_WHEN_OPTIONS` reference.

- [ ] **Step 2: Replace the `Rollout` component** (lines 152-222, the `Part`/`Para`/`Rollout` block) with a static cumulative-savings section using `@react-pdf` `Svg`/`Path`/`Polyline`. Use a small plot with the plan and "if you moved now" lines and the two endpoint figures. Add `Path` to the `@react-pdf/renderer` import (line 5). Add styles to `s` for the section (reuse `s.roll`/`s.rollEyebrow` pattern). Example:

```tsx
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, Path, Font, pdf } from "@react-pdf/renderer";

// ...in styles s: reuse the existing roll/eyebrow spacing
//   coiWrap: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: C.mid },
//   coiEyebrow: { fontSize: 8, fontWeight: 700, color: C.t3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 },
//   coiEnd: { fontSize: 8.5, fontWeight: 700 },

function CumulativeSavings({ items, termYears }: { items: AppRatItem[]; termYears: number }) {
  const horizon = termYears * 12;
  const cs = buildCumulativeSavings(items, horizon);
  if (!cs.hasCurve) return null;
  const W = 516, H = 128, TOP = 10, BASE = 104, LEFT = 6, RIGHT = 430; // gutter for labels
  const maxY = Math.max(1, cs.nowTotal) * 1.06;
  const X = (m: number) => LEFT + (m / horizon) * (RIGHT - LEFT);
  const Y = (v: number) => BASE - (v / maxY) * (BASE - TOP);
  const d = (mode: "plan" | "now") => {
    let p = "";
    for (let m = 0; m <= horizon; m++) p += `${m ? "L" : "M"} ${X(m).toFixed(1)} ${Y(cumulativeSavedAt(cs.tools, m, mode)).toFixed(1)} `;
    return p.trim();
  };
  return (
    <View style={s.coiWrap}>
      <Text style={s.coiEyebrow}>Cumulative savings, over time</Text>
      <View style={{ flexDirection: "row" }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Line x1={LEFT} y1={BASE} x2={RIGHT + 80} y2={BASE} stroke={C.hair} strokeWidth={1} />
          <Path d={`${d("plan")} L ${X(horizon).toFixed(1)} ${BASE} L ${X(0)} ${BASE} Z`} fill="rgba(234,44,0,0.08)" />
          <Path d={d("now")} stroke={C.stays} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
          <Path d={d("plan")} stroke={C.coral} strokeWidth={2} fill="none" />
        </Svg>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "flex-start", gap: 24, marginTop: 6 }}>
        <Text style={[s.coiEnd, { color: C.t3 }]}>{`If you moved now  ${short(cs.nowTotal)}`}</Text>
        <Text style={[s.coiEnd, { color: C.coral }]}>{`Your plan  ${short(cs.planTotal)} captured over ${termYears} yrs`}</Text>
      </View>
    </View>
  );
}
```

  Place `<CumulativeSavings items={items} termYears={termYears} />` in `ContentPage` where `<Rollout .../>` was (line 246).

- [ ] **Step 3: Stack table timeline column → sunset date.** In `ContentPage`'s row map (line 265), replace the `when` cell content with the sunset date:

```tsx
          <Text style={[s.tWhen, { width: COL.time, paddingLeft: 18 }]}>{sunsetDateLabel(it.sunsetMonths)}</Text>
```

- [ ] **Step 4: Update the smoke test.** In `appRationalizationPdfSmoke.test.tsx`: drop `type AppRatWhen` from the import; change the `tool(...)` helper (lines 23-24) to take `contractMonths`/`sunsetMonths` instead of `when`. Replace the "does not render the rollout when nothing sunsets" case with "does not render the cumulative section when nothing sunsets" (all `coveragePct: 0`, assert the tree renders without the section). Keep the recurse-and-assert-copy approach; assert "Cumulative savings" text appears when tools sunset.

- [ ] **Step 5: Full verify** — `npx tsc --noEmit -p tsconfig.json` → 0 errors. `npx vitest run` → green. `npm run build` → succeeds.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(app-rat): PDF cumulative-savings section + sunset-date timeline column"`

---

## Self-Review notes

- **Spec coverage:** data model (T1), calc (T1), Applications strip (T2), timing view (T3), toggle + retire beat (T4), PDF both-views (T5) — all covered.
- **Type consistency:** `ConsolidationTiming` prop is `horizonYears` + `onHorizonChange` (flow passes `termYears`/`setTermYears`); calc uses `horizonMonths` internally. `buildCumulativeSavings(items, horizonMonths)` everywhere. `sunsetDateLabel(months, from?)`.
- **Green-at-each-step caveat:** Tasks 1-3 leave tsc errors in not-yet-touched files (Flow/RolloutBeat/PDF). The vitest SUITE stays green throughout; tsc reaches 0 only after Task 5. Each task's commit is still independently reviewable. Reviewers: treat known cross-file tsc errors named in a task's Verify step as expected, not defects.
- **Geometry:** one `xPct(month, horizon)` in `ConsolidationTiming` drives curve overlays and all timeline tracks (shared axis). Positions clamp to `[0, horizon]`; slider max = `min(contractMonths, horizon)`.
