# The Methodology PDF — Design Spec

**Goal:** Build the flagship educational document for the ROI Calculator — one premium, story-driven PDF that teaches how ambient documentation creates value, care setting by care setting, with the math shown, written so a skeptic (and Legal) can't flinch, and framed as a how-to for *attaining* the value.

**Architecture:** A single comparative HTML-print PDF (the engine the other four tool PDFs use), rendered from an extended version of the existing per-setting methodology data. It retires the old react-pdf methodology export (`client/src/lib/methodology-pdf-export.tsx`). The four on-screen methodology pages point their download at this one document, deep-linked to the relevant setting chapter.

**Tech stack:** React 18 + TS strict, HTML-print (`@media print`, 816×1056 sheets, `breakAfter:"page"`), the shared editorial tokens (page `#FDFCFA`, coral `#EA2C00` for money/accent only, hairline `#E8E2DA`, `font-abridge` display headlines, Manrope body).

## Global constraints

- **Voice doctrine (governs every word).** Plain, consultative, mechanism-first. Start from a truth a skeptic already agrees with, then walk one honest step at a time. NO costume: no "unlock," "fidelity," "lossy," "faithful" as vocabulary reaching; NO em dashes; NO conclusions asserted before they're earned. This is the voice locked on the mockup's page 1.
- **Legal doctrine (capability + conditional).** Never claim Abridge causes or guarantees an outcome. Frame as: the record supports X; where teams act on what the record surfaces, Y follows. Every dollar claim ties to what the documentation supports. The copy guardrail (`support/copyGuardrail.ts`) must scan this document.
- **The math is illustrative**, clearly labeled ("Illustrative figures. Your own volume and economics are modeled in Explore."). It spans all four settings, so it is representative, not one customer's inputs. Illustrative figures must still reconcile (foot-test).
- **Causal rule for signals.** The leading signal must causally drive its outcome. Note/documentation completeness is the universal leading signal; each setting's economics turn it into a different outcome. Case-mix index and overtime are *outcomes*, never leading signals.
- tsc `--noEmit` 0 errors + full `npx vitest run` green + `npm run build` succeeds after every task; `npm run layout:smoke` green.

---

## Document structure (page by page)

1. **Cover** — the universal report cover shared with the other four PDFs.
2. **The record** (the opening / hero) — headline "The note is written from memory." The lossy→faithful record graphic (two record cards side by side: "What there was time to type" vs "What actually happened"), the caption "The same visit, recorded two ways. Every number in this document comes from closing that gap," and the floor strip "What we can measure today · the floor, not the ceiling" (Revenue / Capacity / Workforce / Quality). Locked in the mockup.
3. **The comparison** (centerpiece) — "The same record. Four economics." A five-column matrix (Setting · dominant lever · what the record changes · signal you see first · outcome it opens) across all four settings, with the read-down note that the leading signal is a documentation signal in every setting.
4. **Four setting chapters** (Outpatient · ED · Inpatient · Nursing) — each: causal chain (record changes → mechanism → dollar), leading signals → lagging outcomes, illustrated math, and a three-step "How you attain it" playbook. Outpatient locked in the mockup; the other three follow the same shape.
5. **The attainment close** — how the methodology becomes measured value (baseline → signals → review → act), pointing to Explore / Measure / Attain.

## The comparison matrix (locked content)

| Setting | Unit | Dominant lever | What the record changes | Signal you see first | Outcome it opens |
|---|---|---|---|---|---|
| Outpatient | per visit | Volume × margin | Coded acuity of every visit (E/M, chronic conditions) + time returned | Note completeness, conditions surfaced per visit, time in note | Captured wRVUs, recaptured HCCs, reopened visit access |
| Emergency | per encounter | Speed under pressure | A defensible E/M level + a note that keeps the department moving | Note completeness, charting time per patient | E/M level accuracy, fewer patients left without being seen |
| Inpatient | per discharge | Acuity on complex stays | Complete case-mix + support for the status a stay warrants | Note completeness, CDI query burden | Case-mix (DRG) accuracy, observation-status defense |
| Nursing | per patient-day | Time at the bedside & safety | Flowsheet completeness + hours returned from charting | Flowsheet completeness, time in documentation | Returned bedside time, overtime down, safety signals (revenue is the proof layer) |

## Per-setting chapter content

Each chapter carries: a lever headline; a 3-step causal chain; 3 leading signals; 3 lagging outcomes; illustrated math (reconciling); a 3-step "How you attain it" (realistic operational conversion, legal-safe).

### Outpatient — "Volume is the lever." (LOCKED, from mockup)
- Chain: (1) A complete note, at the point of care — captured as delivered, not reconstructed from memory. (2) Acuity is coded; time is returned — supports the E/M level, surfaces conditions, returns charting hours. (3) Earned revenue, and added access — wRVUs/HCCs thin notes left behind get captured; reopened slots add margin. Counted once.
- Leading: Note completeness ↑ · Conditions surfaced per visit ↑ · Time in note ↓
- Lagging: Captured wRVUs vs baseline ↑ · HCC capture completeness ↑ · Reopened visit access ↑
- Math (illustrative): wRVU capture `248,000 wRVUs × 5% lift × $33.40/wRVU × 90% realization = $373K`; HCC recapture `18,000 members × 0.125 HCC/member × $283/HCC × 50% realization = $318K`; Patient access `2,334 added visits × $220 margin/visit = $513K`.
- Attain: (1) Code to what the note documents. (2) Book the hours it returns. (3) Keep every claim to the record.

### Emergency — "Speed is the lever."
- Chain: (1) A complete note, in real time — the visit documented as it happens, under ED pressure. (2) Level supported; throughput protected — the note supports the E/M level and shortens charting so the provider reaches the next patient. (3) Coded acuity, and revenue that stays — E/M levels reflect the care; fewer patients leave before being seen.
- Leading: Note completeness ↑ · Charting time per patient ↓ · Chart closed before end of shift ↑
- Lagging: E/M level accuracy ↑ · Fewer left without being seen ↓ · Door-to-provider time ↓
- Math (illustrative, to confirm): E/M level coding `264,000 ED visits × 3% coded to a higher supported level × $30 margin = $238K`; Throughput / LWBS `264,000 visits × 0.5% fewer LWBS × $200 margin/visit = $264K`.
- Attain: (1) Code to the documented level. (2) Convert returned time to throughput (fewer leave before seen where providers reach them sooner). (3) Keep every claim to the record.

### Inpatient — "Acuity is the lever."
- Chain: (1) A complete note across the stay — the full clinical picture of a complex admission captured. (2) Case-mix and status, supported — the note supports the codes and the level of care. (3) Accurate DRG, defended status — case-mix reflects true acuity; observation downgrades are defensible.
- Leading: Note completeness ↑ · CDI query burden ↓ · Documentation turnaround ↓
- Lagging: Case-mix (DRG) accuracy ↑ · Observation-status defense ↑ · Case-mix index trend ↑
- Math (illustrative, to confirm): DRG / case-mix `12,000 discharges × 3% more accurate case-mix × $1,000 margin = $360K`; Observation defense `2,000 status reviews × 20% defended × $1,000 margin = $400K`.
- Attain: (1) Code to the documented acuity. (2) Defend status with the record. (3) Keep every claim to the record.

### Nursing — "Time is the lever." (revenue is the proof layer, not the point)
- Chain: (1) Flowsheets complete, in real time — documentation captured at the bedside. (2) Hours returned; risks surfaced — charting time returns to care; safety-relevant findings surface in the record. (3) Time at the bedside, safety as proof — returned hours go to patients; safety signals are tracked, not dollarized.
- Leading: Flowsheet completeness ↑ · Time in documentation ↓ · Charting after shift ↓
- Lagging: Returned bedside time ↑ · Overtime hours ↓ · Safety signals tracked as proof (falls, HAPI)
- Math (illustrative, to confirm): the nursing dollar case is time + workforce, not billing. Overtime avoided `800 nurses × 1 OT hour/week saved × $55/hour × 48 weeks = $211K`; the safety/quality and revenue layers are shown as proof, uncounted.
- Attain: (1) Return the hours to the bedside (documentation time saved becomes care time where it is protected, not backfilled). (2) Track safety as proof, not dollars. (3) Keep every claim to the record.

## The fidelity graphic (locked)

Two side-by-side record cards. Left ("What there was time to type," neutral greys, ~11 short/ragged lines) vs right ("What actually happened," coral + tints, ~11 near-full lines), a thin arrow between. Sized to fill the page's mid-section so the opening reads full, with the floor strip sitting a tight ~28px beneath the caption.

## Engine & integration

- New file `client/src/components/methodology/MethodologyEditorialPdf.tsx` (HTML-print document) + `MethodologyEditorialPdfRoute.tsx` (route `?methodpdf=1`, optional `&setting=<careSetting>` to scroll/anchor a chapter, `&print=1` auto-print), mirroring the App Rat / Explore PDF route pattern.
- Add the `?methodpdf=1` route to `App.tsx`.
- The four on-screen methodology pages (`MethodologyOutpatient/ED/Inpatient/Nursing.tsx`) rewire their download button to open `?methodpdf=1&setting=<x>&print=1` instead of `generateMethodologyPDF(x)`.
- Retire `client/src/lib/methodology-pdf-export.tsx` once nothing imports it (check `ExploreNarrativePDF.tsx` which imports `settingData` from it — migrate that import to the new data source or keep the data module, removing only the react-pdf document).

## Data source

Extend the existing per-setting methodology data with the causal-chain, leading/lagging signals, illustrative math, and attain-step layers. One data module, four settings, consumed by the single document. Keep `settingVocab` for nouns (nurses/patient-days etc.).

## Guardrails / testing

- **Copy guardrail:** add the new PDF file(s) to a methodology copy-guardrail test using `support/copyGuardrail.ts` (em-dash, causal/guarantee, prevents/prevented, credited-to).
- **Foot-test:** `methodologyPdfFooting.test.ts` — every illustrated formula multiplies out to its stated value (illustrative math reconciles), following the `exploreNarrativePdfReconciliation` pattern, and proof-layer domains carry no dollar.
- **Layout smoke:** the `?methodpdf=1` route joins `PDF_ROUTES` (bleed / overflow / pages / NaN / sparse), footer format registered in the sparse detector.
- Tone stays a human review pass.

## Decisions (Brad, 2026-08-02)

- **Illustrative math:** build with the representative figures above and lock them in. They must reconcile (foot-test) and read defensibly; a later clinical pass can adjust values without changing the structure.
- **Lever headlines confirmed:** Outpatient "Volume is the lever," ED "Speed is the lever," Inpatient "Acuity is the lever," Nursing "Time is the lever."
