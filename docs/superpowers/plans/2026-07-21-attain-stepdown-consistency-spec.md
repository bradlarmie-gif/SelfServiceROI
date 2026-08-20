# Attain step-down consistency spec (Build the case + Planning)

**Goal:** Build the case and Planning tell ONE continuous step-down story per domain/setting. Access is the locked exemplar. Build the case = assemble the ladder (editable). Planning = the same ladder on the hook + phases/owners/signals. They render from one shared ladder so they cannot diverge.

## The general ladder
First domino (the Abridge deliverable) -> multiplying rungs -> THE GATE (the ceiling that decides how much converts) -> realized units -> x $/unit = prize.

- Money is derived proof, never conjured. Every number reconciles to the engine (exploreDriverCalcs / attain*).
- One capacity mechanism, no double-count. The gate is a ceiling, not a multiplier.

## The question-sequence DNA (every step, Build the case + Planning)
Each step reads as a CONVERSATION, not a calculator. A short sequence of questions, each doing one job (Brad locked this on the Revenue E/M walkthrough, 2026-07-22):
1. GROUND IT in their operational reality — facts that size the path or disqualify it (E/M: providers employed and what %? how many encounters are E/M visits?). Honest enough to shrink/switch the path off.
2. CONFIRM THE LEAK IS ABRIDGE'S TO FIX (the diagnosis / "LWBS test") — separate the documentation-caused share (Abridge can move) from what Abridge can't touch. This is the load-bearing rung; without it a step just re-shows the Explore math. Access had it (the demand gate); Revenue lacked it.
3. WHO HAS TO ACT — the partner-owned fragile middle.
4. THE NUMBER FALLS OUT — derived, never asserted.
Plain language, no jargon (killed "downcoding" -> "the claim goes out below the care you delivered").

## Per domain

**Access (exemplar).** First domino = minutes saved per note (target we prove first). Rungs: freed hours x directed share / visit length = capacity. GATE = demand (real countable sources; all/one/none valid). Realized = min(capacity, demand). x margin/visit = prize.

**Workforce / Retention (all settings).** First domino = the SAME freed time, held as protected relief. Rungs: freed hours -> relief protected -> burnout reduction (composite impact, capped at the REACHABLE ceiling). GATE = burnout-attributable pool (providers x turnover x burnout-share), the ceiling on avoidable departures. Realized = departures avoided. x replacement cost = prize.
- FIX: relabel "pp of turnover" -> "% of burnout-related departures avoided".
- FIX: recalibrate the prize to what the chain can actually reach (not the aspirational story number).
- FIX (Brad 2026-07-22): impact ceiling = **50% of burnout-related departures avoided** (was 15%, way too low). Rescale the composite lever formula so a fully committed plan actually REACHES ~50% (not just a cap that never binds), with the default a sensible mid-point. Update all "ceiling 15%" copy on Build + Planning to 50%. Applies to retention in EVERY setting. Keep reconciliation to computeWorkforceChain / providerWellbeing intact.
- If access is also selected, ONE freed-hour split, shown once, never double-counted.
- DUAL OUTCOME: lower voluntary turnover AND a better clinician experience. Turnover/replacement cost is the CFO dollar; experience is the human outcome that drives it. Both present in the story.
- CONCRETE LEVER = work outside of work (after-hours / pajama-time charting). Freed time not sent to the schedule goes back to the clinician's evening. Chain: less after-hours charting -> better experience -> lower burnout -> higher likelihood to stay -> fewer voluntary departures -> replacement cost saved. This is the natural other half of the access/retention split (access -> more visits; retention -> clinician's evening).
- SIGNALS (and Planning phase signals): after-hours charting time (down), burnout assessment score (improving), likelihood-to-stay / intent-to-stay (rising), then voluntary turnover (falling). Phase 1 = after-hours charting down; later phases = burnout score, then likelihood-to-stay, then turnover. This is where partner data rounds out the story.

**Revenue (OP / ED / IP). MULTI-PATH.** Shared first domino = complete, specific documentation at the point of care. Then parallel sub-ladders, each: eligible encounters/population in scope -> capture-rate improvement -> captured claims -> x $/claim.
- OP: HCC capture, E/M level accuracy (wRVU), denials. ED: E/M-wRVU, medical-necessity denials. IP: DRG capture, CDI, obs-defense.
- Each path: own ceiling + own owner (coder / provider / CDI) + own coding-quality signal.
- FIX: E/M tied to acuity/level (or labeled honestly, not a blunt % lift); denials priced at margin not charges; DRG/CDI never double-count the same captured weight; pp vs % consistent.

**Quality (nursing). PER EVENT** (HAPI/CLABSI/Falls/Sepsis). First domino = earlier risk surfacing (Abridge surfaces, the unit prevents; defensible-claims frame). Per event: risk surfaced -> bundle/intervention compliance -> prevented events -> x cost/event.
- FIX: recalibrate prevention ceiling to the defensible band (~6-12%, not 60%); per-event interventions + signals; conservative attribution; acknowledge partly non-financial value.

**Capacity (nursing) = OVERTIME (new goal).** Completes the 4 quadrants for nursing. Reconciles to the EXISTING engine driver `nursingOvertime` (exploreDriverCalcs.ts: nursingOtHoursPerNurseWeek x nursingOtReductionPercent x nurses x weeks x nursingOtHourlyRate; conservative conversion 15-40%, OT rate ~1.5x). First domino = minutes saved per note -> nurses chart in the moment, not post-shift. Deconstruct the OT: how much OT runs now, how much is documentation-driven (post-shift charting prominence, batching notes and catching up late, missed lunches pushing work past shift end) = documentation-attributable OT. GATE = documentation-attributable overtime (you can only cut OT charting causes, not OT from short staffing/census). Conversion = the conservative share Abridge removes. Prize = OT hours avoided x loaded OT rate.
- No double-count with retention: OT = wages you stop paying now; retention = replacement cost of a nurse who would have quit. Different dollars, same root (reduced after-hours charting). Engine already keeps them as separate lines. Scope each tightly, say the shared root plainly. Same "counted once, different claims" discipline as revenue.

## Build the case = assemble the ladder
Same order/first-domino/gate as Planning. First domino elevated as the target. Demand/ceiling shown as THE GATE. Live number in the side panel (not buried at the bottom). Math inline + transparent. Drop the "drag N decisions" puzzle; decisions are the editable rungs. De-clutter (no dangling "capacity" word, realization rate de-emphasized, enterprise toggle inside the scope rung, one crisp intro line).

## Planning = the ladder on the hook
Promise line (goal, exec owner, prize, date). The read-only ladder. Three phases (Start/Expand/Steady) with a derived value ramp, one leading signal per phase (phase 1 = the first domino), editable owners. Monthly checkpoint ending on attainment %. Optional partner-disclosed risk (renders only when filled). No prescribed weak link.

## Planning metric building blocks (the signal dropdowns, per domain)
The per-phase leading-signal dropdowns must offer REAL, domain-appropriate trackable metrics (the metrics are the proof), tailored and editable, not generic. Menus:
- Access: third-next-available (days), referral backlog count, new-patient wait, no-show rate, realized visits/yr, minutes saved per note.
- Workforce/Retention: after-hours charting minutes/day (pajama time), burnout assessment score, likelihood-to-stay / intent-to-stay %, voluntary turnover rate, minutes saved per note.
- Revenue E/M: wRVUs (per provider / total), distribution of E/M levels of service, average level of service, % of visits coded below the supported level, conversion factor ($/wRVU).
- Revenue HCC: recapture rate, suspected-condition close rate, average conditions per patient (RAF), documented-but-uncoded gap.
- Revenue denials: medical-necessity denial rate, denial $ value, appeal overturn rate, documentation-related denial share.
- Quality (per event): event rate per 1,000 (pt-days / line-days), bundle/intervention compliance %, real-time gap closure %.
- Nursing Capacity (overtime): OT hours per nurse/week, share of OT that is documentation-attributable, on-time shift completion %, missed-lunch rate.
Phase 1's default signal is the first domino; later phases move down the menu toward the outcome metric. Finishing pass: sweep every domain's dropdowns after the builds to confirm the menus reflect reality.

## Design laws (STRICT)
coral #EA2C00 / near-black #1A1A1A / neutral grays / cream #F4F0EA only. NO green/amber/RAG. NO em dashes in user-facing strings. Plain teaching copy (one idea/line, no jargon, teach the mechanism). Derived numbers only. Premium, CFO-legible, decisions lead and money is derived.

## Build order
1. Access Build-the-case redesign (lock the exemplar pair; extract the shared ladder).
2. Workforce Build+Planning, all settings (general gate + shared-hour split + unit/prize fixes).
3. Revenue Build+Planning, all settings (multi-path + unit fixes).
4. ED access (repair severed mechanism + one $ unit) + Planning.
5. Quality (per-event rework + defensible ceiling) + Planning.
6. Capacity (nursing) = overtime: new goal exposing the existing `nursingOvertime` driver as the step-down ladder (Build + Planning); add to the nursing goal matrix.
