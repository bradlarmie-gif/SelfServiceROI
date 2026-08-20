# Measure — Audience Views Design

**Date:** 2026-05-27  
**Scope:** MeasureOutput.tsx, MeasureDriverEntry / MeasureState extensions

---

## Overview

The same measured data means different things to different stakeholders. A persistent audience toggle on the Output page lets a rep flip between four views without leaving the screen — during a live CFO meeting or a conversation with a clinical champion. One dataset, four lenses.

---

## Audience Views

Four views, each with its own content rules:

| Audience | Metrics shown | Dollar amounts | Quotes block |
|---|---|---|---|
| **Clinical** | Clinical & quality outcomes | Hidden | Shown |
| **Operational** | Process metrics, volumes, time savings | Hidden | Hidden |
| **Financial** | Dollar attribution, methodology, confidence | Shown | Hidden |
| **Executive** | Everything — full picture | Shown | Shown |

"Hidden" means the element is not rendered — not collapsed, not blurred. No deception.

**What changes per audience:**
- Clinical → All quadrants visible except Revenue (which is purely financial); dollar amounts hidden everywhere
- Operational → All quadrants visible; dollar attribution column hidden (raw numbers and units shown)
- Financial → All quadrants; dollar amounts prominently shown; methodology/confidence visible
- Executive → All quadrants, all values, all quotes — nothing hidden

---

## Audience Toggle

A four-pill switcher at the top of the Output page, above the quadrant sections. Uses the existing `bg-[#F5F0EB] rounded-full p-0.5` pill container pattern already used throughout the app (ProformaView assumptions tab, Hub deal config). On-brand, no new colors.

```
[ Clinical ]  [ Operational ]  [ Financial ]  [ Executive ]
```

Active pill: `bg-white text-neutral-900 shadow-sm`  
Inactive pill: `text-[#8C7E6E] hover:text-neutral-900`

Default view: **Executive** (shows everything — a safe default for a rep who hasn't thought about audience yet).

Audience selection is **not persisted to URL state** — it resets on page load. It's a presentation tool, not a data field.

---

## Clinician Quotes

### Data model

One new field added to `MeasureState` (`quotes` only — audience toggle is local UI state, not persisted). Add to `MeasureState` interface in `measureCalculator.ts`:

```ts
quotes?: MeasureQuote[];
```

New type:

```ts
export interface MeasureQuote {
  id: string;           // uuid
  text: string;         // the quote itself
  attribution: string;  // e.g. "Dr. Chen, Cardiology"
  role?: string;        // optional — "Cardiologist", "Hospitalist", etc.
}
```

Quotes live in `state.quotes`. No tagging by audience — they surface on Clinical and Executive views only (controlled by view logic, not by the quote itself). Reps enter them once; the system decides where they appear.

### Quotes UI in Output

When the active audience is **Clinical** or **Executive**, render a `Quotes` block below the KPI hero band and before the driver cards. The block shows all quotes in a horizontal or stacked layout depending on count:

- 1 quote: full-width card, large pull-quote style
- 2–3 quotes: responsive grid (1-col mobile, multi-col desktop)

Each quote card:
- Left accent bar in `#EA2C00` (Abridge brand red)
- Quote text in `text-[15px]` with an opening `"` glyph in a warm muted tone
- Attribution line below in `text-xs text-[#8C7E6E]`
- No border — white card, `shadow-sm`, `rounded-xl`

### Add / Edit quotes

A `Manage Quotes` button in the Output page header area (near the Download button). Opens a slide-over or inline expansion (not a modal — modals feel heavy here) where the rep can:

- Add a quote (text + attribution + optional role)
- Edit an existing quote (inline, no separate edit page)
- Delete a quote (small `×` on hover)

Changes call `updateState({ quotes: [...] })` immediately — no save/cancel needed. One field at a time, minimal chrome.

---

## Timestamps

### Data model

`measuredAt` added to `MeasureDriverEntry`:

```ts
measuredAt?: string;  // ISO date string, e.g. "2025-01-15"
```

Rep-set manually. The UI offers a simple date picker inline in the driver entry card (existing expanded view). Not required — omitting it means no timestamp is shown.

### Display

When `measuredAt` is set, show a small label on the driver card in the Output view:

```
Measured Jan 15, 2025
```

Style: `text-[10px] text-[#AAAAAA]` — same as the "realized / yr" label. Appears below the attribution pill row. Shown on **all** audience views (timestamps add credibility regardless of audience).

---

## Data Source Labels

### Data model

`entryDataSource` added to `MeasureDriverEntry`:

```ts
entryDataSource?: 'ehr' | 'survey' | 'admin_data' | 'chart_review' | 'manual_entry';
```

Named `entryDataSource` to avoid collision with the top-level `DataSource` type already in the codebase (`'analytics' | 'benchmark' | 'estimate'`).

### Source options

| Value | Display label |
|---|---|
| `ehr` | EHR |
| `survey` | Survey |
| `admin_data` | Admin data |
| `chart_review` | Chart review |
| `manual_entry` | Manual entry |

### UI in driver entry card

In the expanded driver entry card (existing accordion), add a small dropdown below the notes field. Label: "Data source" in `text-xs text-[#8C7E6E]`. Uses existing `select` or custom pill-select pattern — no new component needed.

Not required. When blank, nothing is shown on the output.

### Display on Output

When `entryDataSource` is set, render as a small pill alongside the attribution/realization pills:

```
[ 94% attributed to Abridge ]  [ EHR ]  [ Measured Jan 15, 2025 ]
```

Pill style: `bg-[#F0EBE4] text-[#8C7E6E] text-[10px]` — same as existing attribution pills.

Shown on all audience views.

---

## State Changes Summary

### `measureCalculator.ts`

1. Add `MeasureQuote` interface
2. Add `quotes?: MeasureQuote[]` to `MeasureState`
3. Add `measuredAt?: string` to `MeasureDriverEntry`
4. Add `entryDataSource?: 'ehr' | 'survey' | 'admin_data' | 'chart_review' | 'manual_entry'` to `MeasureDriverEntry`

### `MeasureOutput.tsx`

1. Add `audience` local state (`'executive' | 'clinical' | 'operational' | 'financial'`), default `'executive'`
2. Render audience toggle pill switcher at top of page
3. Filter / hide driver cards by audience (dollar values hidden for clinical/operational; quality-only for clinical; capacity+workforce for operational)
4. Render `QuotesBlock` component when `audience === 'clinical' || 'executive'` and `state.quotes?.length > 0`
5. Render "Manage Quotes" button / slide-over panel
6. Show `measuredAt` and `entryDataSource` pills on driver cards

### `buildDriverPayload` in `MeasureOutput.tsx`

Pass through `measuredAt` and `entryDataSource` from entry to the driver payload object.

---

## UX Details

- Audience toggle is **not** shown in the PDF export — PDF is always Executive view (full picture)
- The toggle does not affect the URL or state — purely presentation
- If quotes array is empty, the "Manage Quotes" button still shows — reps should know the feature exists even before they've added any
- Quotes block only renders if `state.quotes?.length > 0` — the block doesn't appear as a placeholder before any quotes are added
- Data source and timestamp fields are additive — they never replace existing data, only annotate it

---

## Execution Order

1. `measureCalculator.ts` — add `MeasureQuote`, extend `MeasureDriverEntry`, extend `MeasureState`
2. `MeasureOutput.tsx` — add audience toggle + filtering logic
3. `MeasureOutput.tsx` — add `QuotesBlock` component + "Manage Quotes" panel
4. Driver entry cards (in each Measure domain page) — add `measuredAt` date picker + `entryDataSource` dropdown to expanded accordion view
5. `MeasureOutput.tsx` — render `measuredAt` / `entryDataSource` pills on output cards
