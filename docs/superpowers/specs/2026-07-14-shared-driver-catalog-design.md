# Shared Driver Catalog (Forecast ↔ Measure)

Date: 2026-07-14

## Goal

End the drift where Measure driver updates (names, copy, units) never reach
Forecast. Forecast has its own duplicate driver list, so the two fall out of
sync every time one changes. Make `exploreDrivers.ts` the single catalog that
both read for display, so a name changed once lands everywhere.

This is **sub-project 1 of 3**. It is display-only: the shared *definition*
(name, copy, unit, value-per-unit). It does NOT change Forecast's projection
mechanics, and it does NOT give Forecast Measure's full per-setting driver set
(that is sub-project 2, "from-scratch parity") or the expansion frame (sub-project
3). Keep this one small and safe.

## Decision recap

- **Sync depth:** identical names + copy. Forecast shows the exact Measure driver
  names/descriptions/units.
- **Approach:** A. `exploreDrivers.ts` is the catalog. Forecast maps to it by id
  and keeps its own projection config. No new neutral module; Measure is untouched.

## Architecture

- `exploreDrivers.ts` (`ExploreDriver` + `measureDefaults`) already owns each
  driver's `label`, `shortDescription`, domain (`quadrant`), `deltaUnit`, and
  `valuePerUnitDefault`. It remains the source of truth.
- Each `FORECAST_DRIVERS` entry (in `ForecastDashboard.tsx`) gains one field:
  `catalogId: string` → the `exploreDrivers` `id` it corresponds to.
- Forecast **inherits from the catalog**: label, shortDescription, unit,
  value-per-unit default.
- Forecast **keeps (unchanged)**: `formulaType`, `domain`, `onset`, `scaling`,
  `factor1/2`, `allocationPct`, and the confidence/realization defaults. The
  projection math is not touched.
- The duplicated `label` (and any copy) is removed from `FORECAST_DRIVERS`; those
  fields now come from the catalog.

## The mapping (catalogId per Forecast driver)

| Forecast driver id | catalogId | Catalog label |
|---|---|---|
| timeSavingsCapacity | patientAccess | Patient Access |
| wrvuLift | wrvu | wRVU Capture |
| emLevelLift | opEmLevelDistribution | Average E&M Level |
| cmiLift | drgAccuracy | Case Mix Index |
| hccCapture | hccCapture | HCC Capture |
| denialReduction | denialPrevention | Medical Necessity Denial Rate |
| retentionLift | providerWellbeing | Provider Retention |
| nursingOvertimeReduction | nursingOvertime | Overtime Spend |

**Resolved open question — `emLevelLift`:** it maps to `opEmLevelDistribution`
("Average E&M Level") for its display name. Note: in Measure, E&M is a *signal*
(wRVU carries the dollars, to avoid double-counting). Forecast currently projects
E/M as its own dollar lever. Whether Forecast should also demote E&M to a signal
(so it doesn't double-count wRVU) is a **sub-project 2 modeling decision** and is
explicitly out of scope here. Sub-project 1 only syncs the display name.

## Data flow

A small pure resolver:

```
resolveForecastDriver(forecastDriver): { label, description, unit, valuePerUnit, ...projectionConfig }
```

It looks up the catalog entry by `catalogId`, merges the catalog display fields
with the Forecast projection config, and returns the combined object. If a
`catalogId` has no match, it throws in dev (caught by the guard test) and falls
back to the Forecast driver's own fields in prod so nothing renders blank.

Both consumers use it:
1. The **"from scratch" Partner ROI Model** (renders `FORECAST_DRIVERS`).
2. The **`measureToForecast.ts` bridge** (Measure → Scale & Forecast) labels its
   produced driver instances from the catalog by `catalogId`, so measured →
   forecast drivers show the shared names too.

## Testing

- **Guard test:** every `FORECAST_DRIVERS.catalogId` resolves to a real
  `exploreDrivers` entry (no dangling links).
- **Regression:** existing forecast tests still pass (projection math unchanged).
- **Manual:** rename a driver in `exploreDrivers`; confirm it changes in Measure
  AND in the Forecast Partner ROI Model.

## Success criteria

Changing a driver's name, copy, or unit in `exploreDrivers.ts` shows identically
in Forecast (from-scratch and the Measure→Forecast bridge), with no duplicated
labels left in `FORECAST_DRIVERS`. Forecast's projection behavior is unchanged.

## Out of scope (later sub-projects)

- Sub-project 2: give Forecast Measure's full per-setting driver set (from-scratch
  parity); reconcile Forecast driver *models* to Measure (e.g., E&M as signal).
- Sub-project 3: the expansion frame (scale to full deployment, new settings,
  contract years).
