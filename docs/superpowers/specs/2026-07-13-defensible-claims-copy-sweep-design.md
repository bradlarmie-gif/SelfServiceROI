# Defensible-Claims Copy Sweep

Date: 2026-07-13

## Goal

Remove copy across the ROI Calculator that asserts, as general truth, that
Abridge *causes* a clinical, financial, or workforce outcome. Legal does not
want declarative causation ("Abridge reduces denials"). The Measure path is the
top priority, but the whole app is in scope.

## The doctrine (how every flagged claim is rewritten)

1. **Outcome-causation becomes capability plus a condition.** Copy that says
   Abridge causes a result gets reframed so the tool's role and the human role
   are both visible. The outcome is possible, not promised.
2. **"Caused by" / "credited to Abridge" becomes "attributed to" or
   "associated with."** The customer's own measured numbers stay. They are
   framed as observed and attributed, not as proof Abridge caused them.
3. **Absolutes always soften:** `will`, `guarantee(s)`, `ensure(s)`,
   `eliminate(s)`, `prevents`, `proven to` are removed.
4. **Product-action claims are left alone.** "Captures the conversation,"
   "drafts the note," "surfaces the gap" describe what the tool does. These are
   factual and stay.
5. **Meaning and persuasiveness are preserved.** This is not about making the
   copy timid. It is about making the causal assertion defensible while keeping
   the argument sharp.

## Style rules (non-negotiable)

- **No em dashes.** Restructure into short sentences with periods, or use
  commas and "and". Hyphens in ranges (50-75%) are fine.
- **No corporate jargon.** Banned words: leverage, enable, empower, facilitate,
  utilize, unlock, seamless, robust, solutions, drive (as a verb for outcomes).
  Use plain, concrete language. "Designed to" is allowed but used sparingly, not
  as a reflex.
- **Deliberate and plain.** Prefer the shortest honest sentence.

## Reframe examples

- "Abridge reduces the gaps that trigger denials."
  becomes
  "Abridge surfaces documentation gaps that can lead to denials. When teams
  close them, fewer claims come back."
- "100% of the change credited to Abridge"
  becomes
  "100% of the change attributed to Abridge"
- "This will improve provider retention."
  becomes
  "This can support provider retention."

## What to leave alone

- Descriptions of product behavior (capture, transcribe, draft, surface).
- The customer's own measured results, when framed as observed/attributed with
  the existing attribution caveats.
- Numbers, formulas, benchmarks.

## Phasing (each phase is its own commit for incremental review)

1. **Measure interactive UI** (`client/src/pages/measure/*.tsx`). Priority.
2. **Shared driver copy** (`client/src/lib/exploreDrivers.ts`,
   `client/src/lib/measureCareSettings.ts`). Feeds Measure and Explore.
3. **Generated PDF copy** (`client/src/components/measure/MeasureNarrativePDF.tsx`
   content maps and narrative). Highest legal exposure.
4. **Explore / Forecast / methodology** pages. Largest surface, done last.

## Method

Grep for causal and declarative verbs and for `Abridge <verb>` patterns, then
read each intro and description block by eye, because grep misses phrasing.
Conservative bias: when a line only describes product behavior, leave it.

## Success criteria

No copy asserts, as a general claim, that Abridge causes an outcome. Outcome
language is capability-framed or conditional. Product-action copy and the
customer's own measured data are preserved. No em dashes. No jargon.
