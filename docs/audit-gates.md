# Audit gates — Self Service ROI Tool

Repo-specific companion to the general `audit` skill. Read this first on a deep pass.

## What this app is

One path, no salesperson: landing screen → care setting → goals → your numbers →
what changes → your number → a PDF the practice can forward. The reader is a
**physician or a small group practice sizing Abridge for themselves.** They have
no Abridge rep and no impact-analysis data pull. Every figure is one they typed.

That audience is the source of most of the defect classes below.

## Gate commands (all must be green before "done")

```bash
npx tsc --noEmit                # types
npx vitest run                  # 117 tests
npm run build                   # tsx script/build.ts
npx playwright test             # 12 e2e, desktop + iPhone 12
node scripts/layout-smoke.mjs   # needs the dev server on :5210
node scripts/visual-sweep.mjs   # then REVIEW the gallery, do not just run it
```

Dev server:

```bash
DATABASE_URL="postgresql://dev:dev@localhost:5432/dev" PORT=5210 npm run dev
```

`server/index.ts` carries an uncommitted local macOS listen patch (127.0.0.1, no
`reusePort`). Never commit it.

## Standing guards, and why each exists

Every one of these was written after a real defect got through. Each has a
negative control: **plant a violation, watch it fail, restore.** A guard you have
not seen fail is not a guard.

| Guard | Catches |
|---|---|
| `quickRoiCopyGuardrails` | em dashes, guarantee/causal absolutes, **rep vocabulary** (partner, impact analysis, data pull), **realization jargon**, **harm-prevention claims** |
| `settingDomainFit` | a noun hardcoded for one setting and reused on the other three |
| `roiCalculatorNoRawNumber` | raw `type="number"` inputs that cannot be cleared |
| `quickRoiPdfReconciliation` | PDF total drifting from the engine; raw float leaks in rendered HTML |
| `layout-smoke` | overflow, wrapped headers, clipped input values, PDF bleed/NaN, scroll not resetting between steps |

**`scanFiles` silently skips files it cannot read.** A guardrail pointed at a
deleted path passes while checking nothing, which is exactly how the previous
per-tool guardrails rotted. Every guard here asserts its files exist first.

**Not scanned on purpose:** `lib/exploreDrivers.ts`. It reads like copy but only
its driver ids and quadrant mapping are consumed; verified by dumping the
rendered text of every screen in every setting and finding zero matches.

## Known traps in this repo

- **A global CSS rule outranks your class.** `index.css` carries a global
  `input[type="range"]` block (specificity 0,1,1) that beat `.roi-slider` (0,1,0),
  so the slider styling loaded and did nothing. Qualify as
  `input[type="range"].roi-slider`. Probe `getComputedStyle`, do not theorise
  from the JSX.
- **The shared `<Input>` ships `md:text-sm`.** That is a different tailwind
  variant than `text-[19px]`, so merge keeps both and the responsive one wins
  from `md` up: every typed figure rendered at 14px on desktop. Pin the same
  variant (`md:text-[19px]`).
- **Entrance transitions cause false positives.** A screenshot taken before the
  stagger settles shows a Continue button in a pale state that looks disabled.
  Wait ~2s, or assert with `isDisabled()`, before reporting it.
- **Hiding a driver must also stop it counting.** The payer-model answer and the
  ED dependency both hide cards; each has an effect that switches the hidden
  driver off, or a card the practice cannot see keeps adding dollars.
- **`npm run build` while Playwright's static server is up** leaves it serving a
  stale `dist`, so a fix looks like a failure. Kill the listener on :5055 and
  rebuild before trusting an e2e result.

## Reconciliation rule

Any dollar shown twice must tie out: **screen ⇄ engine ⇄ PDF.** The PDF has a
reconciliation test; run it whenever value math changes. A number that looks
wrong is usually a **basis mismatch** (cautious vs full realization, per-visit vs
per-admission), not a typo. Trace the basis first.

The answer is a **range**: the low figure applies the calibrated realization
haircuts, the high figure applies none. Both the screen and the PDF must show
the same two numbers.

## Claims doctrine (this app ships to doctors; Legal reads it)

- Never assert Abridge **prevents** clinical harm. The care team acts; the
  documentation supports them. Any avoided-harm share keeps the team as subject
  and is labelled as the practice's own judgement.
- Never say a figure was **measured**. Nothing here was measured.
- Lift only, margin not charges, realization applied, result in a defensible
  band. Conservatism is a judgement, not a computation: check the output band at
  a tiny practice and a huge one.
- An account-specific scale input (panel size, staffed beds) starts **blank**.
  A formula-derived default is still fabricated data.

## Preview routes

- `/` — the app
- `?quickroipdf=1` — the PDF print route (`&print=1` opens Save as PDF)

Verify the PDF with a real Chrome render, not just the HTML: Chrome drops
background fills at print time unless `print-color-adjust: exact` is set, which
is why the composition bar once arrived as grey numbers in white space.
