# App Rationalization · Timing Strategy (Cumulative Savings) — Design

**Date:** 2026-07-20
**Status:** proposed (design locked visually via companion mock `aligned-v3.html`; pending decision confirm)

## Goal

Give the consolidation screen a second, toggleable view — **Cumulative savings** — that
tells the *when* of the story: how much a health system saves over time by sunsetting its
legacy tools onto Abridge, and how acting sooner captures more. The waterfall stays as the
default view and tells the *what* (which tools, how much). One card, two views, one toggle.

This replaces the current static "How it rolls out" beat (`RolloutBeat`) with an
interactive timing instrument, and moves per-tool timing OFF the Applications screen
(Applications = what; Consolidation = when).

## Vocabulary (the split)

- **The consolidation** (waterfall) = the *what*. Magnitudes: spend → sunset → stays. Timing-independent.
- **Cumulative savings** (new) = the *when*. A curve of dollars saved over the horizon, with
  per-tool timelines you drag to strategize the sunset schedule.

## The two views

### View A — "The consolidation" (default, unchanged)
The existing `ConsolidationWaterfall`. No changes to its look or math.

### View B — "Cumulative savings" (new: `ConsolidationTiming`)
One instrument, two stacked halves that share an x-axis (Today → end of horizon):

**Top — the aggregate curve** (SVG plot + HTML overlay labels, matching mock `aligned-v3`):
- A coral **"Your plan"** line: cumulative $ saved, where each tool starts saving at its sunset month.
- A dashed muted **"If you moved now"** line: the ceiling, where every tool sunsets at month 0.
- A soft coral shaded area under the plan line.
- Endpoint labels to the right of the plot: ghost "If you moved now $Y" and coral "Your plan $X · captured over N yrs".
- X labels under the baseline: Today, Year 1..N. No y-axis label (state upside, don't scold).

**Bottom — the per-tool levers**, each aligned to the SAME x-axis as the curve:
- Row header: tool name · coral "$spend/yr" · muted capability label.
- A **"Contract ends in [N] mo"** input with a **Months / Date** mode toggle (exec may know
  either). Months mode = numeric months. Date mode = a month picker converted to months from today.
- A right-aligned **"Sunsets [MMM YYYY]"** readout — the derived date of the sunset thumb
  (today + sunsetMonths), so the input (months) and the readout (a date) are never the same value twice.
- A timeline track: faint full base (Today→horizon), a **neutral "still paying" runway** bar
  (Today→sunset; longer contract = longer bar), a **"contract ends" tick** at contractMonths, and a
  **draggable coral sunset thumb** at sunsetMonths (a transparent range input drives it).
- A nudge under the track: "Exit N mo early · $Z sooner" when the sunset is pulled before the contract end.
- A small legend: "Still paying" (neutral bar) · "Sunsets" (coral dot).

Dragging a sunset thumb (or editing a contract) updates that tool's `sunsetMonths` /
`contractMonths` and the aggregate curve re-renders live. Coral means one thing everywhere:
the sunset marker and the savings. The runway is neutral.

Empty state: when no tool has sunset value (`sunset === 0`), show a calm placeholder like the waterfall's.

## Data model changes (`appRationalizationCalc.ts`)

Replace the coarse `when` bucket with two month-denominated fields:

```ts
export interface AppRatItem {
  id: string;
  category: AppRatCategoryId;
  vendorName?: string;
  annualSpend: number;
  coveragePct: number;
  abridgeProduct?: string;
  contractMonths: number;   // months from today until the contract ends (the runway)
  sunsetMonths: number;     // months from today until they sunset it; 0..contractMonths
}
```

- `makeItem(id, category)` seeds `contractMonths: 12, sunsetMonths: 12` (sunset at renewal by default).
- **Remove:** `AppRatWhen`, `AR_WHEN_OPTIONS`, `WHEN_TO_YEAR`, `retirementYear`, `RolloutPhase`,
  `Rollout`, `buildRollout`, `rolloutYearLabel`.

### New calc

```ts
// Monthly $ a tool saves once it has sunset (its annual sunset value spread over 12).
export function toolMonthlySaving(item: AppRatItem): number; // = itemRetired(item)/12

export interface CumulativeTool {
  id: string; name: string; capability: string;
  spend: number; monthlySaving: number;
  contractMonths: number; sunsetMonths: number;
  earlyMonths: number;   // max(0, contractMonths - sunsetMonths)
  earlySaving: number;   // earlyMonths * monthlySaving  (the "act sooner" delta)
}

export interface CumulativeSavings {
  horizonMonths: number;
  tools: CumulativeTool[];   // only tools with monthlySaving > 0
  planTotal: number;         // cumulative saved by horizon under the plan
  nowTotal: number;          // cumulative saved by horizon if all sunset at month 0 (ceiling)
  gap: number;               // nowTotal - planTotal (cost of inaction; shown as upside)
  hasCurve: boolean;         // at least one tool saves
}

export function buildCumulativeSavings(items: AppRatItem[], horizonMonths: number): CumulativeSavings;

// Sampler for the SVG paths. mode "plan" uses each tool's sunsetMonths; "now" uses 0.
export function cumulativeSavedAt(tools: CumulativeTool[], month: number, mode: "plan" | "now"): number;

// Derived sunset date label from months-from-now. from defaults to new Date() (param for tests).
export function sunsetDateLabel(monthsFromNow: number, from?: Date): string; // "Jan 2027" | "now"
```

Math: `planCum(m) = Σ max(0, m - sunsetMonths_i) * monthlySaving_i`;
`nowCum(m) = Σ m * monthlySaving_i` over tools with `monthlySaving > 0`.
`sunsetMonths` is clamped to `[0, contractMonths]`.

## Applications screen changes

- `ArStackRow`: remove the "Comes off" (`when`) `<select>` column entirely. Grid becomes
  `[1fr_120px_220px_130px]` (Application · Annual spend · How much could you displace? · Displaceable).
- `ArApplicationsStep`: drop `"Comes off"` from `COL_HEADERS`; match the grid template.
- `ArAddToolModal`: remove the "When does it sunset?" segmented picker and the `when` state;
  `onConfirm` no longer sets `when`. New tools get the `makeItem` defaults; timing is set on the
  Consolidation screen.

## Consolidation screen changes (`AppRationalizationFlow`)

- Keep the header (title · Export PDF · net-savings hero). Net savings is timing-independent — unchanged.
- Add a segmented **toggle** above the chart: `The consolidation` (default) · `Cumulative savings`.
  White-pill thumb, coral active text (matches the mock).
- Render `ConsolidationWaterfall` or `ConsolidationTiming` per the toggle.
- Remove `RolloutBeat` import + usage (superseded by View B).
- The horizon selector (2–5 yr, default 3) moves into `ConsolidationTiming`'s header; `termYears`
  state stays in the flow and is passed down as `horizonYears` + `onHorizonChange`.
- Keep the "Why Abridge can take these on · Coming soon" placeholder.

## PDF changes (`AppRationalizationPDFExport`)

The leave-behind keeps 2 pages (cover + one content page) and now shows **both** views:
- Keep the `Waterfall` (top).
- Replace the `Rollout` section with a static **Cumulative savings** section: a small SVG of the
  plan vs. "if you moved now" curves with the two endpoint figures, premium and quiet.
- Stack table: the "Timeline" column shows the **sunset date** (`sunsetDateLabel(item.sunsetMonths)`)
  instead of the old when-bucket label. Remove `WHEN_LABEL` / `AR_WHEN_OPTIONS` usage.

## Constraints (global)

- No em dashes anywhere (minus sign "−" is fine). Applies to code comments and CSS too.
- Coral `#EA2C00` is the accent only (sunset marker, plan line, savings) — never flooded.
  "Still paying" runway is neutral taupe (`#9C8F7D`); base `#E4DBCC`; muted `#B4A99B`.
- Abridge display font (`.font-abridge`) on titles/eyebrows only; Manrope UI; `tabular-nums` on all numbers.
- `AnimatedValue` count-ups on headline figures; motion gated behind
  `@media (prefers-reduced-motion: no-preference)` with the settled state as the reduced-motion default.
- Live thousands separators on every number input (`NumberField`).
- Defensible copy: "sunset" / "consolidates onto Abridge", never "coverage"; state upside, never scold.
- Shared x-geometry: `ConsolidationTiming` defines one `xPct(month)` used by both the curve overlay
  labels and every per-tool timeline track so they align to the same axis ("one instrument").

## Testing

Env cannot render the app; math is unit-tested, the feel is verified by Brad on Replit.

- `appRationalizationCumulative.test.ts` (new): `toolMonthlySaving`, `buildCumulativeSavings`
  (planTotal/nowTotal/gap, filters `monthlySaving===0`, sunset clamp to `[0,contractMonths]`,
  earlyMonths/earlySaving), `cumulativeSavedAt` at boundary months, `sunsetDateLabel` with a fixed `from`.
- Update `appRationalizationAddFlow.test.ts`: drop `when`; assert `contractMonths`/`sunsetMonths`
  defaults; replace `buildRollout` assertions with `buildCumulativeSavings`.
- Update `appRationalizationPdfSmoke.test.tsx`: drop `when`/`AppRatWhen`; the smoke test recurses the
  PDF component tree and asserts the cumulative section + stack rows render.
- Delete `appRationalizationRetirementYear.test.ts` and `appRationalizationRollout.test.ts`.
- Existing `appRationalizationStackBars/Net/Calc` tests stay green (they don't assert `when`).
- Verify each task: `npx tsc --noEmit -p tsconfig.json` (0), `npx vitest run` (green), `npm run build`.

## Task order (each stays green)

1. **Calc**: add fields + new functions, remove `when`/rollout machinery, fix `makeItem`. Add
   cumulative tests; delete rollout/retirementYear tests; update addFlow test.
2. **Applications**: strip "Comes off" from `ArStackRow`, `ArApplicationsStep`, `ArAddToolModal`.
3. **`ConsolidationTiming`** (new, unused component): curve + per-tool timelines + toggle-ready.
4. **Flow rewire**: add the toggle, mount waterfall/timing, remove `RolloutBeat`; delete
   `RolloutBeat.tsx`.
5. **PDF**: replace `Rollout` with the cumulative section; sunset-date timeline column; update smoke test.
