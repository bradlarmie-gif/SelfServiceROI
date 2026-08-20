# PDF Layout Guidelines

How to author and review pages in our `@react-pdf/renderer` PDFs (Nursing,
Outpatient, ED, Inpatient, Forecast, Measure, Explore) so we stop shipping
broken layouts: footer collisions, orphan bullets, page count drift.

These rules exist because layout regressions don't show up in the snapshot
test — the snapshot only checks the React tree, not the rendered geometry.
Every rule below was driven by an actual bug we shipped.

---

## 1. Page chrome contract

Every page in every PDF must obey this contract:

| Token | Value | Why |
|---|---|---|
| `page.padding` (top/left/right) | 54 | Standard margin |
| `page.paddingBottom` | **72** | Must be ≥ `footer.bottom + footer height + 24pt clearance` |
| `footer.position` | `absolute` with `bottom: 28` | Pinned to physical page bottom |
| `footer.height` | ~23pt (border 1 + paddingTop 7 + text ~14 + line-height) | Don't grow this without bumping `paddingBottom` |
| `<View style={styles.footer} fixed>` | `fixed` prop required | Footer must repeat on every wrapped page |

**Math check:** `paddingBottom (72) − footer.bottom (28) − footer height (~23) = ~21pt visual buffer`. Anything less and content collides with the footer text.

If you change any of these numbers, change them all together and re-eyeball every page.

### 1a. Footer 3-slot geometry (REQUIRED)

The footer is `flexDirection: row` with **three explicit-width slots** —
never let any slot be implicitly sized. We shipped a glyph-collision bug
("ASSESSPAMGEENT 1/10") because the center text was unconstrained and was
allowed to grow into the right slot when the org name was long.

| Slot | Style | Content |
|---|---|---|
| `footerLeft` | `width: 90`, `flexShrink: 0` | Brand wordmark / logo (left-anchored) |
| `footerCenter` | `flex: 1`, `textAlign: "center"`, `paddingHorizontal: 8`, `numberOfLines: 1` | Org name only — no document-title suffix |
| `footerRight` | `width: 90`, `flexShrink: 0`, `textAlign: "right"` | `PAGE X / Y` |

The center text must be JUST the organization name — no `· Document Title`
suffix, no version stamp, no separator. Anything appended to the center
text increases the chance of overflow into the right slot. If you need a
document title in the chrome, put it in the page header, not the footer.

---

## 2. Wrap-safe primitives

When a `<Page wrap>` paginates content, react-pdf will break a `<View>` or
`<Text>` anywhere unless told otherwise. Treat these as **atomic units that
must not split mid-element**:

- Single-bullet rows (`MethodologyLine`, summary group rows)
- Driver cards, callouts, KPI tiles
- Headline + first body line of any section
- Closing tail (last 1–2 bullets + disclosure paragraph)

Wrap each in `<View wrap={false}>`. Example:

```tsx
const MethodologyLine = ({ text }: { text: string }) => (
  <View wrap={false}>
    <Text style={...}>{`• ${text}`}</Text>
  </View>
);
```

---

## 3. Orphan protection

Use `minPresenceAhead={N}` on section headers so the header doesn't land at
the bottom of a page with its body on the next one. Pick `N` ≈ enough room
for the header + 2 lines of body (~60pt for our standard subsection
headers).

```tsx
<Text style={styles.subSectionHeader} minPresenceAhead={60}>Methodology</Text>
```

For closing sequences (last bullet + disclaimer), wrap them in a single
`<View wrap={false}>` so they break together as one block.

---

## 4. Forbidden patterns

- ❌ `paddingBottom < 70` on any page that contains a `fixed` footer
- ❌ A driver card, summary group, or KPI tile inside a `<Page wrap>` without `wrap={false}` — these are atomic units; splitting them across pages is the exact "dumb PDF issue" we exist to prevent
- ❌ `<View style={{ flex: 1 }}>` as a direct child of `<Page wrap>` without an explicit height — flex sizing confuses pagination
- ❌ Repeating the same calculations in two places (driver value here, methodology footnote there) — derive both from the same input field on `NursingPDFInput`
- ❌ Adding a new bullet/paragraph to a wrap-enabled page without re-running the visual review (rule 6)
- ❌ **Footer with unconstrained center `Text` in a `flexDirection: row` row.** The center slot must always be `flex: 1` with `numberOfLines: 1`, paired with explicit-width left and right slots (rule 1a). Anything else is the recipe for the "ASSESSPAMGEENT 1/10" collision.
- ❌ **Single-driver-per-page `wrap={false}` cards on a quadrant page.** If a quadrant has 4–5 drivers and each card is ~280pt tall, the page will produce orphan single-driver pages. Use `CompactDriverCard` (rule 9) or a 2-column grid instead (Quality page is the canonical example).

---

## 5. Snapshot test is necessary, not sufficient

Our snapshot tests (`client/src/__tests__/nursingPdfSnapshot.test.tsx`,
etc.) catch:
- Page count changes
- React tree structure changes
- Text-content drift

They do **not** catch:
- Footer collisions
- Orphan content / bad page breaks
- Missing fonts
- Off-screen content

**Update the snapshot only after you've eyeballed the rendered PDF (rule 6).**

---

## 6. Manual visual review checklist

Before merging any change to a PDF component, generate the PDF locally and
flip through every page:

1. **Footer clearance** — bottom-most visible content has at least 24pt of
   whitespace above the footer text.
2. **Footer present on every page** — including all wrapped pages.
3. **Page count footer** — "Page X of Y" math is correct (cover excluded).
4. **No orphans** — no page has just 1–2 lines of content above the footer.
5. **No widows** — no section header is the last line on its page.
6. **All bullets readable** — no half-line cut off at the page edge.
7. **Tables/cards intact** — no card or table row split across pages unless
   wrap-safe.
8. **Data fixture covers max content** — re-run with all drivers enabled,
   long org names, and the largest realistic numbers, since that's the
   layout most likely to overflow.

Flag the PR with "PDF visually reviewed: yes" in the description.

---

## 7. When you change PDF copy

Adding or changing text in a PDF section can push content past the safe
area even if the snapshot still passes. After any copy change to a wrap-
enabled page:

1. Re-run the snapshot test (`-u` if intentional).
2. Generate the PDF and re-do the rule 6 checklist.
3. If a new bullet pushes content close to the footer, either:
   - Tighten copy elsewhere on the same page, or
   - Move the new content to a dedicated page, or
   - Wrap related closing content in `<View wrap={false}>` so it migrates
     together to the next page.

---

## 8. Test fixture rules

The snapshot test fixture (e.g., `nursingPdfSnapshot.test.tsx`) must:

- Enable every optional driver (`hapi.enabled = true`, `falls.enabled = true`, etc.)
- Use a representative org name length
- Use realistic dollar amounts that exercise the `fmtCurrency` branches (`>= 1M`, `>= 1K`, raw)
- Include a non-zero `implementationFee`

Any new optional driver must be added to the fixture in the same PR that
introduces the driver.

---

## 9. Premium aesthetic conventions (Nursing PDF and forward)

These are the typographic and content conventions the Nursing PDF was
overhauled to match (McKinsey/Bloomberg-style executive document). Apply
these as the default for any new PDF section unless there's a specific
reason not to.

### Section labels
- Near-black (`colors.primaryText`), 8.5pt, **letterSpacing: 2.5**, bold,
  uppercase. Brand red is reserved for true accent moments.
- A 5pt red square sits to the left of the label as the visual brand mark
  (`<SectionLabel>` component). Don't stack red on red on red — when red
  appears it should mean something.

### Hero numbers
- Eyebrow (8.5pt uppercase secondary) → number (32–40pt bold primary,
  `lineHeight: 1.0`) → footnote (9.5pt secondary). Three separate `<Text>`
  nodes. Never glue the figure inline with descriptive words in a single
  Text node — that caps how big the number can go without wrapping.

### Edge-case numerics
- Any quadrant/summary/total that can legitimately be `$0` (because the
  underlying drivers are off) must show **"Tracked"** (or "—" / "Tracked
  Separately") with italic accent styling — never `$0` or `$0 (potential)`,
  which read as broken.

### Driver relationships
- When two drivers are conceptually linked (e.g., Agency follows
  Retention), use a small uppercase tag *under* the header
  (`↳ LINKED TO RETENTION`, 7.5pt red bold). **Do not** indent the card
  with `marginLeft` or prefix the header text with a glyph — both are
  visual hacks that fight the grid.

### Card geometry
- `borderRadius: 4` everywhere. No 3, no 8, no 10. One shape language.
- Card padding: 12 (driver cards) or 14 (callouts/cardBg). Pick one of
  those two; don't invent a third.

### Methodology
- Bullet text minimum **9pt** (not 8.5pt — borderline unreadable on
  Letter). `lineHeight: 1.5`, `marginBottom: 5`.

### Forbidden content patterns
- ❌ **Hardcoded "At Scale" / "At Full Scale" projections** that multiply
  real numbers by an arbitrary scaling factor. If we don't have a real
  multi-site projection, don't fabricate one.
- ❌ **"Illustrative target" lists** with hand-picked percentages
  (`−40%`, `+15 pts`, etc.) followed by a tiny disclaimer admitting they
  aren't real. This is "AI slop" and it kills the document's credibility.
- ❌ **Restating the body paragraph in a card immediately below it.**
  If you find two adjacent blocks saying the same thing in slightly
  different words, delete the second one.
- ❌ **Long sentences as `SummaryGroup` row labels.** The label/value row
  is for short label + short value. Explanatory prose belongs in body
  paragraphs, not in a table cell.
- ❌ **Dead helper components** (`TrackedPill` was defined and never
  referenced). Delete what you don't use.

### Quadrant page layout (Workforce / Quality canonical)

A quadrant page (one per Workforce/Capacity/Quality/Revenue) must fit on
**one page** at the standard fixture and the long-org/large-dollar fixture.
Use this composition:

1. **Page header** (red accent bar + section label, ~28pt total)
2. **Hero overview / 2x2 thesis** if applicable, OR a short context paragraph
3. **Driver list** — one of:
   - Stacked **`CompactDriverCard`** rows when there are 3 drivers
     (Workforce). Each card is ~95pt: 2-line header + one-line italic
     formula tail. No 6-row MathGrid inside a card.
   - 2-column grid of compact cards when there are 4–6 drivers (Quality).
     Use `flexDirection: row` with `gap: 10` and each card sized at
     `flex: 1`. Pair drivers logically (HAPI/Falls, CAUTI/CLABSI, etc.).
4. **`HeroSubtotal`** — a tinted card at the bottom of the page with:
   - eyebrow uppercase label (e.g. `WORKFORCE SUBTOTAL`),
   - large dollar figure (28–32pt bold primary, on its own Text node),
   - one-line context footnote.
   This is the page's anchor figure; it is NOT optional.

If your draft would force a single driver onto its own page (orphan),
collapse the driver list to compact cards or a 2-col grid. Big
`wrap={false}` cards belong on cover/thesis pages, not quadrant pages.

### Investment page hero

The Investment & Net Value page must surface the **cumulative-multiple**
("X.X×") as a hero block (rule 9 § Hero numbers), not buried in body
prose. Eyebrow `BY YEAR 3, FOR EVERY $1 INVESTED` → number `X.X×` (36pt,
bold, primary, on its own Text node) → one-line footnote. This is the
page's takeaway.

### Italic font registration

If any `<Text>` uses `fontStyle: "italic"` (which all `Tracked` /
`Tracked Separately` / formula-tail spans do), the custom font family
must register italic variants — even if they're faux-italic
(`{ src: regularTtf, fontWeight: 400, fontStyle: "italic" }`). Without
explicit italic entries, server-side renders throw "Could not resolve
font" and some browsers silently fall back to a system sans-serif.

---

## 10. Files governed by these rules

- `client/src/components/explore/NursingValueAssessmentPDF.tsx`
- `client/src/components/explore/ExploreNarrativePDF.tsx` — Outpatient /
  ED / Inpatient narrative PDF. Adopted the section 1 page-chrome
  contract (3-slot footer, org-name-only center) and the section 9
  premium aesthetic (CompactDriverCard, HeroSubtotal, Investment-page
  cumulative-multiple hero) in task #102.
- `client/src/components/explore/ExplorePDFExport.tsx`
- `client/src/components/pdf/PDFCoverPage.tsx`
- Any future `*PDF*.tsx` files

If you add a new PDF component, mirror the page-chrome contract from
section 1 and the premium aesthetic conventions from section 9, and
reference this doc in the file header.
