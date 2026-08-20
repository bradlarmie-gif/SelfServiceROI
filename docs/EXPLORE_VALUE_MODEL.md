# Explore Value Drivers — The Shared Mental Model (Abridge)

> **Still current, with one caveat.** The Explore *screens* this was written for
> were removed when this repo became the Self Service ROI Tool. The *engine* it
> describes (`lib/exploreDriverCalcs.ts`, the driver definitions, the
> realization and attribution doctrine) is exactly the engine this app still
> runs every number through, so the math and the defensibility argument below
> remain the source of truth. Read "Explore screen" as "the what-changes step".

**Purpose:** one mental model, for everyone at Abridge, of how Explore turns documentation into value:
what the drivers are, how the math is conducted, and why it's defensible. Scalable across all 4 care
settings. Calibrated to LEAD the category without overstating, and not so conservative that our
(deliberately high) pricing looks unfavorable.

---

## 1. The frame (same on every screen)
Explore models value in **4 domains**, in order: **Capacity → Workforce → Revenue → Quality.**
Each domain screen is **two tiers**:
- **THE VALUE (counts when it's on):** money drivers. Each is a toggle (nothing defaults on), leads with
  a **count** then the dollar, exposes its inputs as **editable cells**, and shows a plain-English **build line**.
- **The demoted tier (not counted · examples only):** leading **signals** (marked "ex.") → the outcomes they
  point to. MECE to the domain. Always carries a **no-double-count note.**

Two domains are deliberately **proof screens ($0 counted, on purpose)** where the money lives elsewhere:
Inpatient Capacity, Nursing Revenue, and all Outpatient/ED/Inpatient **Quality** (a timing "proof chain").
This is a credibility move: we refuse to count what would be double-counted.

## 2. The math spine (why Finance can believe it)
Two invariants make the whole model conservative-by-construction:
1. **Everything scales to Abridge-enabled volume:** `eligibleEncounters = annualEncounters × adoption%`.
   We never claim value on volume Abridge doesn't touch.
2. **Every money driver carries an explicit realization / attribution factor** (a haircut for "does it
   survive audit / would it have happened anyway"). These are visible, editable cells — not hidden fudge.

The realization spine (audit-survival ordering, conservative on the least-knowable):
wRVU realization · HCC realization · denials realization (net-of-appeals) · DRG realization ("holds on review")
· Obs realization · LWBS realization · retention impact scenario. Signals in Quality carry **$0** (no double count).

## 3. The drivers + exact math, by setting × domain
(Canonical source: `client/src/lib/exploreDriverCalcs.ts` `computeAllDriverValues`; nursing quality via
`nursingQualityCalcs.ts`. The live editorial screens DISPLAY these engine values — they do not re-derive them.)

### OUTPATIENT
- **Capacity — Patient Access ($):** `visits/wk × providers-with-room × 48 × margin/visit`, where
  `visits/wk = (freed hrs/provider/wk × reinvest%) ÷ visit-length`. Reinvest defaults 25%. Editable: providers-with-room, reinvest%, visit length, $/visit.
- **Workforce — Provider Retention ($):** `providers × turnover% × burnout-related% × retention-impact% × replacement cost`. Burnout-scoped (only the documentation-driven slice). + **Locum & Agency ($)** = retained × weeks/vacancy × weekly premium.
- **Revenue — payment fork (FFS / Risk / Both):** wRVU capture ($) = `enabled encounters × (baseline wRVU × increase%) × conversion factor × realization`. HCC capture ($) = per-plan `Σ members × recapture-lift × avg HCC × $/HCC (+ net-new) × realization`. Denials ($, cross-cutting) = `claims × med-necessity rate × scenario × avg claim × net-of-appeals`.
- **Quality — proof chain ($0):** CDI queries → care gaps → HEDIS → MA STARS. Accuracy-not-achievement.

### ED
- **Capacity ($):** LWBS Recovery = `visits × LWBS% × reduction% × downstream margin × realization`; Admission Capture = `recovered × admit% × margin × realization`.
- **Workforce ($):** Provider Retention (same burnout-scoped chain, ED replacement cost) + Locum + Scribe.
- **Revenue ($):** E&M Level Accuracy (wRVU chain, ED conversion) + Denials (net-of-appeals). No fork.
- **Quality — proof chain ($0):** core-measure doc → note completeness → SEP-1 → HCAHPS.

### INPATIENT
- **Capacity — proof ($0):** doc lag → discharge planning → discharge-summary timeliness → LOS. (No money; throughput shows up elsewhere.)
- **Workforce ($):** Provider Retention (hospitalist turnover/replacement) + Locum.
- **Revenue ($):** Case Mix Index / DRG = `at-risk discharges × scenario% × weight increase × base payment × realization ("holds on review")`; Observation/IP Status Defense = `downgrades × revenue delta × preventable% × realization`. No denials driver.
- **Quality — proof ($0):** CDI query rate → HCAHPS doctor → 30-day readmission (kept strictly conditional).

### NURSING (RN language throughout, never "provider")
- **Capacity ($):** Overtime = `OT hrs/RN/wk × reduction% × RNs × 52 × loaded wage`.
- **Workforce ($):** RN Retention = `RNs × turnover% × 40% burnout share × impact% × RN replacement`; + Travel & Agency.
- **Revenue — proof ($0):** documentation completion → CDI response → cleaner downstream coding (counted in coders' world, not here).
- **Quality ($, the marquee):** HAPI / Falls / CAUTI / CLABSI / Sepsis, each = `patient-days × event rate × prevention% × cost/event` (via `calcHapi/Falls/Cauti/Clabsi/Sepsis`). Conditional ("documentation supports prevention," never "Abridge prevents").

## 4. Calibration doctrine (leader, high price, no overstatement)
- **Ethos/Legal:** capability + conditional, never causation ("surfaces gaps that can lead to…", "when teams act"); Quality = accuracy-not-achievement, never "raises the score / earns the bonus"; no em dashes; every number traces to an editable input.
- **Logos/Finance:** count before dollars; margin not charges; realization on the least-knowable; no double count; scoped to Abridge-enabled volume.
- **Not underselling:** the levers that carry the number (recapture-rate lift, wRVU %, retention impact) sit at defensible-but-real defaults, not floor values, so the ROI stands against the price. The conservatism lives in *attribution* (realization), not in denying knowable volume.

## 5. Review findings + persona sign-off
Source: four independent per-setting audits (scratchpad/review-{outpatient,ed,inpatient,nursing}.md) + engine read.

### 5a. Scorecard (16 cells)
Reconciliation (UI $ === engine): **PASS in all 16** — no live editorial screen re-derives a headline dollar; every one reads `computeAllDriverValues` (nursing quality via `nursingQualityCalcs`). This is the single most important finding for Finance and it holds everywhere.
Legal/copy on the editorial screens: **clean** (conditional, accuracy-not-achievement on Quality, no em dashes) except the few items in 5b.
(The legacy non-preview screens still carry em dashes + thinner hedging; they get retired when the editorial flow is promoted.)

### 5b. Findings + status
FIXED this pass:
- Nursing Workforce hero said "providers" (domain-fit) → branched to RN language. [nursing]
- ED LWBS realization 80% → 50% (was ~2x overstatement vs the 40-55% band). [ed, calibration]
- Conversion factor 33 → 33.40 (cited value). [ed/op accuracy]
- (Pass-1) Quality curated chain, HCC members row, header Back, no Scribe on OP.

RESOLVED (decisions made on your constraints — leader, high price, no overstatement, no underselling):
1. **Inpatient Case Mix Index reconcile — RESOLVED on the live app.** The mismatch was mockup/registry-tagline (CMI-uplift) vs the shipped engine (at-risk model). The LIVE editorial card is internally consistent: title "Case Mix Index," mechanism = CC/MCC capture protecting DRG weight, math = the engine's at-risk model, and it reads `engine.drgAccuracy`. The **at-risk% is an editable cell**, so a customer who runs richer can dial it. Did NOT change the engine formula (it's referenced by 11 parity/proforma/PDF tests; changing it risks the suite). Copy now equals math on what ships. Finance-clean.
2. **Realization exposed as editable cells — DONE.** Added the realization cell to wRVU ("the share that holds on review") and HCC ("the share that survives RADV / audit"), matching denials/DRG/Obs which already exposed theirs. Every money driver now shows its haircut as an editable input (your "customization on the cells").
3. **Too-conservative defaults nudged — DONE.** OP HCC `avgHccs 0.5 → 0.9` (mid-band); Nursing CLABSI cost `$20K → $32K` (mid of the CDC range). Conservatism now lives on one lever (the %), not stacked. ED LWBS realization `80% → 50%` (removed the overstatement). Conversion factor `33 → 33.40`.
- HCC causal copy "Abridge surfaces in the room" → softened to "a fuller note can surface during the visit." Nursing Workforce hero → RN language. All DONE.

REMAINING (lower-stakes, non-blocking; do on your go):
- Nursing Revenue proof-chain viz (mockup had a 4-stage chain) — currently a clean $0 proof card without the staged chain. Framing polish, not a persona blocker.
- Consistency: unify how the demoted "signals" tier is built + drive card titles from a benefit-headline map so they can't drift again.
- (Note: editorial locum/agency copy was already correct — describes retained × weeks × premium; the "actual P&L" wording was the legacy path, which retires when editorial is promoted.)

All changes: tsc 0 errors, full suite 658/658 green, all 4 settings drive with 0 console errors.

### 5c. Persona sign-off (would they approve?) — all YES after this pass
- **Legal — YES.** Editorial copy is conditional and accuracy-not-achievement; Quality never claims to move a score or earn a bonus; HCC's one causal-leaning line is softened; no em dashes on the editorial screens. (Legacy screens retire when editorial is promoted.)
- **Finance — YES.** Scoped to Abridge-enabled volume, count-before-dollars, explicit + now-visible realization on every money driver, no double count, and every headline reconciles to the engine (658/658 tests green). The CMI copy now equals the math that ships.
- **VP RevOps — YES.** Payment fork, plans repeater, toggle-nothing-on default, "when it lands" onset curve — the guided-narrative shape a revenue leader wants; adapts per setting.
- **Marketing — YES.** One editorial system, "sell the moment," leader tone; the $0 proof screens are a differentiated credibility play.
- **Partners — YES.** Every money driver's assumptions, including the realization/attribution haircut, are now editable cells they can override.

### 5d. Calibration verdict (leader, high price)
The model is **conservative by construction in the right place — attribution (realization), now visible and editable — and honest on volume.** The outliers are corrected: ED LWBS was too hot (80→50), OP HCC and Nursing CLABSI were too cold (count/cost nudged to mid-band). Conservatism sits on one lever per driver, not stacked. The ROI now stands confidently against the price with no claim Legal would cut and no math Finance would doubt.
