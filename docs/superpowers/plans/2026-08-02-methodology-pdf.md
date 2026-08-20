# The Methodology PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the flagship educational "Methodology" PDF — one premium comparative HTML-print document that teaches how ambient documentation creates value, care setting by care setting.

**Architecture:** A single data module (`methodologyContent.ts`) is the source of truth for all copy, signals, illustrative math, and per-setting content. One HTML-print document component (`MethodologyEditorialPdf.tsx`) renders it (cover → "The record" opening → the comparison matrix → four setting chapters → the attainment close), reachable at `?methodpdf=1`. Guarded by a copy guardrail, a math foot-test, and layout smoke. The old react-pdf methodology export is retired last.

**Tech Stack:** React 18 + TS strict, HTML-print (816×1056 sheets, `breakAfter:"page"`, `@media print`), vitest, Playwright layout smoke.

## Global Constraints

- Voice: plain, mechanism-first, no costume (no "unlock/fidelity/lossy/faithful" as vocabulary reaching), NO em dashes, no asserted conclusions.
- Legal: capability + conditional only; never "Abridge causes/guarantees"; every dollar ties to what the record supports.
- Math is illustrative, labeled "Illustrative figures. Your own volume and economics are modeled in Explore." and must reconcile.
- Leading signal must causally drive its outcome; note completeness is the universal leading signal; case-mix index and overtime are outcomes, never leading signals.
- Editorial tokens: page `#FDFCFA`, coral `#EA2C00` (money/accent only), hairline `#E8E2DA`, `font-abridge` headlines, Manrope body.
- tsc `--noEmit` 0 errors + `npx vitest run` green + `npm run build` succeeds + `npm run layout:smoke` green after every task.
- Visual/content source of truth: the approved mockup content is fully captured in the data module below and in `docs/superpowers/specs/2026-08-02-methodology-pdf-design.md`. Match the editorial patterns in `client/src/components/explore/ExploreEditorialPdf.tsx`.

---

### Task 1: Methodology content data module

**Files:**
- Create: `client/src/lib/methodologyContent.ts`
- Test: `client/src/__tests__/methodologyContent.test.ts`

**Interfaces:**
- Produces:
  - `type MethodologyCareSetting = "outpatient" | "ed" | "inpatient" | "nursing"`
  - `interface MethodologyMathLine { name: string; formula: string; value: number }`
  - `interface MethodologyChainStep { n: string; title: string; desc: string }`
  - `interface MethodologyAttainStep { title: string; desc: string }`
  - `interface MethodologySetting { id; label; unit; lever; leverBlurb; dominantLever; recordChanges; comparisonSignals; comparisonOutcomes; chain: MethodologyChainStep[]; leadingSignals: string[]; laggingOutcomes: string[]; math: MethodologyMathLine[]; attain: MethodologyAttainStep[]; proofNote: string }`
  - `const METHODOLOGY_SETTINGS: MethodologySetting[]` (order: outpatient, ed, inpatient, nursing)
  - `const METHODOLOGY_ORDER: MethodologyCareSetting[]`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/__tests__/methodologyContent.test.ts
import { describe, it, expect } from "vitest";
import { METHODOLOGY_SETTINGS, METHODOLOGY_ORDER } from "@/lib/methodologyContent";

// Parse an illustrative formula ("248,000 × 5% × $33.40 × 90% realization")
// into its numeric operands and multiply them. Mirrors the exploreNarrative
// reconciliation approach: split on ×, strip $ and commas, treat % as /100,
// ignore trailing words.
function product(formula: string): number {
  const tokens = formula.split("×").map((t) => t.trim());
  return tokens.reduce((acc, tok) => {
    const m = tok.match(/-?[\d,]+(?:\.\d+)?%?/);
    if (!m) return acc;
    const raw = m[0].replace(/,/g, "");
    const n = raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
    return Number.isNaN(n) ? acc : acc * n;
  }, 1);
}

describe("methodology content", () => {
  it("has all four settings in canonical order", () => {
    expect(METHODOLOGY_ORDER).toEqual(["outpatient", "ed", "inpatient", "nursing"]);
    expect(METHODOLOGY_SETTINGS.map((s) => s.id)).toEqual(METHODOLOGY_ORDER);
  });

  it("every setting is fully shaped (chain=3, signals=3, outcomes=3, attain=3, math>=1)", () => {
    for (const s of METHODOLOGY_SETTINGS) {
      expect(s.chain.length, `${s.id} chain`).toBe(3);
      expect(s.leadingSignals.length, `${s.id} signals`).toBe(3);
      expect(s.laggingOutcomes.length, `${s.id} outcomes`).toBe(3);
      expect(s.attain.length, `${s.id} attain`).toBe(3);
      expect(s.math.length, `${s.id} math`).toBeGreaterThanOrEqual(1);
      expect(s.lever.length).toBeGreaterThan(0);
    }
  });

  it("every illustrative formula multiplies to its stated value (reconciles)", () => {
    for (const s of METHODOLOGY_SETTINGS) {
      for (const line of s.math) {
        expect(
          Math.abs(product(line.formula) - line.value),
          `${s.id} / ${line.name}: ${line.formula} != ${line.value}`,
        ).toBeLessThanOrEqual(Math.max(50, line.value * 0.005));
      }
    }
  });

  it("outpatient carries the locked, validated figures", () => {
    const op = METHODOLOGY_SETTINGS.find((s) => s.id === "outpatient")!;
    const names = op.math.map((m) => m.name);
    expect(names).toContain("wRVU capture");
    expect(op.math.find((m) => m.name === "wRVU capture")!.value).toBe(372744);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run client/src/__tests__/methodologyContent.test.ts`
Expected: FAIL (module not found / exports missing).

- [ ] **Step 3: Write the data module**

```ts
// client/src/lib/methodologyContent.ts
export type MethodologyCareSetting = "outpatient" | "ed" | "inpatient" | "nursing";

export interface MethodologyMathLine { name: string; formula: string; value: number }
export interface MethodologyChainStep { n: string; title: string; desc: string }
export interface MethodologyAttainStep { title: string; desc: string }

export interface MethodologySetting {
  id: MethodologyCareSetting;
  label: string;
  unit: string;               // "per visit"
  lever: string;              // "Volume is the lever."
  leverBlurb: string;         // lead under the headline
  dominantLever: string;      // comparison cell
  recordChanges: string;      // comparison cell
  comparisonSignals: string;  // condensed for the matrix
  comparisonOutcomes: string; // condensed for the matrix
  chain: MethodologyChainStep[];
  leadingSignals: string[];
  laggingOutcomes: string[];
  math: MethodologyMathLine[];
  attain: MethodologyAttainStep[];
  proofNote: string;
}

export const METHODOLOGY_ORDER: MethodologyCareSetting[] = ["outpatient", "ed", "inpatient", "nursing"];

export const METHODOLOGY_SETTINGS: MethodologySetting[] = [
  {
    id: "outpatient",
    label: "Outpatient",
    unit: "per visit",
    lever: "Volume is the lever.",
    leverBlurb:
      "The highest-volume setting, where a small gain on every visit compounds into the largest dollar case and the most clinician time to give back.",
    dominantLever: "Volume × margin. The highest-volume setting; small per-visit gains compound.",
    recordChanges: "The coded acuity of every visit (E/M level, chronic conditions) and time returned.",
    comparisonSignals: "Note completeness, conditions surfaced per visit, time in note.",
    comparisonOutcomes: "Captured wRVUs, recaptured HCCs, reopened visit access.",
    chain: [
      { n: "01 · The record changes", title: "A complete note, at the point of care", desc: "The visit is captured as delivered, not reconstructed from memory hours later." },
      { n: "02 · The mechanism", title: "Acuity is coded; time is returned", desc: "It supports the E/M level, surfaces conditions, and returns charting hours." },
      { n: "03 · The dollar", title: "Earned revenue, and added access", desc: "wRVUs and HCCs thin notes left behind get captured; reopened slots add margin. Counted once." },
    ],
    leadingSignals: ["Note completeness ↑", "Conditions surfaced per visit ↑", "Time in note, per provider ↓"],
    laggingOutcomes: ["Captured wRVUs against baseline ↑", "HCC capture completeness ↑", "Reopened visit access ↑"],
    math: [
      { name: "wRVU capture", formula: "248,000 wRVUs × 5% lift × $33.40 /wRVU × 90% realization", value: 372744 },
      { name: "HCC recapture", formula: "18,000 members × 0.125 HCC/member × $283 /HCC × 50% realization", value: 318375 },
      { name: "Patient access", formula: "2,334 added visits × $220 margin/visit", value: 513480 },
    ],
    attain: [
      { title: "Code to what the note documents", desc: "A complete record supports the level of service and the conditions addressed. Where coding works to that record, the wRVUs and HCCs you earned get captured." },
      { title: "Book the hours it returns", desc: "Returned charting time becomes access only once it is scheduled. Booked as visits, it turns into margin." },
      { title: "Keep every claim to the record", desc: "Nothing is coded beyond what the record supports, and the lift is measured against your own baseline. Defensible, and yours." },
    ],
    proofNote: "Documentation quality is tracked as proof that protects the revenue above: care-gap closure, HEDIS/Stars, denial defensibility. It leads the dollars and is never added to the total.",
  },
  {
    id: "ed",
    label: "Emergency",
    unit: "per encounter",
    lever: "Speed is the lever.",
    leverBlurb:
      "A throughput-constrained setting where revenue walks out the door, and a complete note both protects the level and keeps the department moving.",
    dominantLever: "Speed under pressure. Throughput-constrained; revenue walks out the door.",
    recordChanges: "A defensible E/M level and a note that keeps the department moving.",
    comparisonSignals: "Note completeness, charting time per patient.",
    comparisonOutcomes: "E/M level accuracy, fewer patients left without being seen.",
    chain: [
      { n: "01 · The record changes", title: "A complete note, in real time", desc: "The visit is documented as it happens, even under ED pressure." },
      { n: "02 · The mechanism", title: "Level supported; throughput protected", desc: "The note supports the E/M level and shortens charting, so the provider reaches the next patient." },
      { n: "03 · The dollar", title: "Coded acuity, and revenue that stays", desc: "E/M levels reflect the care delivered; fewer patients leave before being seen." },
    ],
    leadingSignals: ["Note completeness ↑", "Charting time per patient ↓", "Chart closed before end of shift ↑"],
    laggingOutcomes: ["E/M level accuracy ↑", "Fewer patients left without being seen ↓", "Door-to-provider time ↓"],
    math: [
      { name: "E/M level coding", formula: "264,000 ED visits × 3% coded to a higher supported level × $30 margin", value: 237600 },
      { name: "Throughput & LWBS", formula: "264,000 visits × 0.5% fewer left without being seen × $200 margin/visit", value: 264000 },
    ],
    attain: [
      { title: "Code to the documented level", desc: "A complete note supports the E/M level the visit warranted. Where coding works to that record, the coded acuity reflects the care delivered." },
      { title: "Convert returned time to throughput", desc: "Charting time returned means providers reach the next patient sooner. Where that happens, fewer patients leave before being seen." },
      { title: "Keep every claim to the record", desc: "Nothing is coded beyond what the note supports, measured against your own baseline. Defensible, and yours." },
    ],
    proofNote: "Safety and experience signals (door-to-provider time, LWBS) are tracked as proof and kept out of the dollar case.",
  },
  {
    id: "inpatient",
    label: "Inpatient",
    unit: "per discharge",
    lever: "Acuity is the lever.",
    leverBlurb:
      "Few, high-value encounters where case-mix is everything, and a complete note supports the codes and the level of care a complex stay warrants.",
    dominantLever: "Acuity on complex stays. Few, high-value encounters; case-mix is everything.",
    recordChanges: "Complete case-mix and the support for the status a stay warrants.",
    comparisonSignals: "Note completeness, CDI query burden.",
    comparisonOutcomes: "Case-mix (DRG) accuracy, observation-status defense.",
    chain: [
      { n: "01 · The record changes", title: "A complete note across the stay", desc: "The full clinical picture of a complex admission is captured." },
      { n: "02 · The mechanism", title: "Case-mix and status, supported", desc: "The note supports the codes and the level of care the stay warrants." },
      { n: "03 · The dollar", title: "Accurate DRG, defended status", desc: "Case-mix reflects true acuity; observation downgrades are defensible." },
    ],
    leadingSignals: ["Note completeness ↑", "CDI query burden ↓", "Documentation turnaround ↓"],
    laggingOutcomes: ["Case-mix (DRG) accuracy ↑", "Observation-status defense ↑", "Case-mix index trend ↑"],
    math: [
      { name: "DRG / case-mix accuracy", formula: "12,000 discharges × 3% more accurate case-mix × $1,000 margin", value: 360000 },
      { name: "Observation-status defense", formula: "2,000 status reviews × 20% defended × $1,000 margin", value: 400000 },
    ],
    attain: [
      { title: "Code to the documented acuity", desc: "CDI and coding work the complete note, so case-mix reflects the stay actually delivered." },
      { title: "Defend status with the record", desc: "Where the note supports inpatient status, observation downgrades are appealable on the documentation." },
      { title: "Keep every claim to the record", desc: "Nothing is coded beyond what the note supports, measured against your own baseline. Defensible, and yours." },
    ],
    proofNote: "Case-mix index trend and query metrics are tracked as proof alongside the dollar case, not added to it.",
  },
  {
    id: "nursing",
    label: "Nursing",
    unit: "per patient-day",
    lever: "Time is the lever.",
    leverBlurb:
      "A mostly non-billing setting where the value is hours returned to the bedside and harm avoided. Revenue is the proof layer, not the point.",
    dominantLever: "Time at the bedside & safety. Mostly non-billing; the value is hours and harm avoided.",
    recordChanges: "Flowsheet completeness and hours returned from charting.",
    comparisonSignals: "Flowsheet completeness, time in documentation.",
    comparisonOutcomes: "Returned bedside time, overtime down, safety signals (revenue is the proof layer).",
    chain: [
      { n: "01 · The record changes", title: "Flowsheets complete, in real time", desc: "Documentation is captured at the bedside, not caught up on later." },
      { n: "02 · The mechanism", title: "Hours returned; risks surfaced", desc: "Charting time returns to care, and safety-relevant findings surface in the record." },
      { n: "03 · The dollar", title: "Time at the bedside, safety as proof", desc: "Returned hours go to patients; safety signals are tracked, not dollarized." },
    ],
    leadingSignals: ["Flowsheet completeness ↑", "Time in documentation ↓", "Charting after shift ↓"],
    laggingOutcomes: ["Returned bedside time ↑", "Overtime hours ↓", "Safety signals tracked as proof"],
    math: [
      { name: "Overtime avoided", formula: "400 nurses × 0.5 overtime hour/week × $52 /hour × 46 weeks", value: 478400 },
    ],
    attain: [
      { title: "Return the hours to the bedside", desc: "Documentation time saved becomes care time where it is protected, not backfilled with new tasks." },
      { title: "Track safety as proof, not dollars", desc: "Falls, HAPI, and other safety signals are surfaced in the record and tracked, deliberately out of the dollar case." },
      { title: "Keep every claim to the record", desc: "Only hours the documentation actually returns are counted, measured against your own baseline. Defensible, and yours." },
    ],
    proofNote: "In nursing, revenue and safety are the proof layer. The dollar case is the time and premium labor a lighter documentation load returns.",
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run client/src/__tests__/methodologyContent.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/methodologyContent.ts client/src/__tests__/methodologyContent.test.ts
git commit -m "Methodology PDF: content data module (4 settings, reconciling illustrative math)"
```

---

### Task 2: The methodology PDF document component

**Files:**
- Create: `client/src/components/methodology/MethodologyEditorialPdf.tsx`
- Test: `client/src/__tests__/methodologyEditorialPdf.test.tsx`

**Interfaces:**
- Consumes: `METHODOLOGY_SETTINGS`, `METHODOLOGY_ORDER`, types from `@/lib/methodologyContent`.
- Produces: `export default function MethodologyEditorialPdfDocument(): JSX.Element` — a self-contained document (it reads only the static content module, no props/state).

**Build guidance (match `client/src/components/explore/ExploreEditorialPdf.tsx`):**
- Use the same sheet scaffold: a `<style>` block scoped under a root class with `.sheet { width:816px; height:1056px; ... }` and `.sheet:not(:last-child){ break-after:page }`, editorial tokens from Global Constraints.
- Pages, in order:
  1. **Cover** — reuse the shared cover approach used by the other editorial PDFs (`client/src/components/pdf/PDFCoverPage.tsx` or the inline `ReportCover` pattern in `ExploreEditorialPdf.tsx`); title "The Methodology", subtitle "How ambient documentation creates value".
  2. **The record** — headline "The note is written from memory." (coral on "memory"), the leverBlurb-style lead (static, from the spec), the two-card fidelity graphic (left "What there was time to type" neutral greys ~11 ragged lines; right "What actually happened" coral+tints ~11 near-full lines; arrow between), caption "The same visit, recorded two ways. Every number in this document comes from closing that gap.", and the floor strip "What we can measure today · the floor, not the ceiling" with Revenue/Capacity/Workforce/Quality cells (static copy from the spec). Size the graphic to fill so the gap above the floor strip is small.
  3. **The comparison** — headline "The same record. Four economics.", a 5-column table (Setting[+unit] · dominantLever · recordChanges · comparisonSignals · comparisonOutcomes) iterating `METHODOLOGY_SETTINGS`, plus the read-down note.
  4. **Four chapters** — iterate `METHODOLOGY_SETTINGS`; each chapter is one sheet: eyebrow "Setting N of 4 · <label>", headline `s.lever`, `s.leverBlurb`, a 3-card causal chain from `s.chain`, two cards "The signal you see first · weeks" (`s.leadingSignals`) and "The outcome it opens · quarters" (`s.laggingOutcomes`), a "The math, illustrated" list from `s.math` (formula muted, value coral), and a "How you attain it" 3-step row from `s.attain` (coral header, no top hairline). Footer "Illustrative figures. Your own volume and economics are modeled in Explore."
  5. **The attainment close** — "The number becomes real when you measure it": baseline → signals → review → act, pointing to Explore / Measure / Attain (static copy).
- All copy must obey the voice + legal doctrine (Global Constraints). No em dashes anywhere.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/__tests__/methodologyEditorialPdf.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MethodologyEditorialPdfDocument from "@/components/methodology/MethodologyEditorialPdf";

describe("Methodology PDF document", () => {
  const html = renderToStaticMarkup(<MethodologyEditorialPdfDocument />);

  it("renders the opening, comparison, all four chapters, and no NaN", () => {
    expect(html).toContain("The note is written");
    expect(html).toContain("The same record");
    expect(html).toContain("Volume is the lever.");
    expect(html).toContain("Speed is the lever.");
    expect(html).toContain("Acuity is the lever.");
    expect(html).toContain("Time is the lever.");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("shows illustrative math values and the illustrative-figures footer", () => {
    expect(html).toContain("Illustrative figures");
    expect(html).toContain("$373K"); // wRVU capture rounded
  });

  it("carries no em dash in the rendered copy", () => {
    expect(html).not.toContain("—");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run client/src/__tests__/methodologyEditorialPdf.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `MethodologyEditorialPdf.tsx`** per the build guidance above. Use a money formatter that rounds to `$NNNk`/`$N.NNM` (copy the `fmtShort` helper style from `ExploreEditorialPdf.tsx`). Ensure `$373K` appears (372744 → "$373K").

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run client/src/__tests__/methodologyEditorialPdf.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/methodology/MethodologyEditorialPdf.tsx client/src/__tests__/methodologyEditorialPdf.test.tsx
git commit -m "Methodology PDF: editorial HTML-print document (opening, comparison, 4 chapters, close)"
```

---

### Task 3: Route + App.tsx registration

**Files:**
- Create: `client/src/components/methodology/MethodologyEditorialPdfRoute.tsx`
- Modify: `client/src/App.tsx` (add the `?methodpdf=1` branch alongside the existing `appratpdf`/`explorepdf` branches near lines 242-253)

**Interfaces:**
- Consumes: `MethodologyEditorialPdfDocument` (default export, Task 2).
- Produces: `export default function MethodologyEditorialPdfRoute(): JSX.Element` — renders the document; if the URL has `&print=1`, calls `window.print()` once after mount; `&setting=<careSetting>` scrolls the matching chapter into view (via `id={`chapter-${s.id}`}` anchors added in Task 2's chapter render).

**Build guidance:** mirror `client/src/components/explore/ExploreEditorialPdfRoute.tsx` (auto-print on `&print=1`, `useEffect` with a short timeout). Add `id="chapter-<id>"` to each chapter sheet in Task 2 so `&setting=ed` can `scrollIntoView`.

- [ ] **Step 1: Write the failing test** — none (route is a thin wrapper; covered by layout smoke in Task 6). Instead verify the branch compiles.

- [ ] **Step 2: Implement the route** mirroring `ExploreEditorialPdfRoute.tsx`, reading `new URLSearchParams(window.location.search)` for `print` and `setting`.

- [ ] **Step 3: Register in `App.tsx`** — after the `appratpdf` branch:

```tsx
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("methodpdf") === "1") {
  return <MethodologyEditorialPdfRoute />;
}
```
Add the import at the top with the other PDF-route imports.

- [ ] **Step 4: Verify** — `npx tsc --noEmit` (0 errors) and `npm run build` succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/methodology/MethodologyEditorialPdfRoute.tsx client/src/App.tsx
git commit -m "Methodology PDF: ?methodpdf=1 route with auto-print and setting anchor"
```

---

### Task 4: Math foot-test (reconciliation guard)

**Files:**
- Create: `client/src/__tests__/methodologyPdfFooting.test.ts`

**Interfaces:** Consumes `METHODOLOGY_SETTINGS`. (This is a stricter, standalone reconciliation guard beyond Task 1's in-module check, matching the per-tool foot-test pattern e.g. `proformaPdfFooting.test.ts`.)

- [ ] **Step 1: Write the test**

```ts
// client/src/__tests__/methodologyPdfFooting.test.ts
import { describe, it, expect } from "vitest";
import { METHODOLOGY_SETTINGS } from "@/lib/methodologyContent";

function product(formula: string): number {
  return formula.split("×").map((t) => t.trim()).reduce((acc, tok) => {
    const m = tok.match(/-?[\d,]+(?:\.\d+)?%?/);
    if (!m) return acc;
    const raw = m[0].replace(/,/g, "");
    const n = raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
    return Number.isNaN(n) ? acc : acc * n;
  }, 1);
}

describe("Methodology PDF illustrative math foots", () => {
  it("every formula multiplies to its stated value", () => {
    for (const s of METHODOLOGY_SETTINGS) {
      for (const line of s.math) {
        expect(
          Math.abs(product(line.formula) - line.value),
          `${s.id} / ${line.name}`,
        ).toBeLessThanOrEqual(Math.max(50, line.value * 0.005));
      }
    }
  });

  it("nursing's dollar case stays modest and proof-forward (single counted line)", () => {
    const n = METHODOLOGY_SETTINGS.find((s) => s.id === "nursing")!;
    expect(n.math.length).toBe(1);
    expect(n.proofNote.toLowerCase()).toContain("proof");
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run client/src/__tests__/methodologyPdfFooting.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/methodologyPdfFooting.test.ts
git commit -m "Methodology PDF: illustrative-math foot-test"
```

---

### Task 5: Copy guardrail

**Files:**
- Create: `client/src/__tests__/methodologyCopyGuardrails.test.ts`

**Interfaces:** Consumes `scanFiles`, `formatHits` from `./support/copyGuardrail` (existing).

- [ ] **Step 1: Write the test**

```ts
// client/src/__tests__/methodologyCopyGuardrails.test.ts
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { scanFiles, formatHits } from "./support/copyGuardrail";

const CLIENT_SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "lib/methodologyContent.ts",
  "components/methodology/MethodologyEditorialPdf.tsx",
  "components/methodology/MethodologyEditorialPdfRoute.tsx",
];

describe("Methodology COPY guardrails — Legal / brand tripwires", () => {
  it("no em dashes, no causal/guarantee absolutes, no prevents/prevented-by, no credited-to", () => {
    const hits = scanFiles(CLIENT_SRC, FILES);
    expect(hits.length, `Copy guardrail hits (${hits.length}):\n${formatHits(hits)}`).toBe(0);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run client/src/__tests__/methodologyCopyGuardrails.test.ts`. If it flags real hits in the copy written in Tasks 1-2, FIX the copy (not the test), then re-run to PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/__tests__/methodologyCopyGuardrails.test.ts
git commit -m "Methodology PDF: copy guardrail (shared rules)"
```

---

### Task 6: Layout smoke coverage

**Files:**
- Modify: `scripts/layout-smoke.mjs` (add `?methodpdf=1` to `PDF_ROUTES` near line 137; register its footer format in the sparse `footRe` if the document uses a distinct footer)

**Interfaces:** none.

- [ ] **Step 1: Add the route** to `PDF_ROUTES`:

```js
{ url: "/?methodpdf=1", label: "Methodology PDF", minPages: 6 },
```

- [ ] **Step 2: Footer** — the Methodology document should use the running footer `Abridge · NN` (page number) so the existing `footRe` (`/^abridge · (page |financial proforma · )?\d/i`) already matches; if a different footer string is chosen in Task 2, extend `footRe` accordingly.

- [ ] **Step 3: Run** — start the dev server (`npx vite --port 5199 --strictPort`), then `node scripts/layout-smoke.mjs`. Expected: passes for all PDFs including "Methodology PDF" (no bleed, no overflow, >= 6 pages, no NaN, no sparse page > 330px). Fix any bleed/overflow in `MethodologyEditorialPdf.tsx` until green.

- [ ] **Step 4: Commit**

```bash
git add scripts/layout-smoke.mjs
git commit -m "Methodology PDF: layout-smoke coverage"
```

---

### Task 7: Wire the on-screen methodology downloads to the new PDF

**Files:**
- Modify: `client/src/pages/methodology/MethodologyOutpatient.tsx` (handler near line 1234)
- Modify: `client/src/pages/methodology/MethodologyED.tsx` (near line 1216)
- Modify: `client/src/pages/methodology/MethodologyInpatient.tsx` (near line 1186)
- Modify: `client/src/pages/methodology/MethodologyNursing.tsx` (near line 1214)

**Interfaces:** none new. Each page's `handleExportPDF` currently calls `generateMethodologyPDF("<setting>")`. Replace with opening the new route.

- [ ] **Step 1:** In each page, replace the body of `handleExportPDF` with:

```tsx
const handleExportPDF = () => {
  window.open(`?methodpdf=1&setting=<setting>&print=1`, "_blank");
};
```
(substitute `<setting>` per file: `outpatient`, `ed`, `inpatient`, `nursing`) and remove the now-unused `generateMethodologyPDF` import and the `isExporting`/try-catch scaffolding only if it becomes unused (leave the button's disabled state wiring intact if other code references it).

- [ ] **Step 2: Verify** — `npx tsc --noEmit` (0 errors), `npm run build` succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/methodology/Methodology*.tsx
git commit -m "Methodology screens: download the new editorial PDF (deep-linked per setting)"
```

---

### Task 8: Retire the react-pdf methodology export

**Files:**
- Modify: `client/src/components/explore/ExploreNarrativePDF.tsx:17` (it imports `settingData as methodologySettingData` from `@/lib/methodology-pdf-export`)
- Delete or trim: `client/src/lib/methodology-pdf-export.tsx`

**Interfaces:** `settingData` and its type must survive for `ExploreNarrativePDF`.

- [ ] **Step 1:** Determine what `ExploreNarrativePDF` uses from `methodologySettingData` (grep for `methodologySettingData` in that file). Move the `settingData` object and its `SettingPDFData`/`MethodologyCareSetting` types into a small data-only module `client/src/lib/methodologySettingData.ts` (no `@react-pdf` imports), and repoint the `ExploreNarrativePDF` import to it.

- [ ] **Step 2:** Delete `client/src/lib/methodology-pdf-export.tsx` (the react-pdf `Document` + `generateMethodologyPDF`) now that no page imports `generateMethodologyPDF` (verified in Task 7) and `settingData` moved.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` (0 errors), `npx vitest run` fully green (watch `exploreNarrativePdfSnapshot.test.tsx` / `exploreEngineParity.test.ts` which touch methodology data), `npm run build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Retire react-pdf methodology export; keep settingData for ExploreNarrativePDF"
```

---

## Final verification (after all tasks)

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → all green (new: methodologyContent, methodologyEditorialPdf, methodologyPdfFooting, methodologyCopyGuardrails)
- `npm run build` → succeeds
- `npm run layout:smoke` → green including "Methodology PDF"
- Manual (Brad, on Replit): open `?methodpdf=1`, review all pages; open each methodology screen's download and confirm it opens the right chapter.
