# Explore Editorial Live Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to execute task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the live React Explore flow (all 9 screens, all 4 care settings) in the locked editorial "Option B" brand, matching the approved mockups in `scratchpad/explore-0N-*.html` (outpatient) and the per-setting mockups, wired to the EXISTING driver engine.

**Architecture:** This is a **re-skin over the existing engine**, not an engine rewrite. `computeAllDriverValues`, `computeExploreTotals`, `EXPLORE_DRIVERS`/`getDriversForPage`, `hccPlans[]` (already carries per-plan recapture rate, net-new, per-plan $/HCC), denials realization (= net-of-appeals), wRVU/DRG/Obs scenarios all already exist and already branch by care setting. We build new editorial screen components that consume the SAME `ExploreState` + engine, and swap them into `ExploreFlow.tsx`'s phase switch. New UI-only additions: payment-model fork (gates which Revenue drivers show), the "when it lands" onset-ramp chart + computed break-even (reuse proforma `ONSET_DELAY_MONTHS` = immediate 1 / delayed 3 / phased 6 / longTerm 12; denials = delayed/M3), and the expansion projector sliders on Your Model.

**Tech stack:** React 18 + TS strict + Vite + Tailwind; framer-motion; @react-pdf/renderer; recharts (or bespoke SVG matching the mockup chart). Fonts: Abridge display + Manrope (already in repo).

## Global Constraints (verbatim, bind every task)
- Match the locked mockups EXACTLY (tokens: page #FDFCFA, cards #FDFBF8 + #DED5C8 hairline rounded-[20px], coral #EA2C00 for money/actions ONLY, Abridge headings #1A1A1A, muted #5E534A, faint #786C5E, label #2E2822, rounded-xl buttons, segmented toggles rounded-[10-12px]). 9-dot header progress, coral active dot elongated.
- NO em dashes in any copy. Conditional never causal. Money leads with a COUNT then dollar. Signals marked "ex." No-double-count notes. Proof screens: "$0 counted here, on purpose", accuracy-not-achievement verbs, never tie Abridge to a bonus/outcome.
- NO driver defaults ON; every field BLANK until entered; screen value $0 / "0 of N on" until a driver is turned on. Multi-driver: ON expands, OFF collapses to a quiet row; running subtotal chip.
- `npx tsc --noEmit` 0 errors + full `npx vitest run` green + `npm run build` succeeds after every task. Do NOT push to main until Brad approves (approval gate). Work in the detached worktree; commit with `git push origin HEAD:main` ONLY on his go.
- Preserve engine numbers: the displayed value per driver MUST equal `computeAllDriverValues[key]` (reconciliation, as in exploreDriverValueParity tests). Do not fork the math into the UI.

---

## File structure
- Create `client/src/pages/explore/editorial/` for new screen components: `EdCareSetting.tsx`, `EdPractice.tsx`, `EdTimeSavings.tsx`, `EdCapacity.tsx`, `EdWorkforce.tsx`, `EdRevenue.tsx`, `EdQuality.tsx`, `EdInvestment.tsx`, `EdModel.tsx`.
- Create `client/src/components/explore/editorial/` shared kit: `EditorialShell.tsx` (header + dots + wrap), `SectionLabel.tsx`, `ValueDriverCard.tsx` (toggle ON/expand + OFF/collapse, value+count+callout+inputs+build line), `QuickFill.tsx`, `NumberField.tsx` (reuse shared NumberField), `DemotedSignals.tsx` (signals→outcomes MECE), `ProofChain.tsx` (the $0 timing chain), `PaymentFork.tsx`, `PlansRepeater.tsx` (HCC plans, bind to `hccPlans[]`), `WhenItLandsChart.tsx` (onset ramp + break-even), `ExpansionSliders.tsx`, `AnimatedNumber.tsx`.
- Modify `client/src/pages/explore/ExploreFlow.tsx` phase switch to render the editorial screens.
- Add UI-only state to `ExploreState`: `paymentModel: 'ffs' | 'risk' | 'both'` (gates Revenue drivers), and expansion projector fields (`expandProviders`, `expandAdoptionPct`) if not derived.

## Onset ramp (When It Lands) — the computed curve
- Import `ONSET_DELAY_MONTHS` from proforma. For each ENABLED driver, its monthly value ramps from its onset month to full run-rate. Sum across enabled drivers -> monthly value run-rate array (12 mo). Investment run-rate is flat. Break-even month = first month run-rate >= monthly investment. Curve starts underwater, crosses cost = "clears the cost · Mo X" (computed), climbs to full run-rate. Onset map: Immediate/M1 = wRVU/E&M, DRG/CDI, scribe; Delayed/M3 = capacity/access, denials, quality signals; Long-term/M12 = HCC, retention.

---

## Tasks (order keeps green + independently shippable)

### Task 1: Shared editorial kit — EditorialShell + tokens
Build `EditorialShell` (header with ABRIDGE wordmark, "Explore · {step}", 9-dot progress, Data request chip) + a tokens module. Snapshot/structure test that the 9 dots render with the right one active.

### Task 2: ValueDriverCard + SectionLabel + QuickFill + DemotedSignals
The two-tier building blocks. `ValueDriverCard` supports ON(expanded: value, count callout, input grid, build line) and OFF(collapsed muted row). Reconciliation test: value shown === passed engine value. DemotedSignals renders "ex." rows + no-double-count note.

### Task 3: Screen — Care Setting (step 1)
Port `explore-01-caresetting.html`. 4 setting cards, coral ring + check on select, writes `state.careSetting`. Reuse existing selection logic.

### Task 4: Screen — Practice (step 2)
Port `explore-02-practice.html`. Providers, annual encounters (segmented Total/Per-provider), adoption %, live snapshot rail with Abridge-enabled encounters. Bind to existing state.

### Task 5: Screen — Time Savings (step 3)
Port `explore-03-timesavings.html`. Minutes/note + quick-fill Conservative/Typical/High adoption, "how it adds up" strip, snapshot. Bind to `totalHoursSaved`.

### Task 6: Screen — Capacity (step 4)
Port `explore-04-capacity.html` two-tier. Money driver(s) via `getDriversForPage('Capacity', setting)` financialDrivers; demoted = qualitative watchMetrics. Reconciliation test all 4 settings.

### Task 7: Screen — Workforce (step 5)
Port `explore-05-workforce.html`. Multi-driver (retention + locum/agency/scribe or nursing RN retention + travel/agency), ON/OFF collapse, subtotal. Burnout-scoped retention math already in engine. All-settings reconciliation.

### Task 8: Screen — Revenue (step 6) + PaymentFork + PlansRepeater
Port `explore-06-revenue.html`. Payment fork gates wRVU (FFS) vs HCC (risk) vs both; denials cross-cutting below the fork. PlansRepeater binds to `hccPlans[]` (recapture rate today->with-Abridge, net-new, per-plan $/HCC). Denials net-of-appeals = denialsRealization. Per-setting: ED = E&M+denials, IP = DRG/CMI + Obs (no fork/denials), Nursing = proof/$0. Reconciliation all settings.

### Task 9: Screen — Quality (step 7)
Port `explore-07-quality.html`. Outpatient/ED/IP = ProofChain ($0). Nursing = FIVE money drivers (two-tier multi). Branch on setting. Legal copy (accuracy-not-achievement) enforced.

### Task 10: Screen — Investment (step 8)
Port `explore-08-investment.html`. Pricing segmented (per provider/encounter/platform), value stack (quadrant totals from engine), net + ROI multiple, estimate disclaimer. Bind to existing pricing state + computeExploreTotals.

### Task 11: Screen — Your Model (step 9) + WhenItLandsChart + ExpansionSliders
Port `explore-09-model.html`. Hero recap, WhenItLandsChart (computed onset ramp + break-even), quadrant contribution bars (Quality = "proof, counted in Revenue"), ExpansionSliders (today->full care setting, editable value + ceiling), export actions. Chart unit test: break-even month matches onset math for a known driver mix.

### Task 12: Swap ExploreFlow to editorial screens; retire old
Wire the phase switch to editorial components. Keep old files until Brad approves, then delete. Full flow smoke: navigate all 9 phases, all 4 settings, tsc + vitest + build green.

### Task 13: Editorial PDF (leave-behind)
@react-pdf document matching the editorial brand + the Your Model recap. Real `pdf().toBlob()` render test (NOT just tree-walk). Cover + per-quadrant + model page.

### Task 14: 4-setting visual pass + parity
Verify each setting renders the right drivers per the approved per-setting mockups. Extend reconciliation tests to cover all setting×screen combos.

## Self-review
- Every screen's displayed driver value traces to `computeAllDriverValues` (no forked math).
- No em dashes; conditional copy; proof screens $0; no-double-count notes present.
- All 4 settings render correct drivers (domain-fit guard: nursing uses RN language, never "provider").
- tsc/vitest/build green; nothing pushed to main pre-approval.
