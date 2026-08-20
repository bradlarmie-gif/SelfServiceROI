# Retention Counted ⇄ Tracked Toggle — Design

> **SCOPE (decided 2026-08-03):** After reading the engine, a per-*domain* toggle
> was rejected — domains mix hard dollars, pure signals, and no-double-count
> $0s, so a blanket toggle would either double-count or hide real savings. The
> toggle governs **Retention only** (`providerWellbeing` + `nursingRetention`,
> replacement-cost dollars): the one genuinely audience-dependent *soft* dollar.
> `counted` = replacement-cost dollar in the ROI total; `tracked` = shown as its
> signals (turnover %, burnout, likelihood-to-stay), excluded from the total.
> Global default **Tracked** (your "cost-of-a-provider is a stretch" call), one
> flip turns the dollars on for a finance audience. Control lives on the
> retention driver card (Explore) and the Proforma Build screen. Single-sourcing
> `PROOF_LAYER` still proceeds independently to kill the CRITICAL triplication.
>
> Everything below the line is the original broader exploration, kept for record.

---

# (superseded) Counted ⇄ Tracked Toggle — Design

**Goal:** Let a user show any care-setting domain (Capacity / Workforce / Revenue / Quality) either as **Counted** (a dollar that adds to the ROI) or **Tracked** (a leading signal, shown but kept out of the dollar), globally and per-domain, so the same model can pivot between a clinical-leadership audience (people, not money) and a finance audience (dollars) without re-modeling.

**Why now:** Today the non-financial layer is a *fixed* rule (`PROOF_LAYER`), encoded in three disagreeing places, and different across tools (Explore counts retention as a dollar in some settings; Attain treats retention as proof everywhere). Making the layer a *lens* both serves the two audiences and collapses the triplication into one default.

---

## Core insight

Every domain already computes **both** a dollar (`capacityValue` / `workforceValue` / `revenueValue` / `qualityValue`, from the quadrant engine) **and** its signals (watch-signals). Nothing new needs modeling — the retention dollar (`providerWellbeing`, `nursingRetention`, replacement-cost math) still exists. `PROOF_LAYER` today just decides which domains are *excluded from the summed total and shown as signals*. So the toggle is: **per domain, is its dollar included in the total, or suppressed and rendered as a signal?**

---

## Model

```
type DomainMode = "counted" | "tracked";
type DomainKey = "Capacity" | "Workforce" | "Revenue" | "Quality";

// One canonical default map (replaces PROOF_LAYER + the two methodology copies).
// "tracked" = the current proof/non-financial layer.
DOMAIN_MODE_DEFAULT[setting][domain] = "counted" | "tracked"
```

**Defaults (seeded from today's convention):**
| Setting | Capacity | Workforce | Revenue | Quality |
|---|---|---|---|---|
| Outpatient | counted | **tracked** | counted | **tracked** |
| ED | counted | **tracked** | counted | **tracked** |
| Inpatient | **tracked** | **tracked** | counted | **tracked** |
| Nursing | counted | **tracked** | **tracked** | counted |

- Workforce defaults to **tracked** everywhere (your "cost-of-a-provider is a stretch" call) — flip it to Counted for a CFO who wants replacement-cost dollars.
- This table is the ONE source. `PROOF_LAYER`, `methodologyContent`, and `methodologySettingData` all derive their tags from it (fixes the CRITICAL disagreement, incl. nursing Revenue and inpatient Capacity).

**Override state:** `domainModeOverride: Partial<Record<setting, Partial<Record<domain, DomainMode>>>>` plus one `globalDefault: "as-modeled" | "all-dollars" | "all-signals"`. Resolution: override ▸ global ▸ table default. Lives in `ExploreState` (persists), flows into the proforma snapshot, read by both PDFs and Attain.

---

## Engine wiring

- The summed ROI total includes a domain's dollar **iff** its resolved mode is `counted`. Tracked domains are excluded from the number and surfaced as signals.
- Single change point in the quadrant/total sum (`computeExploreTotals` + the proforma snapshot builder + `buildMonthlyCashFlows` domain sum). No per-driver math changes.
- Nursing Capacity's bare "$0" bug disappears: when tracked, it renders as a signal, never a dollar.

## Surfaces

- **Care-setting screen (v2, now default):** each domain shows a small **Counted / Tracked** toggle; the Tracked one reads "tracked as the leading signal, not a dollar."
- **Explore model + recap, Proforma Build:** a global lens switch ("Show as: as-modeled · all dollars · all signals") + the per-domain override carried through.
- **PDFs (Explore, Proforma) + Attain:** read the resolved mode; a tracked domain never prints a dollar/`$0` (fixes the Attain retention `$0/yr` bug); totals match the screen.

## Testing

1. Default table matches the current `PROOF_LAYER` for every setting (regression guard so the rename doesn't silently move a domain).
2. Toggling a domain counted→tracked lowers the summed total by exactly that domain's dollar; tracked→counted raises it by exactly that amount.
3. Round-trip: a mode set in Explore reaches the proforma snapshot and the PDF total.
4. A tracked domain yields no dollar string in the PDF (guards the `$0` regressions).

## Out of scope / parked
- Dead-code removal (your call — a play first).
- Attain's independent flow keeps its own signals; it just reads the same resolved mode instead of hardcoding retention-as-proof.

## Placement (decided)
- Per-domain Counted/Tracked control is editable on **both** the care-setting screen and the Proforma Build screen (finance can re-lens without returning to Explore). Explore recap and PDFs inherit + show a read-only badge.
- Only deliberate change from today's `PROOF_LAYER`: **Workforce → Tracked by default in every setting.** Every other cell mirrors the current convention; the regression test asserts that.
