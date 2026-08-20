# App Rationalization "Applications" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the App Rationalization "Applications" experience into one continuous, on-brand surface (inline editable rows), remove the Setup page, and reframe the per-app lever from "Abridge covers" to the customer's own "How much could you displace? / When (contract years)."

**Architecture:** The timing model moves from an absolute `renewal` string to a contract-year `when` bucket that maps straight onto the roadmap's year axis. The flow drops from four steps to three (Applications → Consolidation → The change); org name is captured in the Applications header and contract term inline on "The change." The Applications screen becomes a hero command search feeding inline `ArStackRow` rows plus a slim total bar (replacing the black panel). Migration is expand-then-contract: `when` is added alongside the legacy `renewal`/`transitionMonths` fields, every consumer is migrated, then the dead fields are removed in a final task so the typecheck never breaks mid-plan.

**Tech Stack:** React + TypeScript (strict), Vite, Tailwind, framer-motion, lucide-react, Radix Slider, vitest.

## Global Constraints

- No em dashes anywhere in copy or comments; use "·", ":", or a period.
- User-facing lever copy says **"displace,"** never "coverage" or "Abridge covers." The internal field stays named `coveragePct`.
- Titles use the Abridge display font (`.font-abridge`, uppercase); UI is Manrope; coral `#EA2C00` + warm neutrals only; no stoplight colors, no status pills.
- Animations gated behind `@media (prefers-reduced-motion: no-preference)`, with the reduced-motion state being the final settled view.
- The Consolidation two-sink visual and the RoadmapChart visual language do not change; only their inputs change where noted.
- TypeScript strict: every `Record<AppRatWhen, …>` stays exhaustive over `thisYear | nextYear | year3 | notSure`.
- Verify every task with `npx tsc --noEmit -p tsconfig.json` (0 errors) and `npx vitest run` (all green). Run `npm run build` for UI tasks. This environment cannot render the app; visuals are verified by the user on Replit.
- "When" → contract-year mapping: `thisYear→1`, `nextYear→2`, `year3→3`, `notSure→termYears`; result clamped to `[1, termYears]`.

---

### Task 1: When-based timing model (calc + roadmap + tests)

Replace the absolute `renewal` logic with the contract-year `when` bucket across the pure model and its tests. `renewal?` and `transitionMonths` are made optional and kept for now (so the still-present `ArStackCard` keeps compiling); they are removed in Task 4.

**Files:**
- Modify: `client/src/lib/appRationalizationCalc.ts`
- Modify: `client/src/lib/appRationalizationRoadmap.ts`
- Test: `client/src/__tests__/appRationalizationCalc.test.ts` (rewrite helper + one assertion)
- Test: `client/src/__tests__/appRationalizationRetirementYear.test.ts` (rewrite, when-based)
- Test: `client/src/__tests__/appRationalizationRoadmap.test.ts` (rewrite, when-based)

**Interfaces:**
- Produces: `type AppRatWhen = "thisYear" | "nextYear" | "year3" | "notSure"`; `AR_WHEN_OPTIONS: { value: AppRatWhen; label: string }[]`; `AppRatItem.when?: AppRatWhen`; `retirementYear(item: AppRatItem, termYears: number): number`; `computeRoadmap(items: AppRatItem[], termYears: number): Roadmap`.

- [ ] **Step 1: Rewrite the retirement-year test (when-based)**

Replace the entire contents of `client/src/__tests__/appRationalizationRetirementYear.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { retirementYear, type AppRatItem, type AppRatWhen } from "@/lib/appRationalizationCalc";

const item = (when: AppRatWhen): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 1_000_000, coveragePct: 80, when,
});

describe("retirementYear (when -> contract year)", () => {
  const ry = (when: AppRatWhen, term = 3) => retirementYear(item(when), term);
  it("thisYear -> year 1", () => expect(ry("thisYear")).toBe(1));
  it("nextYear -> year 2", () => expect(ry("nextYear")).toBe(2));
  it("year3 -> year 3", () => expect(ry("year3")).toBe(3));
  it("notSure -> the last year of the term", () => expect(ry("notSure")).toBe(3));
  it("notSure respects a shorter term", () => expect(ry("notSure", 2)).toBe(2));
  it("year3 clamps down when the term is shorter", () => expect(ry("year3", 2)).toBe(2));
  it("nextYear clamps down to a 1-year term", () => expect(ry("nextYear", 1)).toBe(1));
  it("term is floored at 1", () => expect(retirementYear(item("year3"), 0)).toBe(1));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/appRationalizationRetirementYear.test.ts`
Expected: FAIL (type `AppRatWhen` not exported / `retirementYear` still renewal-based).

- [ ] **Step 3: Add the `when` type, options, field, and rewrite `retirementYear` in calc.ts**

In `client/src/lib/appRationalizationCalc.ts`:

Add these exports immediately after the `export type AppRatCategoryId = AppRatIconKey;` line:

```ts
export type AppRatWhen = "thisYear" | "nextYear" | "year3" | "notSure";

export const AR_WHEN_OPTIONS: { value: AppRatWhen; label: string }[] = [
  { value: "thisYear", label: "This year" },
  { value: "nextYear", label: "Next year" },
  { value: "year3",    label: "Year 3" },
  { value: "notSure",  label: "Not sure" },
];
```

In `interface AppRatItem`, make the legacy timing fields optional and add `when`. Replace these three lines:

```ts
  renewal?: string;         // "Open term" | "2026" | "Mid 2027" | "Unknown"; drives the roadmap later
  transitionMonths: number; // ramp, reused by later phases
```

with:

```ts
  when?: AppRatWhen;        // contract-year bucket for when the displacement lands
  renewal?: string;         // legacy, removed once the UI migration lands
  transitionMonths?: number;// legacy, removed once the UI migration lands
```

Replace `makeItem` with (drops `transitionMonths`, adds `when`):

```ts
export function makeItem(id: string, category: AppRatCategoryId): AppRatItem {
  return { id, category, annualSpend: 0, coveragePct: 80, when: "thisYear" };
}
```

Replace the entire `retirementYear` block (the doc comment plus the function, from `/**` through the closing `}`) with:

```ts
const WHEN_TO_YEAR: Record<AppRatWhen, (term: number) => number> = {
  thisYear: () => 1,
  nextYear: () => 2,
  year3:    () => 3,
  notSure:  (term) => term,
};

/**
 * The contract year (1..termYears) in which a tool's displacement lands, from
 * its "when" bucket. "Not sure" holds to the last year (conservative). The
 * result is clamped to [1, termYears].
 */
export function retirementYear(item: AppRatItem, termYears: number): number {
  const term = Math.max(1, Math.floor(termYears));
  const raw = WHEN_TO_YEAR[item.when ?? "notSure"](term);
  return Math.min(term, Math.max(1, raw));
}
```

- [ ] **Step 4: Run the retirement-year test to verify it passes**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/appRationalizationRetirementYear.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Update the roadmap to the 2-arg signature and reword the read**

In `client/src/lib/appRationalizationRoadmap.ts`:

Change the signature line:

```ts
export function computeRoadmap(items: AppRatItem[], termYears: number, currentYear?: number): Roadmap {
```

to:

```ts
export function computeRoadmap(items: AppRatItem[], termYears: number): Roadmap {
```

Change the enriched `ry` line from `ry: retirementYear(r, term, currentYear),` to:

```ts
    ry: retirementYear(r, term),
```

Replace the "Nothing retires" read line:

```ts
    read = "Nothing retires at the current coverage. Raise coverage on a tool to see it come off the stack.";
```

with:

```ts
    read = "Nothing moves at the current share. Raise how much you could displace on a tool to see it come off the stack.";
```

Replace the gated read expression:

```ts
    read = `Most of the retirement lands in Year ${maxYear}.` +
      (gated
        ? " The rest is renewal-gated, so it holds until those contracts turn over."
        : " It can all move now.");
```

with:

```ts
    read = `Most of the retirement lands in Year ${maxYear}.` +
      (gated
        ? " The rest is scheduled for later years."
        : " It can all move now.");
```

- [ ] **Step 6: Rewrite the roadmap test (when-based)**

Replace the entire contents of `client/src/__tests__/appRationalizationRoadmap.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { computeRoadmap } from "@/lib/appRationalizationRoadmap";
import { type AppRatItem } from "@/lib/appRationalizationCalc";

const mk = (o: Partial<AppRatItem>): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 0, coveragePct: 80, when: "thisYear", ...o,
});

// when -> year (term 3): thisYear->Y1, nextYear->Y2, year3->Y3, notSure->Y3
const stack: AppRatItem[] = [
  mk({ id: "flu", vendorName: "Fluency",    annualSpend: 1_800_000, coveragePct: 80,  when: "nextYear" }),
  mk({ id: "utd", vendorName: "UpToDate",   annualSpend: 1_000_000, coveragePct: 90,  when: "thisYear" }),
  mk({ id: "amb", vendorName: "Ambient AI", annualSpend:   700_000, coveragePct: 100, when: "thisYear" }),
  mk({ id: "iod", vendorName: "Iodine",     annualSpend:   600_000, coveragePct: 75,  when: "year3" }),
  mk({ id: "sta", vendorName: "Stanson",    annualSpend:   500_000, coveragePct: 70,  when: "year3" }),
];

describe("computeRoadmap (term 3, when-based)", () => {
  const rm = computeRoadmap(stack, 3);

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
  it("the read names the year with the largest delta and notes later scheduling", () => {
    expect(rm.read).toContain("Year 1");
    expect(rm.read.toLowerCase()).toContain("later");
  });
  it("filters zero-spend items and is empty-safe", () => {
    const rm0 = computeRoadmap([mk({ id: "z", annualSpend: 0 })], 3);
    expect(rm0.snapshots[0].perTool).toHaveLength(0);
    expect(rm0.totalRetired).toBe(0);
    expect(rm0.deltas.every((d) => d.amount === 0)).toBe(true);
  });
  it("reads clearly when nothing retires", () => {
    const rmNone = computeRoadmap([mk({ id: "n", annualSpend: 500_000, coveragePct: 0, when: "thisYear" })], 3);
    expect(rmNone.totalRetired).toBe(0);
    expect(rmNone.read.toLowerCase()).toContain("nothing");
  });
});
```

- [ ] **Step 7: Update the calc test helper and makeItem assertion**

In `client/src/__tests__/appRationalizationCalc.test.ts`:

Replace the `item` helper:

```ts
const item = (over: Partial<AppRatItem> = {}): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 1_800_000, coveragePct: 80, transitionMonths: 12, ...over,
});
```

with:

```ts
const item = (over: Partial<AppRatItem> = {}): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 1_800_000, coveragePct: 80, when: "thisYear", ...over,
});
```

Replace the makeItem test:

```ts
  it("makeItem defaults to 80% coverage and the given category", () => {
    const m = makeItem("id1", "cds");
    expect(m).toMatchObject({ id: "id1", category: "cds", coveragePct: 80, annualSpend: 0, transitionMonths: 12 });
  });
```

with:

```ts
  it("makeItem defaults to an 80% displace share, This year, and the given category", () => {
    const m = makeItem("id1", "cds");
    expect(m).toMatchObject({ id: "id1", category: "cds", coveragePct: 80, annualSpend: 0, when: "thisYear" });
  });
```

- [ ] **Step 8: Run the full model test suite + typecheck**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/appRationalizationCalc.test.ts client/src/__tests__/appRationalizationRetirementYear.test.ts client/src/__tests__/appRationalizationRoadmap.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: all three test files PASS; tsc 0 errors (the still-present `ArStackCard` keeps compiling because `renewal?` is retained).

- [ ] **Step 9: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/lib/appRationalizationCalc.ts client/src/lib/appRationalizationRoadmap.ts client/src/__tests__/appRationalizationCalc.test.ts client/src/__tests__/appRationalizationRetirementYear.test.ts client/src/__tests__/appRationalizationRoadmap.test.ts
git commit -m "feat: contract-year 'when' timing model for app rationalization"
```

---

### Task 2: `ArStackRow` inline editable row

A new, self-contained component: one editable stack row (icon + vendor + category, annual spend, displace slider, "Over" select, displaceable result, remove). Not wired in yet.

**Files:**
- Create: `client/src/pages/forecast/appRationalization/ArStackRow.tsx`

**Interfaces:**
- Consumes: `AppRatItem`, `AppRatWhen`, `AR_WHEN_OPTIONS`, `itemRetired`, `itemStays`, `APP_RAT_CATEGORIES`, `KNOWN_VENDORS` from `@/lib/appRationalizationCalc`; `Slider` from `@/components/ui/slider`; `NumberField` from `@/components/NumberField`; `CategoryIcon` from `./CategoryIcon`.
- Produces: `export default function ArStackRow({ item, onChange, onRemove })` where `onChange: (patch: Partial<AppRatItem>) => void`, `onRemove: () => void`.

- [ ] **Step 1: Create the component**

Create `client/src/pages/forecast/appRationalization/ArStackRow.tsx` with:

```tsx
import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { NumberField } from "@/components/NumberField";
import { CategoryIcon } from "./CategoryIcon";
import {
  itemRetired, itemStays, APP_RAT_CATEGORIES, KNOWN_VENDORS, AR_WHEN_OPTIONS,
  type AppRatItem, type AppRatWhen,
} from "@/lib/appRationalizationCalc";

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export default function ArStackRow({
  item, onChange, onRemove,
}: { item: AppRatItem; onChange: (patch: Partial<AppRatItem>) => void; onRemove: () => void }) {
  const cat = useMemo(() => APP_RAT_CATEGORIES.find((c) => c.id === item.category)!, [item.category]);
  const vendorSuggestions = useMemo(
    () => KNOWN_VENDORS.filter((v) => v.category === item.category).map((v) => v.name),
    [item.category],
  );
  const retired = itemRetired(item);
  const stays = itemStays(item);

  return (
    <div
      className="ar-row grid grid-cols-1 md:grid-cols-[1fr_120px_190px_150px_120px] gap-3.5 items-center bg-white border border-[#E8E2DA] rounded-2xl px-4 py-3.5 mb-2.5"
      data-testid={`ar-row-${item.id}`}
    >
      {/* Application: icon + editable vendor name + category */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-[38px] h-[38px] rounded-[11px] bg-[#F5F0EB] flex items-center justify-center text-[#6B5E4F] flex-shrink-0">
          <CategoryIcon icon={cat.icon} className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            list={`ar-vend-${item.id}`}
            value={item.vendorName ?? ""}
            onChange={(e) => onChange({ vendorName: e.target.value })}
            placeholder={cat.label}
            aria-label="Vendor"
            className="w-full bg-transparent text-[14px] font-bold text-[#1A1A1A] outline-none placeholder-[#1A1A1A] truncate"
            data-testid={`ar-row-vendor-${item.id}`}
          />
          <datalist id={`ar-vend-${item.id}`}>{vendorSuggestions.map((n) => <option key={n} value={n} />)}</datalist>
          <div className="text-[11.5px] text-[#8C7E6E] truncate">{cat.label}</div>
        </div>
      </div>

      {/* Annual spend */}
      <div className="flex items-center h-10 bg-white border border-[#E8E2DA] rounded-[10px] px-3 gap-1 focus-within:border-[#EA2C00]">
        <span className="text-[#8C7E6E] text-sm">$</span>
        <NumberField
          value={item.annualSpend}
          onValueChange={(v) => onChange({ annualSpend: v })}
          min={0}
          className="flex-1 min-w-0 bg-transparent text-sm text-[#1A1A1A] outline-none tabular-nums"
          data-testid={`ar-row-spend-${item.id}`}
        />
      </div>

      {/* How much could you displace */}
      <div className="flex items-center gap-2.5">
        <Slider
          min={0} max={100} step={5}
          value={[item.coveragePct]}
          onValueChange={(vals) => onChange({ coveragePct: vals[0] })}
          accent="coral"
          aria-label="How much could you displace"
          data-testid={`ar-row-displace-${item.id}`}
        />
        <span className="text-[13px] font-extrabold text-[#EA2C00] tabular-nums w-9 text-right">{item.coveragePct}%</span>
      </div>

      {/* Over (when) */}
      <select
        value={item.when ?? "thisYear"}
        onChange={(e) => onChange({ when: e.target.value as AppRatWhen })}
        aria-label="Over what time period"
        className="h-10 bg-white border border-[#E8E2DA] rounded-[10px] px-3 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#EA2C00]"
        data-testid={`ar-row-when-${item.id}`}
      >
        {AR_WHEN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Displaceable result + remove */}
      <div className="flex items-center justify-end gap-2.5">
        <div className="text-right tabular-nums">
          <div className="text-[13.5px] font-bold text-[#1A1A1A]">{fmtM(retired)}</div>
          <div className="text-[11px] text-[#8C7E6E]">{fmtM(stays)} stays</div>
        </div>
        <button
          onClick={onRemove}
          className="text-[#C4B8A8] hover:text-[#1A1A1A] text-lg leading-none"
          aria-label="Remove"
          data-testid={`ar-row-remove-${item.id}`}
        >
          ×
        </button>
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference){
          .ar-row{animation:arRowIn .55s ease-out}
        }
        @keyframes arRowIn{
          from{box-shadow:0 0 0 3px rgba(234,44,0,.28)}
          to{box-shadow:0 0 0 0 rgba(234,44,0,0)}
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: tsc 0 errors; build succeeds (the new component is not imported yet, which is fine).

- [ ] **Step 3: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/pages/forecast/appRationalization/ArStackRow.tsx
git commit -m "feat: ArStackRow inline editable stack row"
```

---

### Task 3: Flow restructure + Applications rewrite + term control

Remove Setup, rewrite the Applications screen (Direction A), add the inline term control on "The change," and delete the two obsolete components. This is one integration task so the build stays green (these files reference each other).

**Files:**
- Modify: `client/src/pages/forecast/AppRationalizationFlow.tsx`
- Modify (full rewrite): `client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx`
- Delete: `client/src/pages/forecast/appRationalization/ArSetupStep.tsx`
- Delete: `client/src/pages/forecast/appRationalization/ArStackCard.tsx`

**Interfaces:**
- Consumes: `ArStackRow` (Task 2); `AR_WHEN_OPTIONS`/`when` model (Task 1); `ArCommandSearch`, `ConsolidationFlow`, `RoadmapChart`, `AnimatedValue`, `UnifiedHeader`, `computeTotals`, `makeItem` (all existing).
- Produces: `ArApplicationsStep` props `{ items, orgName, onOrgNameChange, onAdd, onUpdate, onRemove, onContinue }`.

- [ ] **Step 1: Rewrite the Applications step**

Replace the entire contents of `client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx` with:

```tsx
import { useMemo } from "react";
import ArCommandSearch from "./ArCommandSearch";
import ArStackRow from "./ArStackRow";
import { computeTotals, type AppRatItem, type AppRatCategoryId } from "@/lib/appRationalizationCalc";

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

const COL_HEADERS = ["Application", "Annual spend", "How much could you displace?", "Over", "Displaceable"];

export default function ArApplicationsStep({
  items, orgName, onOrgNameChange, onAdd, onUpdate, onRemove, onContinue,
}: {
  items: AppRatItem[];
  orgName: string;
  onOrgNameChange: (v: string) => void;
  onAdd: (category: AppRatCategoryId, vendorName?: string) => void;
  onUpdate: (id: string, patch: Partial<AppRatItem>) => void;
  onRemove: (id: string) => void;
  onContinue: () => void;
}) {
  const totals = useMemo(() => computeTotals(items), [items]);

  return (
    <div className="max-w-[1120px] mx-auto px-6 py-8">
      {/* Header: title + org field */}
      <div className="flex items-start justify-between gap-6 mb-2">
        <div>
          <h1 className="font-abridge text-4xl uppercase tracking-tight text-[#1A1A1A]">Applications</h1>
          <p className="text-sm text-[#6B6B6B] mt-2.5">Browse the capabilities, or type a vendor and we place it for you.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <label htmlFor="ar-org" className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8C7E6E]">Organization</label>
          <input
            id="ar-org"
            value={orgName}
            onChange={(e) => onOrgNameChange(e.target.value)}
            placeholder="Organization name"
            className="w-[200px] h-9 bg-white border border-[#E8E2DA] rounded-[9px] px-3 text-[13px] text-[#1A1A1A] text-right outline-none focus:border-[#1A1A1A] placeholder-[#B4A99B]"
            data-testid="ar-org-name"
          />
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

          {/* Slim total bar (replaces the black panel) */}
          <div className="flex flex-wrap items-center gap-4 mt-4 px-5 py-4 bg-[#FAF8F5] border border-[#E8E2DA] rounded-2xl">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8C7E6E]">Stack today</div>
              <div className="text-[19px] font-extrabold text-[#1A1A1A] tabular-nums">
                {fmtM(totals.stackTotal)} <span className="text-[12px] font-medium text-[#8C7E6E]">/ yr</span>
              </div>
            </div>
            <div className="h-2 rounded-md overflow-hidden flex" style={{ width: 170 }}>
              <div style={{ width: `${totals.pctToAbridge}%`, background: "#EA2C00" }} />
              <div style={{ width: `${100 - totals.pctToAbridge}%`, background: "#D8CEC1" }} />
            </div>
            <div className="text-[12.5px] text-[#6B6B6B] tabular-nums">
              <b className="text-[#1A1A1A]">{fmtM(totals.toAbridge)}</b> displaceable · {fmtM(totals.stays)} stays
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

- [ ] **Step 2: Rewrite the flow (3 steps, org header, term control)**

Replace the entire contents of `client/src/pages/forecast/AppRationalizationFlow.tsx` with:

```tsx
import { useRef, useState } from "react";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { type AppRatItem, type AppRatCategoryId, makeItem, computeTotals } from "@/lib/appRationalizationCalc";
import ArApplicationsStep from "./appRationalization/ArApplicationsStep";
import ConsolidationFlow from "@/components/forecast/ConsolidationFlow";
import { AnimatedValue } from "@/components/explore/AnimatedValue";
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
  const [termYears, setTermYears] = useState(3);
  const [items, setItems] = useState<AppRatItem[]>([]);
  const nextId = useRef(0);

  const addItem = (category: AppRatCategoryId, vendorName?: string) =>
    setItems((prev) => [...prev, { ...makeItem(`ar-${nextId.current++}`, category), vendorName }]);
  const updateItem = (id: string, patch: Partial<AppRatItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const fmtM = (n: number): string => {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${Math.round(n)}`;
  };

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
            onAdd={addItem}
            onUpdate={updateItem}
            onRemove={removeItem}
            onContinue={() => setStep("consolidation")}
          />
        )}

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
          );
        })()}

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
            <RoadmapChart items={items} termYears={termYears} />
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

- [ ] **Step 3: Delete the obsolete components**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git rm client/src/pages/forecast/appRationalization/ArSetupStep.tsx client/src/pages/forecast/appRationalization/ArStackCard.tsx
```

- [ ] **Step 4: Typecheck, test, build**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json && npx vitest run && npm run build`
Expected: tsc 0 errors; all tests green; build succeeds. (No file imports `ArSetupStep` or `ArStackCard` anymore.)

- [ ] **Step 5: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/pages/forecast/AppRationalizationFlow.tsx client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx
git commit -m "feat: three-step app rationalization flow with inline Applications and term control"
```

---

### Task 4: Contract cleanup (remove legacy timing fields)

Now that no consumer uses `renewal` or `transitionMonths`, remove them and make `when` required.

**Files:**
- Modify: `client/src/lib/appRationalizationCalc.ts`

**Interfaces:**
- Produces: `AppRatItem.when: AppRatWhen` (required); `renewal` and `transitionMonths` removed.

- [ ] **Step 1: Confirm nothing references the legacy fields**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && grep -rn "renewal\|transitionMonths" client/src`
Expected: only the three declaration lines inside `appRationalizationCalc.ts` (the `when?`/`renewal?`/`transitionMonths?` interface lines). No usages in any `.tsx` or test file. If any usage remains, stop and remove it before continuing.

- [ ] **Step 2: Remove the legacy fields and make `when` required**

In `client/src/lib/appRationalizationCalc.ts`, replace these three interface lines:

```ts
  when?: AppRatWhen;        // contract-year bucket for when the displacement lands
  renewal?: string;         // legacy, removed once the UI migration lands
  transitionMonths?: number;// legacy, removed once the UI migration lands
```

with:

```ts
  when: AppRatWhen;         // contract-year bucket for when the displacement lands
```

- [ ] **Step 3: Typecheck, test, build**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json && npx vitest run && npm run build`
Expected: tsc 0 errors (all item literals in code and tests already supply `when` via `makeItem` or their helpers); all tests green; build succeeds.

- [ ] **Step 4: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/lib/appRationalizationCalc.ts
git commit -m "refactor: drop legacy renewal/transitionMonths, require when on AppRatItem"
```

---

## Self-Review

**1. Spec coverage:**
- Setup removed; org name in Applications header; term on The change → Task 3. ✓
- Direction A inline rows, hero search, click-feedback glow, slim total bar, empty state → Tasks 2 + 3. ✓
- Two levers: "How much could you displace? %" + "When" (This year/Next year/Year 3/Not sure); drop renewal dates → Tasks 1 (model) + 2 (UI). ✓
- Data model: `when` bucket, `retirementYear(item, termYears)` when-based, `computeRoadmap(items, termYears)`, `coveragePct` kept internal → Task 1; legacy fields removed → Task 4. ✓
- Consolidation unchanged (keeps "to Abridge") → Task 3 leaves it intact. ✓
- Term control 2–5 years, default 3 → Task 3. ✓
- Drop "Covered by (Abridge)" field → not present in `ArStackRow` (Task 2). ✓
- Delete `ArSetupStep` + `ArStackCard` → Task 3. ✓
- Tests updated (calc, retirementYear, roadmap) → Task 1. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; the grep in Task 4 Step 1 is a real verification, not a placeholder. ✓

**3. Type consistency:** `AppRatWhen` union identical everywhere; `AR_WHEN_OPTIONS` values match the union; `retirementYear(item, termYears)` and `computeRoadmap(items, termYears)` are 2-arg in both definition (Task 1) and callers (`RoadmapChart` already 2-arg; roadmap test rewritten 2-arg); `ArApplicationsStep` prop names (`orgName`, `onOrgNameChange`, `onAdd`, `onUpdate`, `onRemove`, `onContinue`) match the flow's usage in Task 3; grid template `[1fr_120px_190px_150px_120px]` matches between the column-header row and `ArStackRow`. ✓

**4. Copy check:** No em dashes; the row/total/roadmap copy uses "displace" not "coverage"; titles use `.font-abridge`; coral + warm neutrals only. ✓

**5. Green-per-task check:** Task 1 keeps `renewal?`/`transitionMonths?` optional so `ArStackCard` still compiles; Task 3 deletes `ArStackCard` before Task 4 removes the fields; every task ends on tsc 0 + tests green. ✓
