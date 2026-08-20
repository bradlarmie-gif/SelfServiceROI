# App Rationalization — "Applications" Redesign

**Date:** 2026-07-15
**Status:** Design approved, pending spec review
**Feature:** App Rationalization (4th Forecast option) — the Applications entry experience and the data model that feeds Consolidation and "The change."

---

## 1. Problem

The current Applications screen has four issues the user called out:

1. A separate **Setup** page (org name + contract term) is friction before the real work.
2. The **black "Stack today" panel** on the right feels random and disconnected from the stack.
3. The **command search gives no click feedback** — you can't tell if you selected something once or several times.
4. **Command search and the stack cards are two disjoint zones**: you click in the search up top, then trek down to fill big cards. Selecting an app and entering its details should feel like one motion.

The command search + Lucide icons are loved and stay. Separately, the coverage lever is mislabeled: it says "Abridge covers," but it should ask the customer **how much of a tool they think they could displace, and over what time period**.

## 2. Goals

- Remove the Setup page; capture org name inline on Applications, term inline on "The change."
- Make picking an app and entering its details one continuous, spreadsheet-fast motion.
- Give unmistakable click feedback in the command search.
- Replace the black panel with a slim total bar docked to the stack.
- Reframe the per-app lever to the customer's judgment: **How much could you displace? (%)** and **When (contract years)**. Drop absolute renewal dates.
- Keep it genuinely on-brand: Abridge display font on titles, Manrope UI, coral `#EA2C00` + warm neutrals only, super clean.

## 3. Non-goals

- No change to the Consolidation two-sink visual or the roadmap chart's visual language (only their inputs change where noted).
- No PDF export work (still deferred).
- No change to the other three Forecast options.

## 4. Flow structure

The flow drops from four steps to **three**:

`Applications → Consolidation → The change`

- **Org name** moves to a small field in the Applications header (top-right).
- **Contract term** moves to an inline control on "The change," directly above the roadmap bars (it only sets how many years the roadmap shows).
- The Setup step (`ArSetupStep.tsx`) is deleted.
- Header stepper (`UnifiedHeader`): `currentStep` 1–3, `totalSteps={3}`, `stepLabels = ["Applications", "Consolidation", "The change"]`.
- `AppRationalizationFlow` opens on `"applications"`. `orgName` and `termYears` remain flow-level state; `orgName` is edited in the Applications header, `termYears` on the change step.

## 5. Applications screen (Direction A — inline rows)

One continuous surface, top to bottom:

1. **Header** — title "Applications" in the Abridge display font (`.font-abridge`, uppercase), a one-line subtitle in Manrope, and an **Organization** field (small labeled input) in the top-right corner bound to `orgName`.
2. **Command search** — unchanged hero (`ArCommandSearch`): coral-outlined input with the persistent results dropdown, Lucide category icons, keyboard nav, "add custom." Stays exactly as loved.
3. **Click feedback** — when an app is added:
   - the **"Your stack · N added"** count increments visibly, and
   - the **newly added row mounts with a brief coral highlight** (box-shadow ring) that fades over ~1.2s, gated behind `@media (prefers-reduced-motion: no-preference)` (reduced-motion shows the row already settled).
4. **Column header row** — subtle uppercase micro-labels so the row reads: `Application · Annual spend · How much could you displace? · Over · Displaceable`.
5. **Inline stack rows** — one editable row per app (new component `ArStackRow`, replacing the big `ArStackCard`). Each row, left to right:
   - **Application**: Lucide category icon + an inline-editable **vendor name** (bold; defaults to the category label until typed) with the category as subtext.
   - **Annual spend**: `NumberField` with a `$` prefix.
   - **How much could you displace?**: coral `Slider` (0–100, step 5) + bold `%`.
   - **Over**: a small select — **This year · Next year · Year 3 · Not sure**.
   - **Displaceable**: right-aligned result, `$X displaceable` with `$Y stays` beneath.
   - a quiet remove (×) control.
6. **Slim total bar** (replaces the black panel) — docked under the stack: `Stack today $X / yr`, a thin two-segment bar (displaceable coral / stays taupe), `$X displaceable · $Y stays`, and the **"See the consolidation →"** button (disabled until ≥1 app).
7. **Empty state** — before any app is added, the command search is prominent and the dropdown browses all capabilities (as today), with a one-line hint; no stack rows, no total bar.

**Removed from the row:** the old **"Covered by (Abridge)"** text field. It is Abridge-side noise in a dense row, and naming a competitor product Abridge "replaces" is a defensible-claims risk. The Abridge-product story lives in the consolidation/why content, not the data-entry row.

## 6. The two per-app levers + data model

Each app carries exactly two judgment levers (plus spend):

- **How much could you displace?** — a share, `0–100%`. Internally this remains `coveragePct` on `AppRatItem` to limit churn, but **every user-facing string uses "displace," never "coverage" or "Abridge covers."**
- **When** — a contract-year bucket, replacing the old absolute `renewal` string.

### New type and mapping

```ts
type AppRatWhen = "thisYear" | "nextYear" | "year3" | "notSure";
```

`AppRatItem` change:
- **Add** `when: AppRatWhen`.
- **Remove** `renewal?: string` and `transitionMonths` (confirm `transitionMonths` is unused in App Rationalization during implementation; if referenced anywhere, remove those references too).
- `makeItem` defaults `when: "thisYear"` (a freshly added app shows movement on the roadmap immediately; the rep adjusts per app).

`retirementYear` is rewritten to depend on `when`, not a renewal string. Signature simplifies to drop the calendar `currentYear` argument:

```ts
// returns a 1-based contract year, clamped to [1, termYears]
function retirementYear(item: AppRatItem, termYears: number): number
```

Mapping (then clamp to `[1, termYears]`):
- `thisYear` → 1
- `nextYear` → 2
- `year3` → 3
- `notSure` → `termYears` (lands in the final year — never over-promises early displacement)

## 7. Downstream pages

**Consolidation (end-state snapshot):** unchanged. It uses `spend × coveragePct` (`itemRetired` / `itemStays` / `computeTotals`). Timing does not affect it. It keeps its "to Abridge / stays" language (this is the pitch's destination; only the *entry* lever is reframed to the customer's "displace" view).

**The change (roadmap):** `computeRoadmap(items, termYears)` uses the new `retirementYear(item, termYears)` to place each app's displaceable dollars on a contract year. `notSure` items land in the final year. The roadmap "read" text and per-year deltas follow from this unchanged in structure. Add an **inline contract-term control** above the bars (small select, options 2–5 years, default 3) bound to `termYears`; changing it re-lays the roadmap.

## 8. Files

- **Delete:** `client/src/pages/forecast/appRationalization/ArSetupStep.tsx`; `client/src/pages/forecast/appRationalization/ArStackCard.tsx`.
- **Create:** `client/src/pages/forecast/appRationalization/ArStackRow.tsx` (inline editable row).
- **Modify:**
  - `client/src/lib/appRationalizationCalc.ts` — type `AppRatWhen`; `AppRatItem` (`+when`, `-renewal`, `-transitionMonths`); `makeItem` default; rewrite `retirementYear`.
  - `client/src/lib/appRationalizationRoadmap.ts` — `computeRoadmap` uses the new `retirementYear`; drop `currentYear` plumbing.
  - `client/src/pages/forecast/AppRationalizationFlow.tsx` — three-step flow; org name in Applications header; term on the change step; remove Setup wiring.
  - `client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx` — new layout (header + org field, hero search, inline rows, slim total bar); remove black panel; render `ArStackRow`.
  - `client/src/pages/forecast/appRationalization/ArCommandSearch.tsx` — no structural change; confirm it still calls `onSelect` so the row-glow/count feedback fires in the parent.
  - `client/src/components/forecast/RoadmapChart.tsx` (or the change-step container in the flow) — inline term control above the bars.
- **Tests:** update `appRationalizationCalc.test.ts`, `appRationalizationRetirementYear.test.ts` (now `when`-based), `appRationalizationRoadmap.test.ts`.

## 9. Testing

- **`retirementYear`**: each `when` maps to the right contract year; `notSure` → `termYears`; all results clamp to `[1, termYears]` (e.g., `year3` with `termYears = 2` → 2).
- **`computeRoadmap`**: apps land in the expected snapshot years by `when`; totals/deltas sum correctly; `notSure` apps appear in the final year.
- **`computeTotals` / `itemRetired` / `itemStays`**: unchanged behavior (regression guard that the consolidation math still keys off `coveragePct`).
- UI (Applications layout, row glow, term control) verified visually on Replit — this environment cannot render the app.

## 10. Copy & brand constraints

- No em dashes; plain, defensible copy (see the defensible-claims doctrine).
- User-facing lever copy uses **"displace,"** never "coverage" / "Abridge covers."
- Titles in the Abridge display font on every App Rationalization screen; Manrope UI; coral `#EA2C00` + warm neutrals only; no stoplight colors, no status pills.
- Animations gated behind `prefers-reduced-motion`, with the reduced-motion state being the final settled view.

## 11. Decided (previously open)

- Term lives on "The change" (not the Applications header). ✓
- "When" wording: **This year · Next year · Year 3 · Not sure.** ✓
- Drop absolute renewal dates entirely. ✓
- Drop the "Covered by (Abridge)" row field. ✓
- Interaction model: **Direction A** (inline editable rows). ✓
