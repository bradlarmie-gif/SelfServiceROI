# Vendor displacement in Compare Pricing (cost takeout)

**Date:** 2026-06-22
**Status:** BUILT (rev 4) — shipped into the real Compare Pricing component
**Owner:** Brad

## What shipped

Built directly into the real components so it's on-brand by construction (no redesign):
- Engine: `pricingComparisonCalc.ts` — `DisplacedVendor`, `DISPLACEMENT_CATEGORIES`,
  `vendorDisplacedAnnual`, `displacedInYear` (cost offset applies from a vendor's
  `startYear`), `computeNetResult`. Unit-tested in `pricingComparison.test.ts`.
- UI in `PricingComparisonFlow.tsx`, all additive:
  1. **Switch savings** toggle (off by default) styled like the existing "provisioning" pill.
  2. **What they pay today** card (only when on) — category dropdown · spend · % slider ·
     from-Yr selector · remove · "+ Add vendor" · "Displaceable / yr at scale".
  3. Each **DealCard** gains `− Displaced` + **Net contract** rows under Total Contract.
  4. The **TCO bar chart** switches to Net Cost by Year when on.
  5. The **Side-by-Side Comparison** table gains Displaced / yr, Net Contract Cost,
     Net Annual Cost rows.
  6. The **verdict banner** leads with lowest NET cost + "% covered" when on.

Verified: tsc 0, 272 tests, build clean, 8/8 e2e. The pricing comparison (the hero) is
untouched when the toggle is off — pure deal-structure comparison as before.

---

(original design, rev 3, below)

## Scope (read this first)

This lives **only in the Compare Pricing path** under Forecast. It is **deal/org-level**.
It does **not** touch the proforma, Explore, or any other path. Nothing outside Compare
Pricing changes.

## Problem & goal

Buyers keep asking: *"I already pay for [scribes / a competing ambient vendor / dictation /
a search tool]. What's my **net** cost if Abridge absorbs that and I stop paying for it?"*

Reframe Abridge from net-new spend to **cost takeout**: `Net = Abridge gross − what you stop
paying`. Compare Pricing already computes each deal's gross cost; we add a displacement layer
and surface net.

## Strategic framing

Abridge is moving from "AI scribe" → "clinical intelligence platform." As it absorbs more
adjacent jobs, more incumbent spend becomes displaceable — so the category list is
**data-driven and easy to grow** (adding one is a config change).

## Where it plugs in

Compare Pricing has its own engine — `client/src/lib/pricingComparisonCalc.ts` (`DealOption`,
`VolumeInputs`, `computeDealResult` → gross `totalContractCost` / `averageAnnualCost`) — and UI
`client/src/pages/forecast/PricingComparisonFlow.tsx`. We add to **that** engine only.

Displacement is the customer's **current vendor stack**, which is the same regardless of which
Abridge deal structure (A/B/C) they pick. So it's a **single comparison-level input**, applied
to every deal column to show net. (Not per-deal, not per-care-setting.)

## Data model (self-contained to Compare Pricing)

Reuse the **shape** of the proven `CostOffset` type (import the type only — zero runtime impact
on the proforma) and compute the displaced dollars inside `pricingComparisonCalc.ts`:

```ts
interface DisplacedVendor {
  id: string;
  label: string;            // custom name, or the category label
  category?: DisplacementCategoryId;  // undefined ⇒ custom "add your own"
  annualSpend: number;      // their current spend — source of truth
  displacementPct: number;  // % Abridge takes off the table — partial is the norm
  transitionMonths: number; // fully custom ramp
}
// displacedAnnual = round(annualSpend × displacementPct / 100)
```

(Same formula the proforma uses, so numbers stay consistent. The formula is one line — copied
into Compare Pricing for full self-containment, not shared at runtime.)

## Categories (data-driven config — `displacementCategories.ts`)

| id | Label | basis hint |
|----|-------|-----------|
| `scribes` | Medical scribes (in-person / virtual) | per provider / yr |
| `ambientAi` | Competing ambient AI (DAX, Suki, Nabla, Ambience) | per provider / mo |
| `dictation` | Dictation / speech-to-text (Dragon Medical) | per provider / yr |
| `transcription` | Transcription services (outsourced/offshore) | per encounter / flat |
| `cdiCoding` | Third-party CDI / coding tooling | flat / per encounter |
| `clinicalEvidence` | Clinical evidence & search | per provider / yr or flat |
| *(custom)* | + Add your own | freeform |

Basis is a **hint only** — no fabricated default dollars; the rep enters the real spend (blank
placeholder until they do). Grows with the platform (clinical-trial matching, etc. added later).

## What we build (inside Compare Pricing only)

1. **A "What you pay today" section** at the top of the comparison: rows of `DisplacedVendor`
   (category dropdown + spend + % displaced slider + custom transition months). "+ Add your own"
   for custom.
2. **Net cost per deal:** each deal column shows **gross** and **net = gross − total displaced
   annual**, plus "% of Abridge covered by displacement." Headline metric becomes net.
3. **Before → after framing:** `What you pay today → Abridge gross → Net`.
4. **Partial-impact view:** net at **40% / 60% / 80%** displacement, plus a **"+ custom" level**.
   A sensitivity on `displacementPct` — the "move fast when pushed into a corner" lever.

## Conservatism (non-negotiable)

- No fabricated default spend — blank until the rep enters the real figure.
- Default displacement well under 100%; partial is expected.

## States

- No vendors added → net = gross (graceful; nothing claimed).
- Vendor added, 0% displaced → no offset.
- Custom transition ramp → displaced $ ramps in over `transitionMonths` (year-1 partial).

## Out of scope (v1)

- The proforma, Explore, and everything outside Compare Pricing — untouched.
- Per-care-setting displacement (this is deal-level).
- Rebuilding the deal A/B/C structure engine — we add a displacement layer + net rendering, we
  don't change how gross is computed.
- Auto-pulling real vendor price benchmarks (bases are hints only).
- Renaming "Compare Pricing" (optional; not part of this).

## Resolved decisions

1. **Scope: Compare Pricing path only; proforma untouched.** ✓
2. **Deal/org-level** (not per care setting). ✓
3. **Transition months: fully custom** per vendor. ✓
4. **Partial-impact view: 40/60/80 + a custom level.** ✓
5. **Strategic callout: cut.** ✓

## Testing

- Unit (in `pricingComparison.test.ts`): `displacedAnnual` (partial %, 0%, 100%); net per deal
  = gross − total displaced; net at the 40/60/80/custom levels.
- Verify nothing outside Compare Pricing is imported-from in a way that changes its behavior.
