# Proforma quarterly ramp — design

**Date:** 2026-06-14  ·  **Status:** approved (Brad)

## Goal
Let users enter the proforma ramp at **quarterly** granularity, **per metric and
independently** — providers, utilization, and $/unit pricing each have their own
`Yearly ⇄ Quarterly` toggle. Default stays yearly (the clean 3-box view). This
surfaces engine support that already exists; it is mostly a UI + one engine fix.

## Current state (what already exists)
- **Engine fully supports quarterly:** a setting carries optional
  `quarterlyProviders` / `quarterlyUtilization` / `quarterlyPricing`
  (`q1..q12` = 12 quarters = 3 years). `buildMonthlyCashFlows` /
  `getProviderExpansion` read the quarterly field first and *interpolate* the
  provider ramp between quarter targets; `getQuarterlyValue` maps month→quarter.
- **Converters exist** both ways: `annualToQuarterly{Providers,Pricing,Utilization}`
  and `quarterlyToAnnual*`.
- **Cash-flow view** already has an independent quarterly/yearly display mode
  (`config.viewMode`, `groupByQuarter`). This is separate from input granularity.
- **Gap:** the assumptions drawer (`VolumeAndPricingSection`) only exposes
  **yearly** Y1/Y2/Y3 inputs, and editing them clears any quarterly data. So
  there is no way to *enter* a quarterly ramp today.

## Design

### UI (ModelAssumptionDrawer → VolumeAndPricingSection)
- Each of the three rows — **Providers**, **Utilization**, **$/unit** — gets a
  small inline `Yearly | Quarterly` toggle on its header. Independent: any
  combination is valid (e.g. quarterly providers + yearly util + yearly price).
- **Yearly (default):** existing Y1/Y2/Y3 boxes (unchanged).
- **Quarterly:** a compact grid of up to 12 boxes (Q1–Q12), grouped by year
  (4 boxes/row × 3 year-groups) to stay clean in the 440px drawer.
- **Seeding:** toggling Yearly→Quarterly pre-fills the quarterly boxes from the
  yearly values via `annualToQuarterly*` (never blank).
- **Revert:** Quarterly→Yearly collapses back to the yearly value
  (`quarterlyToAnnual*`) and sets the `quarterly*` field to `undefined` so the
  engine falls back to yearly for that metric.
- **Encounters** ("Abridge Encounters by Year") stays **derived** (util × total)
  — no toggle; it follows providers/util granularity automatically.

### 3-year cap
The quarterly structure holds 12 quarters (3 years). For 4–5 year terms,
years 1–3 are quarterly-capable; years 4–5 stay annual (ramp is complete by
then). The Quarterly toggle shows quarters for years 1–3 only.

### Engine fix (required by quarterly utilization)
Per-encounter pricing currently reads **yearly** utilization only for both the
value and billing paths (`proformaCalculations.ts` ~lines 300–305, 448–451,
465–468). Once quarterly utilization can be set, those paths must read
`setting.quarterlyUtilization` when present, so value and cost stay consistent
under a quarterly util ramp. (Non-encounter paths already check quarterly util.)

### Data flow
Drawer edit → `onUpdateSetting({ quarterlyProviders | quarterlyUtilization |
quarterlyPricing })` → App `proformaSettings` (immutable) → `buildMonthlyCashFlows`
reads the quarterly field → monthly cash flows → **aggregated into the same
yearly summary** the screen + PDF already render.

### PDF — unaffected
The PDF renders **yearly aggregated output** (`getYearlySummary`) plus a chart
whose bar count is driven by the **contract term** (not input granularity), and
it never references the `quarterly*` input fields. Quarterly input only changes
the values flowing into the existing yearly columns/chart — **no change to
column counts, chart bars, layout, or dimensions.** PDF code is untouched.

## Testing
- Engine: quarterly provider ramp produces the expected interpolated curve;
  per-encounter value AND billing both honor quarterly utilization (consistency);
  converter round-trip (annual→quarterly→annual) is stable.
- Keep existing proforma multi-setting suite + PDF structural/reconciliation
  snapshots green.
- Production build passes; generate a sample proforma PDF to eyeball the premium
  look is intact.

## Out of scope
- Quarterly granularity beyond year 3.
- Quarterly entry for encounters (stays derived).
- Changing the cash-flow *view* (display) behavior.
