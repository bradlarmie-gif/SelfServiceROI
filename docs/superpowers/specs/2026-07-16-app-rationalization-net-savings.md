# App Rationalization — Abridge Price & Net Savings

**Date:** 2026-07-16
**Status:** Design approved, pending spec review
**Feature:** App Rationalization (Forecast). Add the Abridge price and a net-savings layer to the sunset story.

---

## 1. Why

App Rationalization today shows only the existing stack: N tools, $Y total, and how much of that spend consolidates onto Abridge. It never accounts for what Abridge itself costs, so the number invites the CFO's first rebuttal ("Abridge isn't free"). The spine of the tool is: *you pay for these tools at $Y a year, and here is how much of it you can sunset because Abridge already does it.* The **sunset is the hero**; net-of-price is the honesty layer beneath it so the artifact survives finance.

It has to work for two rooms with one tool:
- **Not on Abridge yet:** here is $Y of tools, sunset this much onto Abridge, here is your net after our price.
- **Already on Abridge:** you pay us already, and you are also still paying for tools you no longer need. Sunset them too. Here Abridge is not a new cost, so the sunset is basically pure savings.

The competitive edge underneath: a point ambient vendor lacks the surface area to let a customer sunset their CDI, coding, dictation, and evidence tools. Abridge spans those, and that footprint keeps widening. The stack-coming-apart view is what makes that visible; the deeper per-capability proof is the parked "why we can" panel (coming soon).

## 2. Goals

- Capture a single **Abridge price / yr** (the incremental Abridge cost) entered once.
- Show **Net savings = what sunsets onto Abridge − Abridge price** on the Applications total bar and the Consolidation payoff, with what stays alongside.
- Net the price into the roadmap **summary** (not the bars).
- Cover both rooms with one input: prospect enters the real price (net savings); existing customer enters 0 or the incremental expansion cost (net is the full sunset).
- Lean on **"sunset"** as the operative word for the money outcome; keep the per-tool lever as-is.
- Stay honest: if the price exceeds the sunset, show a plain **"Net cost"** state, never an overstated savings.

## 3. Non-goals

- No change to the two-sink Consolidation diagram or the RoadmapChart bars (only the surrounding summary numbers change).
- No per-tool Abridge cost; the price is a single flow-level number.
- No "already on Abridge?" mode toggle; the single incremental-price field covers both rooms.
- No change to the per-tool lever wording ("How much could you displace?") or the "When" model.

## 4. Data model + calc

Abridge price is **flow-level state**, not per-item. Add to `AppRationalizationFlow`: `abridgePrice: number` (annual, default `0`).

In `client/src/lib/appRationalizationCalc.ts`, add a pure net helper (leaves `computeTotals` untouched, so `ConsolidationFlow` and other callers are unaffected):

```ts
export interface AppRatNet {
  stackTotal: number;
  sunset: number;       // what consolidates onto Abridge (= computeTotals().toAbridge)
  stays: number;
  abridgePrice: number; // clamped >= 0
  netSavings: number;   // sunset - abridgePrice; may be negative (a net cost)
  isNetCost: boolean;   // netSavings < 0
}

export function computeNet(items: AppRatItem[], abridgePrice: number): AppRatNet {
  const t = computeTotals(items);
  const price = Math.max(0, abridgePrice || 0);
  const netSavings = t.toAbridge - price;
  return {
    stackTotal: t.stackTotal,
    sunset: t.toAbridge,
    stays: t.stays,
    abridgePrice: price,
    netSavings,
    isNetCost: netSavings < 0,
  };
}
```

## 5. Entry point

A single **Abridge price / yr** input in the Applications header, beside Organization (same styled input pattern), bound to `abridgePrice`. A `$` prefix; empty/0 is valid (existing-customer default). Use `NumberField` so it clears cleanly.

## 6. Where net shows

Both surfaces key off `computeNet`. Shared copy rules:
- Rename the current "to Abridge" copy to **"Sunsets onto Abridge"** (internal field stays `coveragePct`/`toAbridge`).
- The **Abridge price** and **Net savings** lines/segments appear only when `abridgePrice > 0`, so an existing customer with price 0 sees a clean sunset story with no "−$0" noise (net collapses to the sunset amount).
- When `isNetCost` (price > sunset), the net label reads **"Net cost / yr"** in neutral ink (not coral); when positive, **"Net savings / yr"** in coral. No stoplight colors.

### 6a. Applications total bar (compact)

The slim total bar keeps its inline form, extended with the net when a price is set:

```
Stack today $Y / yr    ·  Sunsets onto Abridge $sunset  ·  −$price Abridge  ·  Net $net  ·  $stays stays   [See the consolidation →]
```

When `abridgePrice = 0`: `Stack today $Y / yr · Sunsets onto Abridge $sunset · $stays stays`.

### 6b. Consolidation payoff — the editorial ledger (approved design "A")

A dedicated **"The Consolidation" ledger card** sits above the untouched two-sink `ConsolidationFlow` diagram (it replaces the current one-line "$X to Abridge · $Y stays · from $Z stack" headline). New component `ConsolidationLedger.tsx`. Two columns separated by a hairline vertical rule:

**Left — the ledger:**
- Heading **"The Consolidation"** in the Abridge display font (`.font-abridge`, uppercase, ~17px).
- `Sunsets onto Abridge      $sunset`
- `Abridge price            −$price`   (only when price > 0)
- hairline rule
- `Net savings / yr    $net` — the net is the one large coral number (`AnimatedValue` count-up, ~36px, tabular-nums). "Net cost / yr" + neutral ink when `isNetCost`.
- `+ $stays stays in place` (quiet, muted).

**Right — "Your $Y stack" vertical proportion bar:**
- Small uppercase eyebrow "Your $Y stack".
- A slim vertical bar (rounded, ~46px wide) representing the whole `stackTotal`, split top-to-bottom into segments with heights proportional to dollars:
  - **Net savings** — coral `#EA2C00`
  - **Abridge price** — deep coral `#B23A12`   (only when price > 0)
  - **Stays in place** — taupe `#D8CEC1`
- A legend beside the bar: colored chip + label + value for each segment.
- Identity: `Net savings + Abridge price = Sunsets onto Abridge`, and `Sunsets + Stays = stackTotal`, so the three segments always sum to the full stack when net ≥ 0.
- Edge (`isNetCost`, net < 0): do not draw a negative segment. Show two segments — **Sunsets onto Abridge** (coral, = sunset) and **Stays** (taupe) — and let the left ledger carry the "Net cost" story.

Numbers use `AnimatedValue` count-ups and tabular-nums; coral only on the net-savings figure/segment.

## 7. Roadmap

`computeRoadmap(items, termYears, abridgePrice = 0)` gains a third optional arg and returns two new fields:

```ts
// added to the Roadmap interface
abridgePrice: number;   // clamped >= 0
netSavings: number;     // totalRetired - abridgePrice (run-rate at full sunset); may be negative
```

`RoadmapChart` gains an `abridgePrice` prop and passes it through. The **bars are unchanged** (the existing stack declining). The header hero changes from "−$X retired across N years" to the **net savings run-rate**:
- Hero number: `netSavings` (coral if >= 0). Sub-label "net savings / yr, after Abridge" when price > 0, else "net savings / yr."
- When `netSavings < 0`: hero label "net cost / yr," neutral ink.
- A secondary line shows `$sunset sunset · $price Abridge price` when price > 0.
- "The read" is unchanged in structure (still about timing); no "renewal" language.

## 8. Files

- Modify: `client/src/lib/appRationalizationCalc.ts` — add `AppRatNet` + `computeNet`.
- Modify: `client/src/lib/appRationalizationRoadmap.ts` — `computeRoadmap` third arg + `abridgePrice`/`netSavings` on `Roadmap`.
- Modify: `client/src/pages/forecast/AppRationalizationFlow.tsx` — `abridgePrice` state; pass to Applications header, render `ConsolidationLedger` above the two-sink diagram, pass `abridgePrice` to RoadmapChart.
- Create: `client/src/components/forecast/ConsolidationLedger.tsx` — the "The Consolidation" editorial ledger + right-side vertical proportion bar (design 6b), driven by `computeNet`.
- Modify: `client/src/pages/forecast/appRationalization/ArApplicationsStep.tsx` — Abridge price input in header; net added to the compact total bar (6a).
- Modify: `client/src/components/forecast/RoadmapChart.tsx` — `abridgePrice` prop; net hero; pass to `computeRoadmap`.
- Test: `client/src/__tests__/appRationalizationCalc.test.ts` — `computeNet` (positive net, zero price, net cost, clamping).
- Test: `client/src/__tests__/appRationalizationRoadmap.test.ts` — `abridgePrice`/`netSavings` fields (including negative).

## 9. Testing

- `computeNet`: `sunset − price`; price 0 → net == sunset, `isNetCost` false; price > sunset → negative net, `isNetCost` true; negative price input clamps to 0.
- `computeRoadmap` with `abridgePrice`: `netSavings === totalRetired − price`; default arg 0 → `netSavings === totalRetired`; negative case carried.
- `computeTotals` regression: unchanged.
- Visuals (header input, total-bar breakdown, roadmap hero) verified on Replit; this environment cannot render the app.

## 10. Copy & brand constraints

- No em dashes; plain, defensible copy.
- "Sunset" is the operative word for the money outcome; "Sunset onto Abridge" replaces "to Abridge."
- Internal fields stay `coveragePct` / `toAbridge`.
- Coral `#EA2C00` for savings; neutral ink for a net cost; no stoplight colors, no status pills.
- Titles keep `.font-abridge`; Manrope UI; `AnimatedValue` count-ups; tabular-nums.

## 11. Decided

- Single flow-level `abridgePrice` (incremental), default 0, covers both rooms; no mode toggle. ✓
- Sunset is the hero; net savings is the honesty layer beneath it. ✓
- Roadmap nets the price into the summary/hero, bars unchanged. ✓
- Net cost shown plainly when price > sunset. ✓
- Consolidation payoff = the "The Consolidation" editorial ledger (Abridge-font heading) + right-side "Your $Y stack" vertical proportion bar (approved mock "A"); the two-sink chart stays untouched. ✓
