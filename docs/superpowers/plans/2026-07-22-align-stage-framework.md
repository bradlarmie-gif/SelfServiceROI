# Align stage framework (LOCKED with Brad, 2026-07-22)

Re-architects the "Build the case" step into **Align**. The step-down engine/derivation underneath is UNCHANGED; this replaces the slider/toggle ladder UI with a small set of "choose your meaning" questions. The derived number still comes from the same engine, now fed by the choices (+ optional number sharpeners + facts inherited from Starting Point).

## Philosophy
- Purpose of Align = get SHARED UNDERSTANDING of what the partner means when they say "I want X." You co-author it with them, you don't present at them. The derived number is the PROOF of alignment, not the goal.
- Flow reads: Vision (what you want) -> **Align** (what you actually mean + what's ours to move) -> Plan (commitments, owner, phased signals) -> Attainment (tracking).
- RENAME "Build the case" / "Build your strategy" -> "Align" everywhere (label, breadcrumb, header, nav, progress). Underlying step id may stay.

## The universal template (<=5 "choose" questions per driver)
1. **Outcome** - what specifically are you after (disambiguate the vague ask). For multi-path drivers this is the path/event SELECTOR.
2. **Who** - the population (count INHERITED from Starting Point, not re-asked; they pick the cut).
3. **The honest gate** - is this problem even one Abridge can move (documentation/time-driven), versus causes it can't touch. Sets the honest ceiling.
4. **Where it lives** - the specific source/pain/channel (shapes the number and the story). For Quality this slot becomes "what will you change" (see Quality).
5. **Proof** - what evidence would convince you it worked. Becomes the Plan's signals. Antidote to "EBRs full of metrics nobody agreed mattered."

## Hard rules
- FACTS live on Starting Point, asked ONCE (size, turnover, replacement cost, baseline charting, panel/volume, beds/census). Align INHERITS them and only asks DECISIONS/meaning. (Kills the "why are you asking providers again" redundancy.)
- NUMBERS OPTIONAL: the CHOICE is required (that's the alignment); a number just SHARPENS the derived figure. No number -> a clearly-labeled benchmark fills in (never a fabricated-precise figure), and the ladder shows a benchmark-based estimate instead of a dead $0. This also fixes the blank-facts $0 problem.
- MULTI-SELECT STACKS: when they pick multiple paths/events, the gate-and-where questions repeat once PER path/event they chose (the 5 dimensions hold; the per-path ones stack).
- COMMITMENTS + OWNER + SIGNALS live in the PLAN, not Align (protect-the-relief, direct-freed-time-to-schedule, coders-act). EXCEPTION: Quality's conversions are aligned up front (see Quality) because Abridge's role there is indirect.
- Framing: CAPABILITY not promise ("if Abridge frees the time," never "when"). Never claim Abridge "causes" an outcome.
- The number DERIVES from choices + inherited facts via the existing engine. Choices map to the engine's numeric inputs; optional number inputs override the benchmark.

## Per-driver Align questions

**WORKFORCE (retention).** Financial. Commitment -> Plan.
1. What are you after: keep our people (reduce voluntary turnover) / a better day (wellness) / both.
2. Who: which providers (count inherited).
3. Gate: what's driving your departures - mostly burnout & workload / a meaningful share / mostly pay or life.
4. Where the burden hurts: in the visit (screen not patient) / after hours (charting at night) / both.
5. Proof: turnover number moving / Love Stories from clinicians / burnout-engagement pulse / all.
Plan commitment: protect the freed time as relief (the make-or-break) + owner + signals.

**ACCESS (outpatient) and CAPACITY (the same, outpatient capacity quadrant).** Financial. Commitment -> Plan.
1. What are you after: burn down the backlog / cut the wait for a new appt / open room to grow.
2. Who: which lines/providers (count inherited).
3. Gate (NEW, access lacked it): why can't you see more today - providers maxed & buried in documentation (Abridge frees that) / not enough providers, rooms, staff (Abridge can't add bodies) / not enough demand.
4. Where's the demand: referral backlog / new referrals / same-day urgent / no-shows to recover (numbers OPTIONAL).
5. Proof: wait time / third-next-available dropping / backlog shrinking / more visits happening / Love Stories.
Plan commitment: direct the freed time to the schedule as bookable slots (freed time defaults to relief) + owner + signals.

**CAPACITY (nursing = OVERTIME).** Financial. Commitment -> Plan.
1. What are you after: cut overtime cost / nurses finishing on time / both.
2. Who: which units/nurses (count inherited).
3. Gate: why is there overtime - documentation / post-shift charting (Abridge frees that) / short staffing / census surges.
4. Where: post-shift charting / batching during the day / missed lunches.
5. Proof: OT hours per nurse down / on-time shift completion / the OT dollars in budget / Love Stories.
Plan commitment: make sure freed time = leaving on time, not more tasks + owner + signals.

**REVENUE (outpatient/ED/inpatient). MULTI-PATH (stacks per path).** Financial. Commitment -> Plan.
1. What revenue: Risk adjustment (HCC) / E&M level accuracy / Medical-necessity denials (multi-select). [ED = E&M + denials; inpatient = DRG + CDI + obs, mapped to this shape.]
2. Who/where PER path: E&M -> which providers + employed/productivity-pay share (decides if wRVU even lands) + E&M visit volume (optional #); HCC -> risk-based population (MA/Medicaid managed/ACA); denials -> which lines.
3. Gate PER path: is the leak because the NOTE didn't capture it (Abridge moves that) vs things it can't (low acuity / conditions patients don't have / payer rules). "Mostly payer rules" -> we don't promise the denial win.
4. Where PER path: which specialties/visit types lose the most.
5. Proof: the coding metric moving (level-of-service mix, recapture rate, denial rate) / captured $ showing up / revenue-cycle team sees it.
Plan commitment: the coders/providers ACT on the better documentation (close HCC gap, code to level, resolve query) + owner (VP Rev Cycle) + signals.

**QUALITY (nursing). MULTI-EVENT (stacks per event). THE HONEST EXCEPTION.**
Nursing quality does NOT produce a clean ROI like the financial three. So: SAFETY/EXPERIENCE leads, the dollar (cost of harm avoided) is a SOFT, clearly-labeled footnote, never the hero. Abridge's role is INDIRECT (it surfaces risk earlier / frees bedside time; the UNIT prevents). Therefore the CONVERSION is aligned UP FRONT (in Align), not deferred to the Plan.
CRITICAL: every intervention must be a CONVERSION OF ABRIDGE'S TWO BENEFITS - (a) freed bedside time, (b) earlier + complete risk documentation. NEVER a generic clinical bundle (no non-slip footwear, no bed alarms - those have no Abridge in them and let the skeptic ask "how is Abridge impacting this?"). We claim only what the freed time and earlier signal let them do ON TOP OF their existing bundle.
1. Which outcome (multi-select, stacks): Falls / HAPI / CLABSI / CAUTI / Sepsis / **HCAHPS** (patient experience). Outcome = safety/experience first, dollar soft.
2. Who: which unit (beds/census inherited).
3. Gate PER event: how much is preventable by catching risk EARLIER (Abridge's part) vs happens despite good care.
4. **What will you change PER event** - a CONVERSION of Abridge's benefits, e.g.: redeploy freed charting time into more rounding/eyes on high-risk patients (TIME); act on the risk that surfaces earlier in the record - dizziness, skin note, early deterioration (DOCUMENTATION); tighten shift handoffs on the more complete real-time notes (DOCUMENTATION); for HCAHPS, protect the face-to-face presence the freed time buys (TIME). NOT standalone clinical bundles.
5. Proof: event rate per 1,000 dropping / bundle compliance / near-miss catches / HCAHPS domain scores / Love Stories of a patient caught earlier.
Honest attribution line: Abridge ENABLES (time + earlier docs), the team CONVERTS, the outcome is both. HCAHPS is the cleanest Abridge story (presence).

## Design laws (STRICT)
coral #EA2C00 / near-black #1A1A1A / neutral grays / cream #F4F0EA only. NO green/amber/RAG. NO em dashes in user-facing strings. Plain teaching voice, no jargon. Premium, intuitive, scalable. Decisions/meaning lead; the number is proof.

## Build order
1. Shared Align framework (AlignStep + ChooseQuestion + optional-number-sharpener + per-path/event stacking + inherit-facts-from-Starting-Point + benchmark-when-blank) + WORKFORCE Align as the exemplar; rename Build-the-case -> Align. VERIFY visually before cloning.
2. Access + Capacity (outpatient) Align.
3. Capacity (nursing overtime) + Revenue (all settings) Align.
4. Quality (nursing) Align with the Abridge-enabled conversions + HCAHPS + safety-first.
5. Cross-cutting: relocate remaining commitments to the Plan; consolidate facts onto Starting Point.
6. Final whole-branch review + multi-goal check.
