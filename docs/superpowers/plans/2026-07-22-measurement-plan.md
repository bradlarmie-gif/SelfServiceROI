# Measurement Plan (the "Plan" step) framework — LOCKED on the access exemplar 2026-07-22

Plan is the MEASUREMENT PLAN. After Align (where they're going + the derived number), Plan is where the partner builds WHAT THEY WILL MEASURE to get there. It answers "what metrics do I track to hit this outcome, and how do I know I'm getting closer." Whatever they pick becomes their scorecard, and it is exactly what the Attainment step then tracks (the closed loop).

## The bar (Brad)
A plan the partner could run Monday. REALISTIC (targets/dates they'd commit to), PRACTICAL (every metric has an owner + a cadence = a scorecard, not a slide), FLEXIBLE (their dates, their metric choices, their reality), DYNAMIC (generated from Align, so "I want X" produces the path to X, never a template with X pasted on). If it's a pretty artifact they can't execute, it failed.

## The exemplar (access) — the shared framework
Files: `client/src/lib/attain/attainMeasurement.ts` (`deriveAccessMeasurementPlan`), `client/src/pages/attain/steps/StepMeasurementPlan.tsx`, additive `planning.measurement` state (in attainPlanning/attainTypes, validated in attainUrlState). Structure:
- PROMISE header kept: goal, editable exec owner (BLANK), prize, "by [their date]" (date input BLANK, no month 9).
- THE MEASUREMENT CHAIN: the causal links IN ORDER, generated from the Align chain/state. For EACH link: a MENU of real metric OPTIONS (partner picks one or more they'll own); each chosen metric shows THEIR baseline (read-only, tagged Your number / From your start / Benchmark), an editable TARGET (defaults to the derived target so the gap shows), a BLANK owner field, and a BLANK rough by-when date. Align choices drive it: the honest gate can close a link, the source/proof answers pre-select and badge metrics ("From what you told us on Align"), scope/Starting-Point numbers set baselines.
- THE COMMITMENT (make-or-break) with its own owner + in-place-by date (blank).
- THE MONTHLY CHECK: walk the chain in order, "X today -> target", owner unset until named; NO fabricated 100%/month ticks.
- Optional partner-risk line.
- Everything persists on `planning.measurement` (additive, backward-compatible) so Attainment tracks exactly these metrics.

## Per-driver measurement chains (dynamic to each Align)
- ACCESS (done): minutes land -> freed time hits the schedule -> the wait falls -> the visits land.
- WORKFORCE: after-hours charting / minutes down -> burnout eases -> likelihood-to-stay rises -> voluntary turnover falls. Metric menus: minutes saved / after-hours charting min; burnout assessment score; likelihood-to-stay / intent-to-stay; voluntary turnover rate / departures avoided. Commitment: protect the relief.
- REVENUE (multi-path): shared root (documentation completeness) -> per chosen path the capture chain -> captured $. Per-path metric menus (E/M: level-of-service mix, avg LOS, % below supported level, wRVUs; HCC: recapture rate, suspected-close rate, conditions/patient; denials: med-nec denial rate, appeal overturn rate). Commitment: coders/providers act.
- QUALITY (multi-event, safety-first): earlier risk surfaced / freed bedside time -> bundle/intervention compliance -> event rate falls (+ HCAHPS presence). Metric menus per event: event rate per 1,000, bundle compliance, near-miss catches, HCAHPS domains. Count leads, dollar soft. Commitment: the Abridge-enabled conversions.
- CAPACITY (nursing OT): minutes down / post-shift charting falls -> OT hours fall -> OT dollars saved. Menus: post-shift charting time, OT hours per nurse, on-time shift completion, OT dollars. Commitment: freed time = leaving on time.

## Build order
1. Access exemplar (DONE, cleared the bar).
2. Clone to Workforce, Revenue, Quality, Capacity (each `deriveXMeasurementPlan`, dynamic to its Align; route through StepMeasurementPlan).
3. Multi-goal Plan: stack each goal's measurement plan under one combined header (mirror StepMultiBuildCase / StepMultiPlanning).
4. CLOSE THE LOOP: make the Attainment hub consume `planning.measurement` (track exactly the chosen metrics + targets + owners + dates), retiring the old StepPlanning phased plan.
5. Final whole-branch review Align -> Plan -> Attainment; fix Critical/Important.

## Design laws
coral/near-black/gray/cream only; NO green/amber/RAG; NO em dashes in user-facing strings; plain teaching voice; capability not promise; blank dates+owners; baselines are their numbers or labeled benchmarks; premium (scorecard, not a form).
