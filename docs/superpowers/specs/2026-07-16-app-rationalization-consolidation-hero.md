# App Rationalization — Consolidation Page Hero (future-stack, magnitude bars)

**Date:** 2026-07-16
**Status:** Design locked (visual companion), pending spec review
**Feature:** Rebuild the Consolidation step so it reads as "your future tech stack on Abridge," driven by spend magnitude, at a genuinely premium bar.

---

## 1. Intent

The hero of this page must make a health-system exec feel, in two seconds: *"most of my scattered tools collapse onto Abridge as one platform, and here's the handful that remain — and look what I save."* Abridge is becoming the platform; we are showing them their future stack. The consolidation is driven by the **magnitude of spend**, not tool names. The money is the proof underneath, not the lead.

This must feel incredible and on-brand. No AI slop, no cheap effects (the earlier glow/gradient experiment is exactly what to avoid). Craft is a first-class requirement of this spec (see §6).

## 2. Locked page layout

The Consolidation step, top to bottom:

1. **Snaky chart (movement only, no dollars).** The existing two-sink `ConsolidationFlow`, with every dollar figure removed. It shows *how* things consolidate (ribbons sized by spend, tool names, coverage %), not amounts.
2. **The Consolidation section (money text stacked with the before/after magnitude bars).** The editorial money lines plus two stacked horizontal bars: "Today · fragmented" and "On Abridge." Segments are sized by spend; the shade carries the consolidation. Hoverable.
3. **"Why Abridge can take these on" rationale** — the existing Coming soon placeholder.

The old standalone `ConsolidationLedger` (money lines + vertical proportion bar) is replaced by section 2 (its money lines are kept; its vertical bar is superseded by the before/after bars).

## 3. Snaky chart changes (movement only)

In `client/src/components/forecast/ConsolidationFlow.tsx`, remove all dollar text; keep everything else (ribbons, hover-isolate, names, %):

- Source rows: drop the `· $spend` from the subline (keep the category label). Keep the loud coverage `%`.
- Abridge sink: label reads **"Abridge"** only (remove the `$toAbridge` amount).
- Stays sink: label reads **"Stays"** only (remove the `$stays` amount).
- Ribbons and their thickness (spend magnitude) are unchanged — magnitude stays visual, just unlabeled.

## 4. The Consolidation section (money + before/after bars)

New component `client/src/components/forecast/ConsolidationBars.tsx`, rendered in the flow between the snaky chart and the Coming soon panel.

**Header (money text, stacked with the bars):**
- **"The Consolidation"** heading in the Abridge display font (`.font-abridge`, uppercase).
- Net figure as the hero: **Net savings / yr** = `$316K` (coral, `AnimatedValue` count-up). "Net cost / yr" in neutral ink if the Abridge price exceeds the sunset.
- Supporting line: **`$620K today → $304K on Abridge`** (before/after money; `$304K = Abridge price + stays`, so the price is carried here, not drawn as a bar segment).

**Two stacked horizontal bars (magnitude of spend):**
- **Today · fragmented — `$stackTotal`.** One bar; a segment per tool, width proportional to that tool's annual spend, colored from a warm taupe ramp (one shade per tool). No names on the bar.
- **On Abridge — `$stackTotal` (same scale/length).** One flat **coral `#EA2C00`** segment sized to the total that sunsets onto Abridge (`$516K`), followed by the residual leftovers broken out **per tool** — each sliver sized by that tool's *stays* amount and colored the **same taupe shade it had in the Today bar**, in the same order. Fully-covered tools leave no sliver.
- The two bars are the same length and aligned so the eye connects "this chunk up here" to "this matching sliver down there," and sees the coral dominance.
- Sub-labels: under the On Abridge bar, `"$516K sunsets onto Abridge"` (left, coral) and `"$104K stays"` (right).

**Hover:**
- Hovering any segment shows a tooltip: for a Today segment, the tool name + its annual spend; for the coral On-Abridge segment, "Sunsets onto Abridge · $516K"; for a residual sliver, the tool name + "$X stays". Segment lifts/brightens subtly on hover. (Names live in hover, they do not drive the resting picture.)

## 5. Data derivation (pure, testable)

Add a pure builder in `client/src/lib/appRationalizationCalc.ts` (reusing `itemRetired`/`itemStays`/`computeTotals`/`computeNet`):

```ts
export interface StackBarTool {
  id: string;
  name: string;       // itemDisplayName
  spend: number;
  sunset: number;     // itemRetired
  stays: number;      // itemStays
}
export interface StackBars {
  stackTotal: number;
  sunset: number;     // total onto Abridge
  stays: number;      // total left over
  tools: StackBarTool[]; // spend-only tools, in the given order
}
export function buildStackBars(items: AppRatItem[]): StackBars;
```

The component derives segment widths as `value / stackTotal` and assigns the taupe ramp by tool index, so the Today segment and its residual sliver share a shade. `computeNet(items, abridgePrice)` continues to supply the money header. Guard: `stackTotal === 0` renders the section's empty state.

## 6. Craft bar (this is the point)

Non-negotiable execution quality:

- **Typography.** Abridge display font on "The Consolidation" only; Manrope everywhere else; `tabular-nums` on every figure; deliberate sizes/weights/tracking — the net savings is the one confident hero number.
- **Bars.** Generous height (~48px), fully rounded ends, crisp 2px white dividers between segments, flat coral (no gradient, no glow), the taupe ramp reused from the roadmap so the section feels of-a-family. Subtle 1px inset border for depth, nothing heavier.
- **Motion (the wow), gated behind `@media (prefers-reduced-motion: no-preference)` with the settled state as the reduced-motion default.** On entrance: the Today bar's segments grow in left-to-right; then the On Abridge bar's coral mass sweeps in and the residual slivers settle — the consolidation should feel like it *happens*. Smooth, physical easing; never flashy or bouncy. The net savings number counts up.
- **Hover.** A real tooltip (not the native title): small, rounded, warm-dark or clean-white with a soft shadow, `tabular-nums`. The hovered segment brightens ~6% and the others dim slightly, echoing the snaky chart's hover-isolate so the two visuals feel connected.
- **Color discipline.** Coral `#EA2C00` only for Abridge/savings; warm taupe ramp for tools/stays; neutral ink for a net cost. No stoplight colors, no status pills, no glow.
- **Spacing & hierarchy.** Real whitespace; the section breathes; the bars are the center of gravity, the money reads as the confident conclusion.

## 7. Files

- Modify: `client/src/components/forecast/ConsolidationFlow.tsx` — strip dollar text (movement only).
- Modify: `client/src/lib/appRationalizationCalc.ts` — add `buildStackBars` (+ `StackBarTool`/`StackBars`).
- Create: `client/src/components/forecast/ConsolidationBars.tsx` — the money header + before/after magnitude bars + hover tooltips + motion.
- Modify: `client/src/pages/forecast/AppRationalizationFlow.tsx` — consolidation step order: `ConsolidationFlow` (movement) → `ConsolidationBars` → Coming soon; remove the old `ConsolidationLedger` usage.
- Remove: `client/src/components/forecast/ConsolidationLedger.tsx` (superseded).
- Test: `client/src/__tests__/appRationalizationCalc.test.ts` (or a new file) — `buildStackBars` totals, per-tool sunset/stays, order, zero-safe.

## 8. Testing

- `buildStackBars`: `stackTotal`/`sunset`/`stays` totals; per-tool `sunset === itemRetired`, `stays === itemStays`; tool order preserved; empty stack → zeros, no tools.
- Money via `computeNet` is already covered.
- The visual, motion, and hover are verified by the user on Replit — this environment cannot render the app.

## 9. Constraints

- No em dashes; user-facing copy uses "sunset" / "Sunsets onto Abridge", never "coverage"; internal fields stay `coveragePct` / `toAbridge`.
- Coral `#EA2C00`, taupe ramp (`#5A5148 … #C6B9A2`), warm neutrals only.
- Same-scale bars (both = `stackTotal`); flat coral; residual slivers color-matched to the Today bar.
- Snaky chart shows no dollars; ribbons/%/names stay.
- Verify each change: `npx tsc --noEmit` (0), `npx vitest run` (green), `npm run build`.

## 10. Decided

- Layout: snaky chart (no $) → consolidation money+bars → coming soon. ✓
- Option 1 bars: flat coral, residual broken out per tool in the Today-bar shades, same scale. ✓
- Money text stacks with the bars; the old standalone ledger is replaced. ✓
- Bars are hoverable (names live in hover, not at rest). ✓
- Craft is a first-class requirement (§6). ✓
