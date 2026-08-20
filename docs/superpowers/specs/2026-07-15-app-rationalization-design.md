# App Rationalization (4th Forecast option)

Date: 2026-07-15

## Goal

A customer-facing pitch artifact that shows a health system their current
documentation-adjacent tech stack, what each tool costs, and how much of that
spend Abridge can take on, so the consolidation story lands: many overlapping
tools becoming largely one platform, with the remainder shown honestly.

This is a sales narrative, not an internal deal-desk sandbox. It is walked
through with a prospect. It is the productized version of the internal
"Technology Stack Overview" one-pager (vendor landscape, coverage by capability,
phased roadmap).

Lives in `client/src/pages/forecast/`, added as the 4th card in
`ForecastModeSelector`.

## Posture and guardrails (non-negotiable)

- **Customer-facing.** Everything reads as opportunity and candidates, never as
  a done deal. Follow the defensible-claims doctrine already in the repo:
  - "candidates to retire," "opportunity to consolidate," "what Abridge can take
    on" — capability + conditional voice.
  - Never assert Abridge has replaced or eliminated a named competitor.
  - Coverage % is a candidate figure, not a guarantee.
- **Partial displacement is the norm.** The share Abridge does not take on always
  stays visible. No visual ever implies 100% collapse unless coverage is 100%.
- **No "5 tools become 1."** When any residual remains, that claim is false.
  Frame around the share that consolidates ("$X of a $Z stack onto Abridge").
- **No em dashes, no corporate jargon** in any copy.

## Brand and visual language

Match the app, not a generic chart tool. This was the hardest-won part of the
mockups.

- **Fonts:** the Abridge display font (`--font-heading`, `.font-abridge`) for the
  wordmark and the big step title; Manrope (`--font-sans`) for all UI.
- **Palette:** coral `#EA2C00` + warm neutrals. Dark gradient panels
  (`linear-gradient(155deg,#211D18,#141210)` family, matching the app hero cards)
  for result moments; light warm surfaces (`#FAF8F5`, white cards, `#E8E2DA`
  borders) for entry.
- **Chrome:** the real `UnifiedHeader` (ABRIDGE wordmark, Back, centered
  "Forecast · App Rationalization", step dots).
- **Controls:** the shared Radix `Slider` with the coral accent (already built),
  Lucide line icons (already used app-wide), `FormattedNumberInput`/`NumberField`
  for money, `AnimatedNumber` count-ups for headline figures, tabular numerals.
- **No stoplight colors.** Green/amber/orange status pills were rejected. Any
  urgency is expressed through coral intensity + neutrals, and status pills were
  removed from the entry cards entirely (see Applications).

## Data model

Reuse the existing displacement taxonomy and math rather than duplicate it.

- **Categories** come from `DISPLACEMENT_CATEGORIES` in
  `client/src/lib/pricingComparisonCalc.ts`, extended to cover the full landscape:
  ambient documentation, medical scribe, dictation, transcription, clinical
  decision support, pre-charting risk, in-encounter risk / CDI, post-charting CDI
  / coding, clinical evidence & search, custom. (Add the missing ones; keep ids
  stable so Compare Pricing keeps working.)
- **Per-application record** (`AppRationalizationItem`), a superset of the
  `DisplacedVendor` shape so the two features can converge:
  - `id`
  - `category` (DisplacementCategoryId) — chosen first
  - `vendorName?` (string) — optional; when empty, display falls back to the
    category label
  - `annualSpend` (number)
  - `coveragePct` (0–100) — the single lever: the share of THIS tool's spend
    Abridge can take on. Residual = `100 − coveragePct` and stays on the books.
    (This is the same concept as `displacementPct`.)
  - `abridgeProduct?` (string) — the "Covered by" mapping; select-or-type;
    defaults to the category label when empty
  - `renewal?` (a term/date descriptor: "Open term", "2026", "Mid 2027",
    "Unknown") — drives the roadmap timing, not shown as a status pill
  - `transitionMonths` (reuse from DisplacedVendor for the ramp)
- **Derived, per item:** `retired = round(annualSpend × coveragePct/100)`
  (reuse `vendorDisplacedAnnual` logic); `stays = annualSpend − retired`.
- **Derived, totals:** `stackTotal = Σ annualSpend`; `toAbridge = Σ retired`;
  `stays = Σ stays`.
- New calc module `client/src/lib/appRationalizationCalc.ts` holds the type, the
  category list wiring, and the pure derive functions. It imports and reuses
  `vendorDisplacedAnnual` and `vendorRampFraction` so the ramp matches Compare
  Pricing and the proforma exactly.

**Sync with Compare Pricing (scope note):** the shared type + taxonomy make a
single "customer stack, entered once" possible. For v1, App Rationalization owns
its own item list; wiring both features to one shared store is an explicit
follow-on, not required to ship. The type is shaped so that sync is a small
change later.

## The flow (5 steps)

A guided path, same pattern as Explore / Measure→Forecast. One `AppRationalization`
page component with step sub-views and the app chrome.

1. **Setup.** Light: organization name, contract term in years (drives the "at
   scale" framing and the roadmap horizon). Nothing heavy.

2. **Applications** (LOCKED in mockups). Command-search entry:
   - A search field (⌘K to focus). Its default/empty state **lists every
     capability** so categories are discoverable without knowing their names.
     Typing filters, and typing a vendor name surfaces it under its category
     ("flu" → Fluency → Dictation) with ↵ to add. Keyboard-navigable. Always an
     "Add as custom application" escape. Each row has a Lucide capability icon,
     not a letter tile.
   - **Category first, vendor second.** Adding a capability creates a stack card.
     Vendor is select-or-type and defaults to the category label if left blank.
   - **Stack card:** capability icon + name; a row of Vendor · Annual spend ·
     Renews; the coral "Abridge covers" slider (the coveragePct lever) with a
     "Covered by (Abridge)" select-or-type; and one quiet line, "$X to Abridge ·
     $Y stays." No status pill, no mini split bar.
   - **Live sidebar:** stack total, to-Abridge, stays, with a small split bar and
     a "See the consolidation →" button into step 3.

3. **Consolidation** (hero visual LOCKED = direction "B", two-sink flow).
   - A dark app-gradient panel. Each tool splits into two flows: coral (what
     Abridge takes on) and grey (what stays), feeding two sinks: a large
     **Abridge** node and a small **Stays** node.
   - The coverage % is loud on the left, per tool, with name, category, spend.
   - Ribbons are thin and airy, ordered so coral flows do not cross, with no text
     on them; hover isolates a single flow.
   - Honest headline: "$X to Abridge · $Y stays · from a $Z stack." No count claim.
   - Built as a bespoke SVG component (`ConsolidationFlow`), driven by the derived
     per-item covered/stays values. Ribbon thickness ∝ dollars.

4. **The change** (over time / roadmap). How the consolidation lands across the
   contract term. Per-tool sunset timing is gated by each tool's renewal; the rep
   can adjust. A phased timeline (0 to term-end) shows when each tool is a
   candidate to retire. This is where the renewal timing surfaces (not as pills on
   the entry cards). May also carry a today vs at-scale / contract-end snapshot.
   Interaction detail to be finalized in the implementation plan.

5. **Why we can** (the proof). The per-capability justification: for each
   capability, their tool(s) vs the Abridge product that covers it, and the
   rationale for why that share is a credible candidate to retire. This is the
   generalized version of the internal doc's "coverage by capability" table. It is
   what a skeptic asks for. Content model (curated capability→Abridge mapping vs
   rep-authored rationale) to be finalized in the plan.

## PDF export

A downloadable pitch artifact mirroring the on-screen story (it gets passed
around the building). Built on the app's react-pdf pipeline and brand PDF
patterns. Sequenced as the **last** build phase so the on-screen flow ships first.

## Components and files

- `client/src/pages/forecast/AppRationalizationFlow.tsx` — the page + step router.
- Step sub-views (Setup, Applications, Consolidation, Change, Why), colocated or
  in a small `appRationalization/` folder following the repo's page conventions.
- `client/src/components/forecast/ConsolidationFlow.tsx` — the bespoke two-sink
  SVG hero.
- `client/src/lib/appRationalizationCalc.ts` — types + pure derive functions,
  reusing `pricingComparisonCalc` category + ramp helpers.
- `ForecastModeSelector.tsx` — add the 4th card ("App Rationalization").
- `App.tsx` — new view/route wiring (same pattern as the other forecast modes).

## Data flow

State: `{ setup: { orgName, termYears }, items: AppRationalizationItem[] }`.
Derived selectors compute per-item retired/stays and the totals; the sidebar,
the consolidation hero, the roadmap, and the PDF all read from those selectors so
there is one source of truth.

## Testing

- Unit tests on `appRationalizationCalc`: retired/stays per item, totals, and the
  per-year ramp/roadmap math; a guard that the category taxonomy stays in sync
  with `DISPLACEMENT_CATEGORIES`.
- If the PDF is built, a snapshot test following the repo's PDF snapshot pattern.
- The existing e2e can gain an App Rationalization path smoke (reaches the flow,
  adds an application, renders the consolidation) once built.

## Build order (phased, each phase shippable and reviewable)

Steps 2 and 3 were mocked in detail and are locked. Steps 4, 5, and the PDF were
agreed conceptually but not mocked, so each gets a short visual pass (in the same
companion) before it is built.

1. **Phase 1 — Model + Setup + Applications.** `appRationalizationCalc.ts`, the
   extended category taxonomy, the flow shell + chrome, the Setup step, and the
   full Applications step (command search, stack cards, live sidebar). This is the
   first implementation plan.
2. **Phase 2 — Consolidation hero.** The `ConsolidationFlow` two-sink SVG,
   reading the derived values, plus the honest headline.
3. **Phase 3 — The change (roadmap).** Visual pass, then build.
4. **Phase 4 — Why we can (proof).** Visual pass, then build.
5. **Phase 5 — PDF export.**

The `ForecastModeSelector` 4th card + `App.tsx` routing land in Phase 1 so the
flow is reachable from the start.

## Out of scope for v1

- Two-way state sync of the customer stack between App Rationalization and Compare
  Pricing's "Retired spend" (the model is shaped to allow it later).
- Any change to Compare Pricing behavior beyond extending the shared category /
  vendor type with optional fields.

## Success criteria

A rep can, in one guided flow: search or browse to add a prospect's tools by
capability, set spend and coverage per tool, and walk the prospect through a
premium two-sink consolidation view and a phased roadmap, with every claim framed
as a defensible candidate and the residual always visible. It looks and reads like
the rest of the app.
