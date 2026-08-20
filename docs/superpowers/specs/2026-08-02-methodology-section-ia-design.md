# Methodology Section IA Rework — Design Spec

**Goal:** Add the missing founding-story page to the on-screen Value Methodology section as a new first tab ("The Methodology"), and rework "Across settings" so its two cross-setting views build into one narrative instead of competing.

**Architecture:** The methodology section is a set of editorial screens under `client/src/pages/methodology/editorial/` navigated by a shared tab bar (`MethodologyHeader`), routed by `LearnPath.tsx`. We add one new screen (`MethodologyOverview`) as the first tab and default landing, and extend `MethodologyContinuum` ("Across settings") with a lead comparison. Content reuses the existing `@/lib/methodologyContent` (`METHODOLOGY_SETTINGS`: lever / comparisonSignals / comparisonOutcomes / unit / the four-value framing) so the on-screen story stays in lockstep with the Methodology PDF; the existing domain dollar-vs-proof matrix keeps using `methodologyData.ts`.

**Tech stack:** React 18 + TS strict + Vite + Tailwind (utility classes, matching the existing cream editorial screens).

## Global constraints

- Voice: plain, mechanism-first. NO em dashes. NO costume words ("faithful"/"fidelity"/"lossy"/"unlock" as vocabulary reaching) — use "complete record".
- Legal: capability + conditional only; never "causes/guarantees/prevents/prevented by" as an Abridge claim.
- Match the existing on-screen editorial tokens (NOT the PDF): page `#FDFCFA`, body `#5E534A`, headings `font-abridge` `#1A1A1A`, eyebrow `#443A32`/coral `#EA2C00`, muted `#8C8073`, hairline `#E8E2DA`, cards `#FDFBF8`, coral `#EA2C00` (money/accent only), 1120px container, the `MethodologyHeader` chrome.
- tsc `--noEmit` 0 errors + `npx vitest run` green + `npm run build` succeeds after every task.
- Copy in the new/changed methodology screen files must be covered by a copy guardrail.

## Information architecture

Tab order (in `MethodologyHeader`): **The Methodology** → Outpatient · Emergency · Inpatient · Nursing → | Across settings.
- New nav key `overview` (label "The Methodology"), rendered FIRST (left of the setting tabs).
- `overview` becomes the DEFAULT landing for the methodology section (you see the "why" first). Existing setting/continuum deep links still resolve to their pages.

## Screen 1 — "The Methodology" (new: `MethodologyOverview.tsx`)

The founding *why*, adapted from the Methodology PDF opening (on-screen, richer). Sections, top to bottom:
1. **Hero** — eyebrow "The record"; headline **"The note is written from memory."** (coral on "memory"); the plain lead (from the mockup: "It gets written after the visit … so the note reflects the care actually delivered.").
2. **The record graphic** — two side-by-side cards: left "What there was time to type" (neutral grey ragged lines) vs right "What actually happened" (coral + tints, near-full lines), an arrow between; caption "The same visit, recorded two ways. **Everything in this methodology comes from closing that gap.**" On screen, animate the right card's lines filling in on scroll (progressive enhancement; must render correctly without JS motion too).
3. **What a complete record makes possible** — section head + sub "One **complete** record feeds four kinds of value at once. These four are the part we can put a defensible number on." A 4-card row: Revenue / Capacity / Workforce / Quality (dot color + one-line desc, from the mockup). Right-aligned note "the floor, not the ceiling".
4. **The signal that leads every setting** — a panel: big "Note completeness moves **first**." + text ("A complete record is the leading signal in every care setting. It shows up in weeks, before any dollar does. What changes setting to setting is the economics it lands on."). Below it, four bridge chips (Outpatient / Emergency / Inpatient / Nursing) that navigate to each setting tab.

Uses `MethodologyHeader active="overview"`.

## Screen 2 — "Across settings" rework (`MethodologyContinuum.tsx`)

One narrative in two beats:
1. **Lead (new): "The same record. Four economics."** — eyebrow "Across the continuum"; headline; lead ("A **complete** record does the same thing everywhere … it lands on different money, because each setting's work, payment, and constraint are different."). Then a comparison table iterating `METHODOLOGY_SETTINGS`: columns Setting (+unit chip) · The lever (`dominantLever`) · The signal you see first (`comparisonSignals`) · The outcome it opens (`comparisonOutcomes`).
2. **Coda (existing matrix, repositioned): "Counted once."** — the existing domain × setting dollar-vs-proof matrix, moved under a "Counted once" heading with the sub about the proof layer moving and no double-counting, followed by the existing "The read" paragraph. This keeps the current matrix + read content; it changes the page's framing so the matrix reads as the integrity proof after the differences story, not as the page's headline.

The old hero ("One conversation. Four domains. Every setting.") is replaced by the new "The same record. Four economics." lead; its intro sentence about the continuum can fold into the new lead or the Counted-once sub.

## Data

- `MethodologyOverview` + the new comparison table consume `METHODOLOGY_SETTINGS` from `@/lib/methodologyContent` (already exists: `label, unit, lever, dominantLever, comparisonSignals, comparisonOutcomes`). No new content data.
- The four-value cards' copy (Revenue/Capacity/Workforce/Quality one-liners) and the hero/graphic/spine copy are static strings in `MethodologyOverview.tsx` (small, screen-specific).
- The "Counted once" matrix keeps using `METHODOLOGY_DATA` from `methodologyData.ts`.

## Guardrails / testing

- **Copy guardrail:** a `methodologyScreenCopyGuardrails.test.ts` scanning the methodology editorial screen files (`pages/methodology/editorial/*.tsx`) with the shared `support/copyGuardrail` (em-dash, causal/guarantee, prevents/prevented-by, credited-to). Also add a small assertion that "faithful" / "fidelity" / "lossy" do not appear (the costume words this feature explicitly bans).
- **Render test:** a lightweight test that `MethodologyOverview` renders the hero headline and the four value labels, and that the reworked `MethodologyContinuum` renders "The same record. Four economics." plus all four settings' levers and the "Counted once" heading.
- tsc + full vitest + build green.

## Decisions (Brad, 2026-08-02)

- Approved the mockup for both screens; lock the direction, spec, and build (subagent-driven).
- "faithful record" in the mockup copy is a costume word; the build uses "complete record".
