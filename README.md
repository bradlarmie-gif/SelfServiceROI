# Self Service ROI Tool

What is ambient documentation worth to your practice? A guided estimate a
physician or a small group runs on their own, with no Abridge rep in the room
and no impact-analysis data pull to read from.

One path, end to end:

```
landing  ->  care setting  ->  your goals  ->  your numbers  ->  what changes  ->  your number  ->  PDF
```

Every figure is one the practice typed in themselves. Nothing is pre-filled
with invented data, nothing counts until they switch it on, and the answer is
shown as a range rather than a single confident number.

## Running it

```bash
npm install
DATABASE_URL="postgresql://dev:dev@localhost:5432/dev" PORT=5210 npm run dev
```

The dummy `DATABASE_URL` is fine for local work: the screens make no database
calls and the driver connects lazily.

## Checks

```bash
npx tsc --noEmit                # types
npx vitest run                  # 117 unit tests
npx playwright test             # 16 e2e, desktop + mobile
npm run build
node scripts/layout-smoke.mjs   # overflow, clipped inputs, PDF bleed (needs the dev server)
node scripts/visual-sweep.mjs   # screenshot gallery to review by eye
```

`docs/audit-gates.md` is the standing review checklist: what each guard exists
to catch, the traps this codebase has already fallen into, and the claims
doctrine the copy has to hold to.

## How the numbers work

Every dollar comes from one canonical engine (`lib/exploreDriverCalcs.ts`), and
each driver card prints the engine's own arithmetic, so the number and its
working can never disagree. Each line is discounted for the share that
typically does not land, and says why in plain words rather than making the
reader learn what attribution, conversion and realization each mean.

`docs/EXPLORE_VALUE_MODEL.md` documents that model in full.
