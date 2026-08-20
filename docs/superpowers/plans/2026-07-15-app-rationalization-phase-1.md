# App Rationalization — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the entry half of App Rationalization (the 4th Forecast option): the shared calc module, the flow shell + chrome, the Setup step, and the locked Applications step (command search + stack cards + live sidebar), reachable from the Forecast mode selector.

**Architecture:** A new guided flow page (`AppRationalizationFlow.tsx`) following the Explore/MeasureForecast conventions, driven by a small pure calc module (`appRationalizationCalc.ts`) that owns the category taxonomy, the per-item retired/stays math, and the totals. Phase 1 covers Setup + Applications; the "See the consolidation" button lands on a stub that Phase 2 replaces.

**Tech Stack:** React + TypeScript, Vite, Tailwind, Radix UI (shared `Slider`), lucide-react icons, vitest for unit tests. Reuses `UnifiedHeader`, `NumberField`, `AnimatedValue`, and the coral `Slider`.

## Global Constraints

- Copy: **no em dashes**; **no corporate jargon** (leverage, enable, empower, facilitate, utilize, unlock, seamless, robust, solutions, drive-as-verb); defensible voice only ("candidates to retire", "what Abridge can take on", "opportunity to consolidate"); never assert Abridge replaced/eliminated a named competitor.
- Visual: coral `#EA2C00` + warm neutrals (`#FAF8F5` bg, white cards, `#E8E2DA` borders, `#8C7E6E` muted); **no stoplight colors** (no green/amber/orange); **no status pills** on cards; urgency/timing lives in the `Renews` field and (later) the roadmap.
- Type: the Abridge display font renders via `UnifiedHeader` and the `.font-abridge` class for step titles; Manrope (`--font-sans`) for all UI; tabular numerals on figures.
- Reuse shared components: `UnifiedHeader`, `NumberField`, the Radix `Slider` with `accent="coral"`, `AnimatedValue`, lucide-react icons.
- Do NOT modify Compare Pricing behavior or `DISPLACEMENT_CATEGORIES` (App Rationalization owns its own taxonomy to avoid changing that picker; it reuses the displacement *math* pattern).
- Verify every task with `npx tsc --noEmit -p tsconfig.json` (0 errors) and `npx vitest run` (all green). UI tasks additionally verify with `npm run build`. Pixel/visual review is done by the user on Replit (this environment cannot render the app).

---

### Task 1: Calc module + tests

**Files:**
- Create: `client/src/lib/appRationalizationCalc.ts`
- Test: `client/src/__tests__/appRationalizationCalc.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AppRatCategoryId` (union) and `interface AppRatCategory { id: AppRatCategoryId; label: string; hint: string; icon: AppRatIconKey }`
  - `type AppRatIconKey = "ambientDoc"|"scribe"|"dictation"|"transcription"|"cds"|"preChartRisk"|"inEncounterCdi"|"postChartCoding"|"clinicalEvidence"|"custom"`
  - `const APP_RAT_CATEGORIES: AppRatCategory[]`
  - `interface KnownVendor { name: string; category: AppRatCategoryId }` and `const KNOWN_VENDORS: KnownVendor[]`
  - `interface AppRatItem { id: string; category: AppRatCategoryId; vendorName?: string; annualSpend: number; coveragePct: number; abridgeProduct?: string; renewal?: string; transitionMonths: number }`
  - `function categoryLabel(id: AppRatCategoryId): string`
  - `function makeItem(id: string, category: AppRatCategoryId): AppRatItem`
  - `function itemDisplayName(item: AppRatItem): string`
  - `function itemRetired(item: AppRatItem): number`
  - `function itemStays(item: AppRatItem): number`
  - `interface AppRatTotals { stackTotal: number; toAbridge: number; stays: number; pctToAbridge: number }`
  - `function computeTotals(items: AppRatItem[]): AppRatTotals`
  - `function searchApplications(query: string): { vendors: KnownVendor[]; categories: AppRatCategory[] }`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/__tests__/appRationalizationCalc.test.ts
import { describe, it, expect } from "vitest";
import {
  APP_RAT_CATEGORIES, KNOWN_VENDORS, categoryLabel, makeItem, itemDisplayName,
  itemRetired, itemStays, computeTotals, searchApplications, type AppRatItem,
} from "@/lib/appRationalizationCalc";

const item = (over: Partial<AppRatItem> = {}): AppRatItem => ({
  id: "x", category: "dictation", annualSpend: 1_800_000, coveragePct: 80, transitionMonths: 12, ...over,
});

describe("appRationalizationCalc", () => {
  it("retired = round(spend * coverage%)", () => {
    expect(itemRetired(item())).toBe(1_440_000);
    expect(itemRetired(item({ annualSpend: 1_000_000, coveragePct: 90 }))).toBe(900_000);
  });
  it("stays = spend - retired", () => {
    expect(itemStays(item())).toBe(360_000);
    expect(itemStays(item({ coveragePct: 100 }))).toBe(0);
  });
  it("display name falls back to the category label when no vendor", () => {
    expect(itemDisplayName(item({ category: "scribe", vendorName: undefined }))).toBe("Medical scribe");
    expect(itemDisplayName(item({ vendorName: "Fluency" }))).toBe("Fluency");
  });
  it("computeTotals sums retired and stays and computes pct", () => {
    const t = computeTotals([
      item({ annualSpend: 1_800_000, coveragePct: 80 }),   // 1.44M / 0.36M
      item({ annualSpend: 1_000_000, coveragePct: 90 }),   // 0.90M / 0.10M
    ]);
    expect(t.stackTotal).toBe(2_800_000);
    expect(t.toAbridge).toBe(2_340_000);
    expect(t.stays).toBe(460_000);
    expect(t.pctToAbridge).toBe(84); // round(2.34/2.8*100)
  });
  it("computeTotals is zero-safe on an empty stack", () => {
    expect(computeTotals([])).toEqual({ stackTotal: 0, toAbridge: 0, stays: 0, pctToAbridge: 0 });
  });
  it("makeItem defaults to 80% coverage and the given category", () => {
    const m = makeItem("id1", "cds");
    expect(m).toMatchObject({ id: "id1", category: "cds", coveragePct: 80, annualSpend: 0, transitionMonths: 12 });
  });
  it("categoryLabel resolves known ids", () => {
    expect(categoryLabel("cds")).toBe("Clinical decision support");
  });
  it("searchApplications: empty query returns all categories, no vendors", () => {
    const r = searchApplications("");
    expect(r.categories).toHaveLength(APP_RAT_CATEGORIES.length);
    expect(r.vendors).toHaveLength(0);
  });
  it("searchApplications: a vendor prefix surfaces the vendor and its category is filtered too", () => {
    const r = searchApplications("flu");
    expect(r.vendors.map((v) => v.name)).toContain("Fluency");
    // categories still filtered by substring; 'flu' matches no category label
    expect(r.categories).toHaveLength(0);
  });
  it("searchApplications: a category prefix surfaces the category", () => {
    const r = searchApplications("dict");
    expect(r.categories.map((c) => c.id)).toContain("dictation");
  });
  it("KNOWN_VENDORS all reference a real category", () => {
    const ids = new Set(APP_RAT_CATEGORIES.map((c) => c.id));
    for (const v of KNOWN_VENDORS) expect(ids.has(v.category)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/__tests__/appRationalizationCalc.test.ts`
Expected: FAIL — cannot resolve `@/lib/appRationalizationCalc`.

- [ ] **Step 3: Write the implementation**

```ts
// client/src/lib/appRationalizationCalc.ts
// App Rationalization: the customer's documentation-adjacent stack and the share
// Abridge can take on. Owns its own capability taxonomy (a superset of the
// Compare Pricing displacement categories) so that picker is untouched; reuses
// the same "spend x coverage%" displacement math pattern.

export type AppRatIconKey =
  | "ambientDoc" | "scribe" | "dictation" | "transcription" | "cds"
  | "preChartRisk" | "inEncounterCdi" | "postChartCoding" | "clinicalEvidence" | "custom";

export type AppRatCategoryId = AppRatIconKey;

export interface AppRatCategory {
  id: AppRatCategoryId;
  label: string;
  hint: string;      // example vendors, shown under the category in search
  icon: AppRatIconKey;
}

export const APP_RAT_CATEGORIES: AppRatCategory[] = [
  { id: "ambientDoc",       label: "Ambient documentation",        hint: "Nuance DAX, Suki, Nabla, Ambience", icon: "ambientDoc" },
  { id: "dictation",        label: "Dictation",                    hint: "Fluency, Dragon Medical",           icon: "dictation" },
  { id: "scribe",           label: "Medical scribe",               hint: "in-person or virtual scribes",       icon: "scribe" },
  { id: "cds",              label: "Clinical decision support",    hint: "UpToDate, OpenEvidence",             icon: "cds" },
  { id: "preChartRisk",     label: "Pre-charting risk",            hint: "Iodine, Stanson",                    icon: "preChartRisk" },
  { id: "inEncounterCdi",   label: "In-encounter risk / CDI",      hint: "Stanson",                            icon: "inEncounterCdi" },
  { id: "postChartCoding",  label: "Post-charting CDI / coding",   hint: "Solventum",                          icon: "postChartCoding" },
  { id: "transcription",    label: "Transcription services",       hint: "outsourced or offshore",             icon: "transcription" },
  { id: "clinicalEvidence", label: "Clinical evidence & search",   hint: "OpenEvidence, redundant reference",  icon: "clinicalEvidence" },
  { id: "custom",           label: "Custom",                       hint: "not on the list",                    icon: "custom" },
];

export interface KnownVendor { name: string; category: AppRatCategoryId }

export const KNOWN_VENDORS: KnownVendor[] = [
  { name: "Nuance DAX", category: "ambientDoc" },
  { name: "Suki", category: "ambientDoc" },
  { name: "Nabla", category: "ambientDoc" },
  { name: "Ambience", category: "ambientDoc" },
  { name: "Fluency", category: "dictation" },
  { name: "Dragon Medical", category: "dictation" },
  { name: "UpToDate", category: "cds" },
  { name: "OpenEvidence", category: "cds" },
  { name: "Iodine", category: "preChartRisk" },
  { name: "Stanson", category: "inEncounterCdi" },
  { name: "Solventum", category: "postChartCoding" },
];

export interface AppRatItem {
  id: string;
  category: AppRatCategoryId;
  vendorName?: string;      // optional; display falls back to the category label
  annualSpend: number;
  coveragePct: number;      // 0-100; the share of THIS tool's spend Abridge can take on
  abridgeProduct?: string;  // "Covered by"; defaults to the category label when empty
  renewal?: string;         // "Open term" | "2026" | "Mid 2027" | "Unknown"; drives the roadmap later
  transitionMonths: number; // ramp, reused by later phases
}

const CATEGORY_BY_ID: Record<AppRatCategoryId, AppRatCategory> =
  Object.fromEntries(APP_RAT_CATEGORIES.map((c) => [c.id, c])) as Record<AppRatCategoryId, AppRatCategory>;

export function categoryLabel(id: AppRatCategoryId): string {
  return CATEGORY_BY_ID[id]?.label ?? "Application";
}

export function makeItem(id: string, category: AppRatCategoryId): AppRatItem {
  return { id, category, annualSpend: 0, coveragePct: 80, transitionMonths: 12 };
}

export function itemDisplayName(item: AppRatItem): string {
  return item.vendorName?.trim() || categoryLabel(item.category);
}

export function itemRetired(item: AppRatItem): number {
  return Math.round((item.annualSpend || 0) * (item.coveragePct || 0) / 100);
}

export function itemStays(item: AppRatItem): number {
  return Math.max(0, (item.annualSpend || 0) - itemRetired(item));
}

export interface AppRatTotals {
  stackTotal: number;
  toAbridge: number;
  stays: number;
  pctToAbridge: number; // 0-100
}

export function computeTotals(items: AppRatItem[]): AppRatTotals {
  const stackTotal = items.reduce((s, i) => s + (i.annualSpend || 0), 0);
  const toAbridge = items.reduce((s, i) => s + itemRetired(i), 0);
  const stays = Math.max(0, stackTotal - toAbridge);
  const pctToAbridge = stackTotal > 0 ? Math.round((toAbridge / stackTotal) * 100) : 0;
  return { stackTotal, toAbridge, stays, pctToAbridge };
}

/** Command-search matcher: substring match on vendor names and category labels. */
export function searchApplications(query: string): { vendors: KnownVendor[]; categories: AppRatCategory[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { vendors: [], categories: APP_RAT_CATEGORIES };
  const vendors = KNOWN_VENDORS.filter((v) => v.name.toLowerCase().includes(q));
  const categories = APP_RAT_CATEGORIES.filter((c) => c.label.toLowerCase().includes(q));
  return { vendors, categories };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/__tests__/appRationalizationCalc.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/appRationalizationCalc.ts client/src/__tests__/appRationalizationCalc.test.ts
git commit -m "App Rationalization: calc module (taxonomy, per-item split, totals, search)"
```

---

### Task 2: Flow shell + route + 4th mode-selector card

**Files:**
- Create: `client/src/pages/forecast/AppRationalizationFlow.tsx`
- Modify: `client/src/pages/forecast/ForecastModeSelector.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `AppRatItem`, `makeItem`, `computeTotals` from Task 1; `UnifiedHeader` from `@/components/UnifiedHeader`.
- Produces:
  - `AppRationalizationFlow` default export, props `{ onBack: () => void; onHome: () => void }`.
  - Internal step state `type ArStep = "setup" | "applications" | "consolidation"` (consolidation is a Phase-2 stub here).
  - A `ForecastModeSelectorProps.onSelectAppRationalization: () => void` prop.

- [ ] **Step 1: Create the flow shell with Setup/Applications placeholders**

The shell owns state and renders the correct step. Setup and Applications bodies are filled in Tasks 3 and 5; here they are placeholder `<div>`s so the shell compiles and routes.

```tsx
// client/src/pages/forecast/AppRationalizationFlow.tsx
import { useState } from "react";
import { UnifiedHeader } from "@/components/UnifiedHeader";
import { type AppRatItem, type AppRatCategoryId, makeItem } from "@/lib/appRationalizationCalc";

type ArStep = "setup" | "applications" | "consolidation";

interface AppRationalizationFlowProps {
  onBack: () => void;
  onHome: () => void;
}

const STEP_INDEX: Record<ArStep, number> = { setup: 1, applications: 2, consolidation: 3 };
const STEP_LABELS = ["Setup", "Applications", "Consolidation", "The change", "Why we can"];

export default function AppRationalizationFlow({ onBack, onHome }: AppRationalizationFlowProps) {
  const [step, setStep] = useState<ArStep>("setup");
  const [orgName, setOrgName] = useState("");
  const [termYears, setTermYears] = useState(3);
  const [items, setItems] = useState<AppRatItem[]>([]);

  const addItem = (category: AppRatCategoryId, vendorName?: string) =>
    setItems((prev) => [...prev, { ...makeItem(`ar-${Date.now()}`, category), vendorName }]);
  const updateItem = (id: string, patch: Partial<AppRatItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <UnifiedHeader
        pathType="forecast"
        stepName="App Rationalization"
        currentStep={STEP_INDEX[step]}
        totalSteps={5}
        stepLabels={STEP_LABELS}
        onBack={onBack}
        onHome={onHome}
      />
      <div className="pt-14 sm:pt-16">
        {step === "setup" && (
          <div data-testid="ar-step-setup" className="p-8">Setup step (Task 3)</div>
        )}
        {step === "applications" && (
          <div data-testid="ar-step-applications" className="p-8">Applications step (Task 5)</div>
        )}
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
      </div>
    </div>
  );
}
```

(The `orgName`, `termYears`, `items`, `addItem`, `updateItem`, `removeItem` bindings are consumed by Tasks 3 and 5; keep them even though Step 1 does not yet render them, so the shell's contract is stable.)

- [ ] **Step 2: Add the route in App.tsx**

Add the view to the `AppView` union (App.tsx:57): append `| "forecast-app-rationalization"`.

```tsx
// client/src/App.tsx — union (line ~57), append the new member:
// ... | "data-request-builder" | "forecast-app-rationalization";
```

Add the import near the other forecast imports (App.tsx ~line 40):

```tsx
import AppRationalizationFlow from "@/pages/forecast/AppRationalizationFlow";
```

Render it next to the other forecast views (App.tsx, after the `forecast-pricing` block ~line 539):

```tsx
{currentView === "forecast-app-rationalization" && (
  <AppRationalizationFlow
    onBack={() => navigateTo("forecast-mode")}
    onHome={() => navigateTo("journey")}
  />
)}
```

- [ ] **Step 3: Add the 4th card to ForecastModeSelector**

Add the prop and a fourth card. Widen the grid to a 2x2 so four cards breathe.

In `ForecastModeSelector.tsx`, extend the props (line ~6):

```tsx
interface ForecastModeSelectorProps {
  onSelectNewDeal: () => void;
  onSelectPricingComparison: () => void;
  onSelectPartnerModel: () => void;
  onSelectAppRationalization: () => void;
  onHome: () => void;
}
```

Destructure `onSelectAppRationalization` in the function signature. Change the grid wrapper (line ~45) from `grid-cols-1 md:grid-cols-3 ... max-w-5xl` to:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 max-w-4xl mx-auto">
```

Add a fourth `motion.div` card after the Compare Pricing card (mirror the existing card markup exactly; use the `Boxes` icon from lucide-react, add it to the line-2 import):

```tsx
<motion.div
  initial={{ opacity: 0, y: 24 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
  whileHover={{ y: -4 }}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => handleCardKey(e, onSelectAppRationalization)}
  className="group relative flex flex-col cursor-pointer transition-all duration-300 ease-out rounded-xl p-8 min-h-[300px] bg-[#F5F0EB] hover:bg-[#EDE7E0] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA2C00] focus-visible:ring-offset-2"
  onClick={onSelectAppRationalization}
  data-testid="card-forecast-app-rationalization"
>
  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-5">
    <Boxes className="w-6 h-6 text-[#EA2C00]" />
  </div>
  <p className="text-[13px] text-[#EA2C00] font-medium mb-1.5">Consolidation</p>
  <h3 className="text-2xl font-bold text-[#1A1A1A] mb-2.5">App Rationalization</h3>
  <p className="text-sm text-[#666666] leading-relaxed flex-1 mb-6">
    Show their current tool stack and how much of it Abridge can take on, by capability, so the consolidation is clear.
  </p>
  <Button
    className="w-full bg-[#EA2C00] text-white border-[#EA2C00]"
    size="lg"
    onClick={(e) => { e.stopPropagation(); onSelectAppRationalization(); }}
    data-testid="card-forecast-app-rationalization-button"
  >
    Build the case
    <ChevronRight className="w-4 h-4 ml-1" />
  </Button>
</motion.div>
```

Update the lucide import (line 2) to include `Boxes`.

- [ ] **Step 4: Wire the new prop in App.tsx**

In the `forecast-mode` render block (App.tsx ~line 526), add the handler:

```tsx
<ForecastModeSelector
  onSelectNewDeal={() => navigateTo("proforma-hub")}
  onSelectPricingComparison={() => navigateTo("forecast-pricing")}
  onSelectPartnerModel={() => { setMeasureFromForecastMode(true); navigateTo("measure"); }}
  onSelectAppRationalization={() => navigateTo("forecast-app-rationalization")}
  onHome={() => navigateTo("journey")}
/>
```

- [ ] **Step 5: Verify types, tests, and build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

Run: `npx vitest run`
Expected: all green (Task 1 tests included).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/forecast/AppRationalizationFlow.tsx client/src/pages/forecast/ForecastModeSelector.tsx client/src/App.tsx
git commit -m "App Rationalization: flow shell, route, and 4th Forecast card"
```

---

### Task 3: Setup step

**Files:**
- Create: `client/src/pages/forecast/appRationalization/ArSetupStep.tsx`
- Modify: `client/src/pages/forecast/AppRationalizationFlow.tsx`

**Interfaces:**
- Consumes: nothing from calc.
- Produces: `ArSetupStep` component, props `{ orgName: string; termYears: number; onChange: (patch: { orgName?: string; termYears?: number }) => void; onContinue: () => void }`.

- [ ] **Step 1: Create the Setup step**

```tsx
// client/src/pages/forecast/appRationalization/ArSetupStep.tsx
interface ArSetupStepProps {
  orgName: string;
  termYears: number;
  onChange: (patch: { orgName?: string; termYears?: number }) => void;
  onContinue: () => void;
}

const TERMS = [1, 2, 3, 5];

export default function ArSetupStep({ orgName, termYears, onChange, onContinue }: ArSetupStepProps) {
  return (
    <div className="max-w-xl mx-auto px-6 py-16 text-center">
      <h1 className="font-abridge text-4xl uppercase tracking-tight text-[#1A1A1A]" data-testid="ar-setup-title">
        Set up
      </h1>
      <p className="text-sm text-[#6B6B6B] mt-3 mb-10">
        Who are we building this for, and over how long a contract.
      </p>

      <div className="text-left">
        <label className="block text-[11px] font-semibold text-[#8C7E6E] uppercase tracking-wide mb-2">Organization</label>
        <input
          value={orgName}
          onChange={(e) => onChange({ orgName: e.target.value })}
          placeholder="Organization name"
          className="w-full h-12 bg-white border border-[#E8E2DA] rounded-xl px-4 text-[15px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A] transition-colors placeholder-[#B4A99B]"
          data-testid="ar-setup-org"
        />

        <label className="block text-[11px] font-semibold text-[#8C7E6E] uppercase tracking-wide mt-7 mb-2">Contract term</label>
        <div className="inline-flex bg-[#F5F0EB] rounded-full p-1 gap-1">
          {TERMS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => onChange({ termYears: y })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                y === termYears ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#6B6B6B] hover:text-[#1A1A1A]"
              }`}
              data-testid={`ar-setup-term-${y}`}
            >
              {y} {y === 1 ? "year" : "years"}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onContinue}
        className="mt-12 w-full h-12 rounded-xl bg-[#EA2C00] text-white text-[15px] font-semibold"
        data-testid="ar-setup-continue"
      >
        Add their applications →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Render it in the flow shell**

In `AppRationalizationFlow.tsx`, replace the setup placeholder `<div>` with:

```tsx
{step === "setup" && (
  <ArSetupStep
    orgName={orgName}
    termYears={termYears}
    onChange={(p) => { if (p.orgName !== undefined) setOrgName(p.orgName); if (p.termYears !== undefined) setTermYears(p.termYears); }}
    onContinue={() => setStep("applications")}
  />
)}
```

Add the import at the top: `import ArSetupStep from "./appRationalization/ArSetupStep";`

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` → 0 errors.
Run: `npx vitest run` → all green.
Run: `npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/forecast/appRationalization/ArSetupStep.tsx client/src/pages/forecast/AppRationalizationFlow.tsx
git commit -m "App Rationalization: Setup step (org + contract term)"
```

---

### Task 4: Command search (category-first)

**Files:**
- Create: `client/src/pages/forecast/appRationalization/CategoryIcon.tsx`
- Create: `client/src/pages/forecast/appRationalization/ArCommandSearch.tsx`

**Interfaces:**
- Consumes: `searchApplications`, `APP_RAT_CATEGORIES`, `KNOWN_VENDORS`, `categoryLabel`, `type AppRatCategoryId`, `type AppRatIconKey` from Task 1.
- Produces:
  - `CategoryIcon` component, props `{ icon: AppRatIconKey; className?: string }`, renders the lucide icon for a capability.
  - `ArCommandSearch` component, props `{ onSelect: (category: AppRatCategoryId, vendorName?: string) => void }`. Renders the search input + results; calls `onSelect` when a vendor row (with its category + name), a category row (no vendor), or the custom row (category `"custom"`, vendorName = the typed text) is chosen.

- [ ] **Step 1: Create the capability icon map**

```tsx
// client/src/pages/forecast/appRationalization/CategoryIcon.tsx
import { AudioLines, Mic, PenLine, BookOpen, ShieldAlert, Activity, Hash, FileText, Search, Plus } from "lucide-react";
import type { AppRatIconKey } from "@/lib/appRationalizationCalc";

const MAP: Record<AppRatIconKey, typeof AudioLines> = {
  ambientDoc: AudioLines,
  dictation: Mic,
  scribe: PenLine,
  cds: BookOpen,
  preChartRisk: ShieldAlert,
  inEncounterCdi: Activity,
  postChartCoding: Hash,
  transcription: FileText,
  clinicalEvidence: Search,
  custom: Plus,
};

export function CategoryIcon({ icon, className }: { icon: AppRatIconKey; className?: string }) {
  const Cmp = MAP[icon] ?? Plus;
  return <Cmp className={className ?? "w-5 h-5"} />;
}
```

- [ ] **Step 2: Create the command search**

Keyboard nav: a flat list of "options" is built from the current results (vendors, then categories, then the custom row). `↑/↓` move `active`, `Enter` selects `active`, `Escape` clears the query. Hover sets `active`.

```tsx
// client/src/pages/forecast/appRationalization/ArCommandSearch.tsx
import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";
import {
  searchApplications, categoryLabel, APP_RAT_CATEGORIES,
  type AppRatCategoryId, type AppRatCategory, type KnownVendor,
} from "@/lib/appRationalizationCalc";

type Option =
  | { kind: "vendor"; vendor: KnownVendor }
  | { kind: "category"; category: AppRatCategory }
  | { kind: "custom"; text: string };

export default function ArCommandSearch({
  onSelect,
}: { onSelect: (category: AppRatCategoryId, vendorName?: string) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { vendors, categories } = useMemo(() => searchApplications(query), [query]);

  const options = useMemo<Option[]>(() => {
    const opts: Option[] = [
      ...vendors.map((v) => ({ kind: "vendor", vendor: v } as Option)),
      ...categories.map((c) => ({ kind: "category", category: c } as Option)),
    ];
    if (query.trim()) opts.push({ kind: "custom", text: query.trim() });
    return opts;
  }, [vendors, categories, query]);

  const choose = (opt: Option) => {
    if (opt.kind === "vendor") onSelect(opt.vendor.category, opt.vendor.name);
    else if (opt.kind === "category") onSelect(opt.category.id);
    else onSelect("custom", opt.text);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (options[active]) choose(options[active]); }
    else if (e.key === "Escape") { setQuery(""); setActive(0); }
  };

  const vendorStart = 0;
  const categoryStart = vendors.length;

  return (
    <div className="relative">
      <div className="flex items-center gap-3 h-14 border-[1.5px] border-[#EA2C00] rounded-2xl px-4 bg-white shadow-[0_0_0_4px_rgba(234,44,0,0.08)]">
        <Search className="w-5 h-5 text-[#B4A99B] flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder="Search a vendor, or browse capabilities below"
          className="flex-1 bg-transparent outline-none text-[16px] text-[#1A1A1A] placeholder-[#B4A99B]"
          data-testid="ar-search-input"
        />
        <span className="text-[11px] font-bold text-[#8C7E6E] bg-[#F5F0EB] border border-[#E8E2DA] rounded-md px-2 py-1">⌘K</span>
      </div>

      <div className="mt-2 bg-white border border-[#E8E2DA] rounded-2xl overflow-hidden shadow-[0_22px_54px_rgba(0,0,0,0.10)]">
        {vendors.length > 0 && (
          <div className="px-[18px] pt-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-[1.6px] text-[#8C7E6E]">Best match</div>
        )}
        {vendors.map((v, i) => {
          const idx = vendorStart + i;
          return (
            <Row key={`v-${v.name}`} activeRow={active === idx} onEnter={() => setActive(idx)} onClick={() => choose({ kind: "vendor", vendor: v })} icon={APP_RAT_CATEGORIES.find((c) => c.id === v.category)!.icon} name={v.name} sub={categoryLabel(v.category)} right="↵ Add" testid={`ar-opt-vendor-${v.name.replace(/\s+/g, "-").toLowerCase()}`} />
          );
        })}

        {categories.length > 0 && (
          <div className="px-[18px] pt-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-[1.6px] text-[#8C7E6E]">
            {query.trim() ? "Or pick a category" : "All capabilities"}
          </div>
        )}
        {categories.map((c, i) => {
          const idx = categoryStart + i;
          return (
            <Row key={`c-${c.id}`} activeRow={active === idx} onEnter={() => setActive(idx)} onClick={() => choose({ kind: "category", category: c })} icon={c.icon} name={c.label} sub={c.hint} right="›" testid={`ar-opt-category-${c.id}`} />
          );
        })}

        {query.trim() && (
          <>
            <div className="h-px bg-[#F2ECE4] my-1.5" />
            <Row activeRow={active === options.length - 1} onEnter={() => setActive(options.length - 1)} onClick={() => choose({ kind: "custom", text: query.trim() })} icon="custom" name={`Add “${query.trim()}” as a custom application`} sub="" right="" testid="ar-opt-custom" />
          </>
        )}

        <div className="flex gap-[18px] px-[18px] py-3 border-t border-[#F2ECE4] text-[11.5px] text-[#8C7E6E]">
          <span><b className="text-[#1A1A1A]">↑ ↓</b> navigate</span>
          <span><b className="text-[#1A1A1A]">↵</b> add</span>
          <span><b className="text-[#1A1A1A]">esc</b> clear</span>
        </div>
      </div>
    </div>
  );
}

function Row({
  activeRow, onEnter, onClick, icon, name, sub, right, testid,
}: {
  activeRow: boolean; onEnter: () => void; onClick: () => void;
  icon: React.ComponentProps<typeof CategoryIcon>["icon"]; name: string; sub: string; right: string; testid: string;
}) {
  return (
    <div
      onMouseEnter={onEnter}
      onClick={onClick}
      className={`flex items-center gap-3.5 px-[18px] py-2.5 cursor-pointer ${activeRow ? "bg-[#F5F0EB]" : ""}`}
      data-testid={testid}
    >
      <div className="w-9 h-9 rounded-[10px] bg-[#F5F0EB] flex items-center justify-center text-[#6B5E4F] flex-shrink-0">
        <CategoryIcon icon={icon} className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-[#1A1A1A] truncate">{name}</div>
        {sub && <div className="text-[12.5px] text-[#8C7E6E] truncate">{sub}</div>}
      </div>
      {right && <div className="text-[12px] text-[#B4A99B] flex-shrink-0">{right}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json` → 0 errors.
Run: `npx vitest run` → all green.
Run: `npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/forecast/appRationalization/CategoryIcon.tsx client/src/pages/forecast/appRationalization/ArCommandSearch.tsx
git commit -m "App Rationalization: category-first command search"
```

---

### Task 5: Applications step (stack cards + sidebar) + wire into flow

**Files:**
- Create: `client/src/pages/forecast/appRationalization/ArStackCard.tsx`
- Create: `client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx`
- Modify: `client/src/pages/forecast/AppRationalizationFlow.tsx`

**Interfaces:**
- Consumes: `ArCommandSearch` (Task 4), `CategoryIcon` (Task 4), `AppRatItem`, `itemRetired`, `itemStays`, `computeTotals`, `categoryLabel`, `APP_RAT_CATEGORIES`, `KNOWN_VENDORS` (Task 1); `Slider` from `@/components/ui/slider`; `NumberField` from `@/components/NumberField`; `AnimatedValue` from `@/components/explore/AnimatedValue`.
- Produces:
  - `ArStackCard`, props `{ item: AppRatItem; onChange: (patch: Partial<AppRatItem>) => void; onRemove: () => void }`.
  - `ArApplicationsStep`, props `{ items: AppRatItem[]; onAdd: (category: AppRatCategoryId, vendorName?: string) => void; onUpdate: (id: string, patch: Partial<AppRatItem>) => void; onRemove: (id: string) => void; onContinue: () => void }`.

- [ ] **Step 1: Create the stack card**

Currency formatting uses a small local `fmtM` (millions with two decimals, matching the mockup, e.g. `$1.44M`). Vendor and "Covered by" are select-or-type via native `datalist`.

```tsx
// client/src/pages/forecast/appRationalization/ArStackCard.tsx
import { Slider } from "@/components/ui/slider";
import { NumberField } from "@/components/NumberField";
import { CategoryIcon } from "./CategoryIcon";
import {
  itemRetired, itemStays, categoryLabel, APP_RAT_CATEGORIES, KNOWN_VENDORS,
  type AppRatItem,
} from "@/lib/appRationalizationCalc";

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

const RENEWALS = ["Open term", "2026", "Mid 2027", "2028", "Unknown"];

export default function ArStackCard({
  item, onChange, onRemove,
}: { item: AppRatItem; onChange: (patch: Partial<AppRatItem>) => void; onRemove: () => void }) {
  const cat = APP_RAT_CATEGORIES.find((c) => c.id === item.category)!;
  const vendorSuggestions = KNOWN_VENDORS.filter((v) => v.category === item.category).map((v) => v.name);
  const retired = itemRetired(item);
  const stays = itemStays(item);

  return (
    <div className="bg-white border border-[#E8E2DA] rounded-2xl p-5 mb-3.5" data-testid={`ar-card-${item.id}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-[38px] h-[38px] rounded-[11px] bg-[#F5F0EB] flex items-center justify-center text-[#6B5E4F] flex-shrink-0">
          <CategoryIcon icon={cat.icon} className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-bold text-[#1A1A1A] truncate">{item.vendorName?.trim() || cat.label}</div>
          <div className="text-[11.5px] text-[#8C7E6E]">{cat.label}</div>
        </div>
        <button onClick={onRemove} className="ml-auto text-[#C4B8A8] hover:text-[#1A1A1A] text-lg leading-none" aria-label="Remove" data-testid={`ar-card-remove-${item.id}`}>×</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr] gap-3">
        <Field label="Vendor">
          <input
            list={`ar-vend-${item.id}`}
            value={item.vendorName ?? ""}
            onChange={(e) => onChange({ vendorName: e.target.value })}
            placeholder={cat.label}
            className="w-full h-10 bg-white border border-[#E8E2DA] rounded-[10px] px-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1A1A1A] placeholder-[#B4A99B]"
            data-testid={`ar-card-vendor-${item.id}`}
          />
          <datalist id={`ar-vend-${item.id}`}>{vendorSuggestions.map((n) => <option key={n} value={n} />)}</datalist>
        </Field>
        <Field label="Annual spend">
          <div className="flex items-center h-10 bg-white border border-[#E8E2DA] rounded-[10px] px-3 gap-1 focus-within:border-[#1A1A1A]">
            <span className="text-[#8C7E6E] text-sm">$</span>
            <NumberField value={item.annualSpend} onValueChange={(v) => onChange({ annualSpend: v })} min={0} className="flex-1 min-w-0 bg-transparent text-sm text-[#1A1A1A] outline-none tabular-nums" data-testid={`ar-card-spend-${item.id}`} />
          </div>
        </Field>
        <Field label="Renews">
          <select
            value={item.renewal ?? ""}
            onChange={(e) => onChange({ renewal: e.target.value || undefined })}
            className="w-full h-10 bg-white border border-[#E8E2DA] rounded-[10px] px-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            data-testid={`ar-card-renews-${item.id}`}
          >
            <option value="">Select…</option>
            {RENEWALS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-5 items-center mt-4 pt-3.5 border-t border-[#F2ECE4]">
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[12.5px] text-[#6B6B6B]">Abridge covers</span>
            <span className="text-base font-extrabold text-[#EA2C00] tabular-nums">{item.coveragePct}%</span>
          </div>
          <Slider min={0} max={100} step={5} value={[item.coveragePct]} onValueChange={(vals) => onChange({ coveragePct: vals[0] })} accent="coral" aria-label="Coverage" data-testid={`ar-card-coverage-${item.id}`} />
        </div>
        <Field label="Covered by (Abridge)">
          <input
            value={item.abridgeProduct ?? ""}
            onChange={(e) => onChange({ abridgeProduct: e.target.value })}
            placeholder={cat.label}
            className="w-full h-10 bg-white border border-[#E8E2DA] rounded-[10px] px-3 text-sm text-[#1A1A1A] outline-none focus:border-[#1A1A1A] placeholder-[#B4A99B]"
            data-testid={`ar-card-abridge-${item.id}`}
          />
        </Field>
      </div>

      <div className="mt-4 text-[12.5px] text-[#6B6B6B] tabular-nums">
        <b className="text-[#1A1A1A]">{fmtM(retired)}</b> to Abridge · {fmtM(stays)} stays
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-[#8C7E6E] uppercase tracking-[0.5px] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create the Applications step (search + stack + sidebar)**

```tsx
// client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx
import ArCommandSearch from "./ArCommandSearch";
import ArStackCard from "./ArStackCard";
import { AnimatedValue } from "@/components/explore/AnimatedValue";
import { computeTotals, type AppRatItem, type AppRatCategoryId } from "@/lib/appRationalizationCalc";

function fmtM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export default function ArApplicationsStep({
  items, onAdd, onUpdate, onRemove, onContinue,
}: {
  items: AppRatItem[];
  onAdd: (category: AppRatCategoryId, vendorName?: string) => void;
  onUpdate: (id: string, patch: Partial<AppRatItem>) => void;
  onRemove: (id: string) => void;
  onContinue: () => void;
}) {
  const totals = computeTotals(items);

  return (
    <div className="max-w-[1120px] mx-auto px-6 py-8">
      <h1 className="font-abridge text-4xl uppercase tracking-tight text-[#1A1A1A] text-center">Applications</h1>
      <p className="text-sm text-[#6B6B6B] text-center mt-2.5 mb-8">
        Browse the capabilities, or type a vendor and we place it for you.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_296px] gap-6 items-start">
        <div>
          <div className="mb-6"><ArCommandSearch onSelect={onAdd} /></div>

          {items.length > 0 && (
            <div className="text-[11px] font-bold uppercase tracking-[2px] text-[#8C7E6E] mb-3" data-testid="ar-stack-count">
              Your stack · {items.length} added
            </div>
          )}
          {items.map((it) => (
            <ArStackCard key={it.id} item={it} onChange={(p) => onUpdate(it.id, p)} onRemove={() => onRemove(it.id)} />
          ))}
        </div>

        <div className="lg:sticky lg:top-20 rounded-2xl p-5 text-white" style={{ background: "linear-gradient(155deg,#221E19,#141210)" }}>
          <div className="text-[10px] font-bold uppercase tracking-[1.6px] text-white/45">Stack today</div>
          <AnimatedValue value={totals.stackTotal} format={fmtM} className="block text-[32px] font-extrabold tracking-tight mt-1.5 tabular-nums" data-testid="ar-sidebar-total" />
          <div className="text-xs text-white/50 mt-1">/ year · {items.length} {items.length === 1 ? "application" : "applications"}</div>

          <div className="my-4">
            <div className="flex justify-between items-center text-[12.5px] mb-2">
              <span className="flex items-center gap-2 text-white/80"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#EA2C00" }} />To Abridge</span>
              <b className="tabular-nums">{fmtM(totals.toAbridge)}</b>
            </div>
            <div className="flex justify-between items-center text-[12.5px]">
              <span className="flex items-center gap-2 text-white/80"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#D8CEC1" }} />Stays</span>
              <b className="tabular-nums">{fmtM(totals.stays)}</b>
            </div>
            <div className="h-2 rounded-md overflow-hidden flex mt-2">
              <div style={{ width: `${totals.pctToAbridge}%`, background: "#EA2C00" }} />
              <div style={{ width: `${100 - totals.pctToAbridge}%`, background: "#D8CEC1" }} />
            </div>
          </div>

          <button
            onClick={onContinue}
            disabled={items.length === 0}
            className="w-full h-11 rounded-xl bg-[#EA2C00] text-white text-sm font-bold disabled:opacity-40"
            data-testid="ar-see-consolidation"
          >
            See the consolidation →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the Applications step into the flow shell**

In `AppRationalizationFlow.tsx`, replace the applications placeholder `<div>` with:

```tsx
{step === "applications" && (
  <ArApplicationsStep
    items={items}
    onAdd={addItem}
    onUpdate={updateItem}
    onRemove={removeItem}
    onContinue={() => setStep("consolidation")}
  />
)}
```

Add the import: `import ArApplicationsStep from "./appRationalization/ArApplicationsStep";`

- [ ] **Step 4: Verify types, tests, build**

Run: `npx tsc --noEmit -p tsconfig.json` → 0 errors.
Run: `npx vitest run` → all green.
Run: `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/forecast/appRationalization/ArStackCard.tsx client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx client/src/pages/forecast/AppRationalizationFlow.tsx
git commit -m "App Rationalization: Applications step (stack cards + live sidebar)"
```

- [ ] **Step 6: Manual verification note**

This environment cannot render the app. The user verifies on Replit: from Forecast, open App Rationalization, set org + term, search "flu" (Fluency lands under Dictation), browse and add a capability, edit spend/coverage/renews, watch the sidebar totals count up, and confirm "See the consolidation" reaches the Phase-2 stub. Confirm fonts (Abridge title, Manrope UI), coral slider, Lucide icons, no stoplight colors, no status pills.

---

## Self-Review

**Spec coverage (Phase 1 rows of the build order):**
- Model + taxonomy + derive + tests → Task 1. ✓
- Flow shell + chrome + route + 4th card → Task 2. ✓
- Setup step → Task 3. ✓
- Applications: command search (browse + vendor→category + custom + keyboard) → Task 4. ✓
- Applications: stack cards (icon, vendor select-or-type default to category, spend, renews, coral coverage slider, covered-by, "$X to Abridge · $Y stays", no pills, no mini bar) + live sidebar (totals, split bar, animated count-up, "See the consolidation") → Task 5. ✓
- Consolidation hero, roadmap, why, PDF, Compare Pricing sync → explicitly out of Phase 1. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". The consolidation stub in Task 2 is an intentional Phase-2 boundary, labeled as such, with real placeholder copy. Every code step shows complete code.

**Type consistency:** `AppRatItem`, `AppRatCategoryId`, `AppRatIconKey`, `itemRetired`, `itemStays`, `computeTotals`, `searchApplications`, `categoryLabel`, `makeItem`, `itemDisplayName` are defined in Task 1 and referenced with the same names/signatures in Tasks 4–5. `ArCommandSearch onSelect(category, vendorName?)` matches `addItem(category, vendorName?)` in the shell. `Slider` uses `accent="coral"` and `value={[n]}`/`onValueChange` as in the shared component. `NumberField` uses `value`/`onValueChange`/`min`. `AnimatedValue` uses `value`/`format`/`className`/`data-testid`.

**Constraint check:** copy uses defensible voice, no em dashes, no jargon; palette is coral + warm neutrals; no green/amber/orange; no status pills; reuses UnifiedHeader/NumberField/Slider/AnimatedValue; each task verifies tsc + vitest (+ build for UI).
