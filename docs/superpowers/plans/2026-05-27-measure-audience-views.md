# Measure Audience Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent audience toggle (Clinical / Operational / Financial / Executive) to the Measure Output page that filters dollar visibility, hides the Revenue quadrant for Clinical, and surfaces clinician quotes — plus timestamps and data-source labels per driver entry.

**Architecture:** All audience logic lives as local UI state in `MeasureOutput.tsx` (never persisted). New data fields (`measuredAt`, `entryDataSource`, `quotes`) are added to `MeasureState` / `MeasureDriverEntry` in `measureCalculator.ts` and flow through the existing `buildDriverPayload` function to the display components. A `QuotesBlock` and inline `ManageQuotesPanel` are added as co-located components inside `MeasureOutput.tsx`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide icons. Type-check with `npm run check` from repo root.

---

## File Map

| File | Change |
|---|---|
| `client/src/lib/measureCalculator.ts` | Add `MeasureQuote`, `EntryDataSource`, extend `MeasureDriverEntry`, extend `MeasureState` |
| `client/src/components/measure/MeasurePDFExport.tsx` | Add `measuredAt` + `entryDataSource` to `MeasurePDFDriver` |
| `client/src/pages/measure/MeasureOutput.tsx` | Audience toggle, filtering logic, QuotesBlock, ManageQuotesPanel, pills on cards |
| `client/src/components/measure/MeasureDriverCard.tsx` | Add date + source inputs to expanded accordion |

---

## Task 1: Extend types in measureCalculator.ts

**Files:**
- Modify: `client/src/lib/measureCalculator.ts`

- [ ] **Step 1: Add `EntryDataSource` type and `MeasureQuote` interface**

  Open `client/src/lib/measureCalculator.ts`. After line 116 (`export type MetricDataSource = 'ehr' | 'survey';`), add:

  ```ts
  export type EntryDataSource = 'ehr' | 'survey' | 'admin_data' | 'chart_review' | 'manual_entry';

  export interface MeasureQuote {
    id: string;
    text: string;
    attribution: string;
    role?: string;
  }
  ```

- [ ] **Step 2: Add `measuredAt` and `entryDataSource` to `MeasureDriverEntry`**

  In the `MeasureDriverEntry` interface (lines 211–226), add two optional fields after `scaleDivisor`:

  ```ts
  export interface MeasureDriverEntry {
    driverId: string;
    withoutAbridge: number;
    withAbridge: number;
    valuePerUnit: number;
    attributionPercent: number;
    realizationPercent: number;
    expanded: boolean;
    notes?: string;
    isMonthlyMode?: boolean;
    monthlyData?: Array<{ month: string; withAbridge: number; withoutAbridge: number }>;
    lowerIsBetter?: boolean;
    distributionData?: { before: Record<string, number>; after: Record<string, number> };
    scaleValue?: number;
    scaleDivisor?: number;
    measuredAt?: string;
    entryDataSource?: EntryDataSource;
  }
  ```

- [ ] **Step 3: Add `quotes` to `MeasureState`**

  In the `MeasureState` interface, after `maturityPhase: MaturityStage | null;` (line 208), add:

  ```ts
  quotes?: MeasureQuote[];
  ```

- [ ] **Step 4: Verify types compile**

  Run from repo root:
  ```bash
  npm run check
  ```
  Expected: no new errors (existing errors, if any, are pre-existing).

- [ ] **Step 5: Commit**

  ```bash
  git add client/src/lib/measureCalculator.ts
  git commit -m "feat(measure): add EntryDataSource, MeasureQuote types; extend MeasureDriverEntry and MeasureState"
  ```

---

## Task 2: Add new fields to MeasurePDFDriver and pass through buildDriverPayload

**Files:**
- Modify: `client/src/components/measure/MeasurePDFExport.tsx`
- Modify: `client/src/pages/measure/MeasureOutput.tsx`

- [ ] **Step 1: Extend `MeasurePDFDriver` in MeasurePDFExport.tsx**

  In `client/src/components/measure/MeasurePDFExport.tsx`, import `EntryDataSource` at the top:

  ```ts
  import { ..., type EntryDataSource } from "@/lib/measureCalculator";
  ```

  In the `MeasurePDFDriver` interface (lines 108–128), add after `setting?: string;`:

  ```ts
  measuredAt?: string;
  entryDataSource?: EntryDataSource;
  ```

- [ ] **Step 2: Pass fields through `buildDriverPayload` in MeasureOutput.tsx**

  In `client/src/pages/measure/MeasureOutput.tsx`, the `buildDriverPayload` function returns an object around lines 104–123. Add the two new fields to the return statement after `notes: entry.notes`:

  ```ts
  return {
    id: driver.id,
    label: driver.label,
    shortDescription: driver.shortDescription,
    visibility: driver.visibility,
    isMonthlyMode: Boolean(entry.isMonthlyMode),
    withoutAbridge: effWithout,
    withAbridge: effWith,
    delta,
    valuePerUnit: entry.valuePerUnit,
    attributionPercent: entry.attributionPercent,
    realizationPercent: entry.realizationPercent,
    realizedValue,
    notes: entry.notes,
    monthlyData: sortedMonthly.length > 0 ? sortedMonthly : undefined,
    deltaUnit: md?.deltaUnit,
    deltaLabel: md?.deltaLabel,
    valuePerUnitLabel: md?.valuePerUnitLabel,
    valuePerUnitPrefix: md?.valuePerUnitPrefix,
    measuredAt: entry.measuredAt,
    entryDataSource: entry.entryDataSource,
  };
  ```

- [ ] **Step 3: Verify types compile**

  ```bash
  npm run check
  ```
  Expected: no new errors.

- [ ] **Step 4: Commit**

  ```bash
  git add client/src/components/measure/MeasurePDFExport.tsx client/src/pages/measure/MeasureOutput.tsx
  git commit -m "feat(measure): pass measuredAt and entryDataSource through driver payload"
  ```

---

## Task 3: Add audience toggle to MeasureOutput.tsx

**Files:**
- Modify: `client/src/pages/measure/MeasureOutput.tsx`

- [ ] **Step 1: Add audience state and derived display flags**

  In the `MeasureOutput` component body, just after the existing `useState` calls (around line 278), add:

  ```tsx
  type Audience = 'executive' | 'clinical' | 'operational' | 'financial';
  const AUDIENCE_LABELS: Record<Audience, string> = {
    clinical: 'Clinical',
    operational: 'Operational',
    financial: 'Financial',
    executive: 'Executive',
  };

  const [audience, setAudience] = useState<Audience>('executive');

  const showDollars = audience === 'financial' || audience === 'executive';
  const showRevenue = audience !== 'clinical';
  const showQuotes = (audience === 'clinical' || audience === 'executive') && (state.quotes?.length ?? 0) > 0;
  ```

  Note: `type Audience` should be defined at module scope (outside the component), not inside. Move `type Audience` and `AUDIENCE_LABELS` to just before the component function (around line 275).

- [ ] **Step 2: Render the audience toggle pill switcher**

  Find the comment `{/* ── Domain sections ─────` (around line 547). Immediately before this block (after the closing `</motion.div>` of the Hero card), insert the toggle row:

  ```tsx
  {/* ── Audience toggle ─────────────────────────────────────────── */}
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-1 bg-[#F5F0EB] rounded-full p-0.5">
      {(['clinical', 'operational', 'financial', 'executive'] as Audience[]).map(a => (
        <button
          key={a}
          onClick={() => setAudience(a)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
            audience === a
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-[#8C7E6E] hover:text-neutral-900'
          }`}
          data-testid={`audience-tab-${a}`}
        >
          {AUDIENCE_LABELS[a]}
        </button>
      ))}
    </div>
    {/* Manage Quotes button added in Task 5 */}
  </div>
  ```

- [ ] **Step 3: Filter Revenue quadrant from single-setting domain sections**

  In the single-setting render path (around line 656), change:

  ```tsx
  quadrants.filter(q => q.drivers.length > 0).map(...)
  ```

  to:

  ```tsx
  quadrants
    .filter(q => q.drivers.length > 0 && (showRevenue || q.quadrant !== 'Revenue'))
    .map(...)
  ```

- [ ] **Step 4: Filter Revenue from multi-setting domain sections**

  In the multi-setting render path (around line 580–651), the inner `ss.settingQuadrants.map(...)` renders quadrant rows. Change the `.map(q => {` to filter first:

  ```tsx
  {ss.settingQuadrants
    .filter(q => showRevenue || q.quadrant !== 'Revenue')
    .map(q => {
      // ... existing code unchanged
    })}
  ```

- [ ] **Step 5: Filter Revenue from hero "By Domain" breakdowns**

  In both the multi-setting "By Domain" breakdown and the single-setting "Value by Domain" breakdown (around lines 482–535), filter the `QUADRANT_ORDER.map(q => ...)`:

  ```tsx
  {QUADRANT_ORDER
    .filter(q => showRevenue || q !== 'Revenue')
    .map(q => { ... })}
  ```

  Apply this to both the multi-setting and single-setting versions.

- [ ] **Step 6: Verify types compile and toggle renders**

  ```bash
  npm run check
  ```

  Start dev server and manually verify: toggle appears between Hero and domain sections, Clinical pill hides Revenue quadrant and its domain bar.

- [ ] **Step 7: Commit**

  ```bash
  git add client/src/pages/measure/MeasureOutput.tsx
  git commit -m "feat(measure): add audience toggle with Revenue filtering for Clinical view"
  ```

---

## Task 4: Audience-aware dollar visibility

**Files:**
- Modify: `client/src/pages/measure/MeasureOutput.tsx`

Dollar amounts appear in four places: (1) `FinancialDriverCard` top-right value, (2) Hero headline number, (3) Hero "By Domain" per-quadrant totals, (4) domain section header totals (collapsible card headers). All should be hidden when `!showDollars`.

- [ ] **Step 1: Add `showDollars` prop to `FinancialDriverCard`**

  Change the `FinancialDriverCard` prop interface at line ~127:

  ```tsx
  function FinancialDriverCard({
    drv,
    settingBadges,
    lowerIsBetter,
    showDollars,
  }: {
    drv: MeasurePDFDriver;
    settingBadges: string[];
    lowerIsBetter?: boolean;
    showDollars?: boolean;
  }) {
  ```

  Then wrap the realized value block (the `drv.realizedValue !== 0 && (...)` block at lines ~155–163) in `showDollars`:

  ```tsx
  {showDollars && drv.realizedValue !== 0 && (
    <div className="text-right flex-shrink-0">
      <p className="text-xl font-bold text-[#EA2C00] tabular-nums leading-none">
        {'$' + Math.round(drv.realizedValue).toLocaleString()}
      </p>
      <p className="text-[10px] text-[#AAAAAA] mt-0.5">realized / yr</p>
    </div>
  )}
  ```

- [ ] **Step 2: Pass `showDollars` to all FinancialDriverCard usages**

  There are two usages — one in the multi-setting path (~line 628) and one in the single-setting path (~line 717). Update both:

  ```tsx
  <FinancialDriverCard
    key={drv.id}
    drv={drv}
    settingBadges={getDriverSettingBadges(drv)}
    lowerIsBetter={getDriverLowerIsBetter(drv.id)}
    showDollars={showDollars}
  />
  ```

- [ ] **Step 3: Hide dollar totals in domain section headers**

  In the multi-setting path, the section header shows `ss.settingTotal` (~line 574):

  ```tsx
  {showDollars && ss.settingTotal > 0 && (
    <span className="text-base font-bold text-[#EA2C00] tabular-nums">{formatCurrency(ss.settingTotal)}</span>
  )}
  ```

  In the quadrant row toggle button (~line 606):

  ```tsx
  {showDollars && q.realizedTotal > 0 && (
    <span className="text-sm font-bold tabular-nums" style={{ color }}>{formatCurrency(q.realizedTotal)}</span>
  )}
  ```

  In the single-setting quadrant card header (~line 690):

  ```tsx
  {showDollars && q.realizedTotal > 0 && (
    <span className="text-base font-bold tabular-nums" style={{ color }}>
      {formatCurrency(q.realizedTotal)}
    </span>
  )}
  ```

- [ ] **Step 4: Hide hero headline dollar total**

  In the Hero card left column, the big dollar number (~line 422):

  ```tsx
  {showDollars ? (
    <p className="text-5xl md:text-6xl font-bold text-white tabular-nums leading-none mb-3">
      {totalRealized > 0 ? formatCurrency(totalRealized) : '—'}
    </p>
  ) : (
    <p className="text-5xl md:text-6xl font-bold text-white tabular-nums leading-none mb-3">
      {driversTrackedCount}
      <span className="text-2xl font-normal text-white/40 ml-2">drivers measured</span>
    </p>
  )}
  ```

  Also update the sub-label just below it (~line 425):

  ```tsx
  <p className="text-sm text-white/40 mb-5">
    {showDollars
      ? (financialDriverCount > 0
          ? `Across ${financialDriverCount} financial driver${financialDriverCount === 1 ? '' : 's'}, attribution-adjusted`
          : 'Add financial drivers to see dollar impact')
      : `${activeQuadrantCount} of 4 domains · ${activeSettings.length} care setting${activeSettings.length === 1 ? '' : 's'}`
    }
  </p>
  ```

- [ ] **Step 5: Hide per-domain dollar values in hero breakdown panels**

  In the "By Domain" / "Value by Domain" sections of the hero (~lines 482–535), hide the dollar amount column on each row when `!showDollars`:

  ```tsx
  <span className="text-sm font-bold text-white/80 tabular-nums">
    {showDollars && ss.settingTotal > 0
      ? formatCurrency(ss.settingTotal)
      : <span className="text-white/25">—</span>}
  </span>
  ```

  Apply the same pattern to the single-setting domain breakdown value column.

- [ ] **Step 6: Verify compile and test all 4 audience views visually**

  ```bash
  npm run check
  ```

  In browser: flip through all 4 audiences. Executive shows dollars everywhere. Financial shows dollars. Clinical hides dollars + Revenue quadrant. Operational hides dollars, keeps all quadrants.

- [ ] **Step 7: Commit**

  ```bash
  git add client/src/pages/measure/MeasureOutput.tsx
  git commit -m "feat(measure): hide dollar amounts and Revenue quadrant per audience view"
  ```

---

## Task 5: QuotesBlock and Manage Quotes panel

**Files:**
- Modify: `client/src/pages/measure/MeasureOutput.tsx`

- [ ] **Step 1: Add `ENTRY_DATA_SOURCE_LABELS` constant and quote management state**

  At module scope in `MeasureOutput.tsx`, near the other constants (after `QUADRANT_TAGLINES`), add:

  ```tsx
  const ENTRY_DATA_SOURCE_LABELS: Record<string, string> = {
    ehr: 'EHR',
    survey: 'Survey',
    admin_data: 'Admin data',
    chart_review: 'Chart review',
    manual_entry: 'Manual entry',
  };
  ```

  In the component body, after the audience state, add:

  ```tsx
  const [showManageQuotes, setShowManageQuotes] = useState(false);
  ```

- [ ] **Step 2: Add `QuoteCard` component**

  Before the `FinancialDriverCard` function definition, add a new component:

  ```tsx
  // ─── Quote card ────────────────────────────────────────────────────────────────
  import type { MeasureQuote } from "@/lib/measureCalculator";

  function QuoteCard({ quote }: { quote: MeasureQuote }) {
    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden flex">
        <div className="w-1 flex-shrink-0 bg-[#EA2C00]" />
        <div className="px-5 py-4 flex-1 min-w-0">
          <p className="text-[15px] leading-relaxed text-[#1A1A1A] mb-3">
            <span className="text-[#EA2C00] font-bold mr-1 text-lg leading-none">"</span>
            {quote.text}
          </p>
          <p className="text-xs text-[#8C7E6E] font-medium">
            — {quote.attribution}{quote.role ? `, ${quote.role}` : ''}
          </p>
        </div>
      </div>
    );
  }
  ```

  Note: the `import type { MeasureQuote }` should go at the top of the file with the other imports, not inside the component definition.

- [ ] **Step 3: Add `QuotesBlock` component**

  After `QuoteCard`, add:

  ```tsx
  // ─── Quotes block ──────────────────────────────────────────────────────────────
  function QuotesBlock({ quotes }: { quotes: MeasureQuote[] }) {
    if (quotes.length === 0) return null;
    return (
      <motion.div
        className={`mb-4 ${quotes.length === 1 ? '' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {quotes.map(q => <QuoteCard key={q.id} quote={q} />)}
      </motion.div>
    );
  }
  ```

- [ ] **Step 4: Add `ManageQuotesPanel` component**

  After `QuotesBlock`, add the inline panel. This component receives quotes and updateState:

  ```tsx
  // ─── Manage quotes panel ───────────────────────────────────────────────────────
  function ManageQuotesPanel({
    quotes,
    onUpdate,
  }: {
    quotes: MeasureQuote[];
    onUpdate: (quotes: MeasureQuote[]) => void;
  }) {
    const [draft, setDraft] = useState<Omit<MeasureQuote, 'id'>>({ text: '', attribution: '', role: '' });

    const addQuote = () => {
      if (!draft.text.trim() || !draft.attribution.trim()) return;
      onUpdate([...quotes, { ...draft, id: crypto.randomUUID(), role: draft.role || undefined }]);
      setDraft({ text: '', attribution: '', role: '' });
    };

    const removeQuote = (id: string) => onUpdate(quotes.filter(q => q.id !== id));

    const updateQuote = (id: string, changes: Partial<MeasureQuote>) =>
      onUpdate(quotes.map(q => q.id === id ? { ...q, ...changes } : q));

    return (
      <motion.div
        className="bg-white rounded-2xl border border-[#E8E8E8] p-5 mb-4"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
      >
        <p className="text-[11px] font-bold text-[#888888] uppercase tracking-[1.5px] mb-4">Clinician Quotes</p>

        {/* Existing quotes */}
        {quotes.length > 0 && (
          <div className="space-y-3 mb-5">
            {quotes.map(q => (
              <div key={q.id} className="group relative bg-[#FAFAF8] rounded-xl p-4 border border-[#EEEEEE]">
                <button
                  onClick={() => removeQuote(q.id)}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#F0EBE4] text-[#8C7E6E] text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-100 hover:text-red-500"
                  aria-label="Remove quote"
                >
                  ×
                </button>
                <textarea
                  value={q.text}
                  onChange={(e) => updateQuote(q.id, { text: e.target.value })}
                  className="w-full bg-transparent text-sm text-[#1A1A1A] leading-relaxed outline-none resize-none mb-2 focus:ring-0"
                  rows={2}
                />
                <input
                  value={q.attribution}
                  onChange={(e) => updateQuote(q.id, { attribution: e.target.value })}
                  className="w-full bg-transparent text-xs text-[#8C7E6E] outline-none border-b border-[#EEEEEE] pb-1 focus:ring-0 focus:border-[#EA2C00]"
                  placeholder="Dr. Name, Specialty"
                />
              </div>
            ))}
          </div>
        )}

        {/* Add new quote */}
        <div className="border border-dashed border-[#E0D8D0] rounded-xl p-4">
          <textarea
            value={draft.text}
            onChange={(e) => setDraft(d => ({ ...d, text: e.target.value }))}
            placeholder="What did they say?"
            className="w-full h-16 bg-transparent text-sm text-[#1A1A1A] outline-none resize-none mb-3 placeholder:text-[#CCCCCC]"
          />
          <div className="flex items-center gap-2">
            <input
              value={draft.attribution}
              onChange={(e) => setDraft(d => ({ ...d, attribution: e.target.value }))}
              placeholder="Dr. Name, Specialty"
              className="flex-1 h-8 bg-[#F7F6F3] border border-[#E5E5E5] rounded-lg px-3 text-xs text-[#444] outline-none focus:border-[#EA2C00]"
            />
            <input
              value={draft.role ?? ''}
              onChange={(e) => setDraft(d => ({ ...d, role: e.target.value }))}
              placeholder="Role (optional)"
              className="w-28 h-8 bg-[#F7F6F3] border border-[#E5E5E5] rounded-lg px-3 text-xs text-[#444] outline-none focus:border-[#EA2C00]"
            />
            <button
              onClick={addQuote}
              disabled={!draft.text.trim() || !draft.attribution.trim()}
              className="h-8 px-4 bg-[#EA2C00] hover:bg-[#EA2C00]/90 disabled:bg-[#F0EBE4] disabled:text-[#CCCCCC] text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </motion.div>
    );
  }
  ```

- [ ] **Step 5: Wire QuotesBlock, ManageQuotesPanel, and "Manage Quotes" button**

  In the audience toggle row added in Task 3, replace the `{/* Manage Quotes button added in Task 5 */}` comment with:

  ```tsx
  <button
    onClick={() => setShowManageQuotes(v => !v)}
    className="text-xs font-medium text-[#8C7E6E] hover:text-neutral-900 transition-colors flex items-center gap-1.5"
    data-testid="button-manage-quotes"
  >
    <MessageSquare className="w-3.5 h-3.5" />
    {showManageQuotes ? 'Done' : `Quotes${(state.quotes?.length ?? 0) > 0 ? ` (${state.quotes!.length})` : ''}`}
  </button>
  ```

  After the audience toggle row div, add the panel (wrapped in AnimatePresence) and the QuotesBlock:

  ```tsx
  <AnimatePresence>
    {showManageQuotes && (
      <ManageQuotesPanel
        quotes={state.quotes ?? []}
        onUpdate={(quotes) => updateState({ quotes })}
      />
    )}
  </AnimatePresence>

  {showQuotes && <QuotesBlock quotes={state.quotes!} />}
  ```

- [ ] **Step 6: Remove `void updateState;` suppression line**

  At line 277, remove `void updateState;` — `updateState` is now used.

- [ ] **Step 7: Verify types compile**

  ```bash
  npm run check
  ```

- [ ] **Step 8: Test in browser**

  - Open Output page with some drivers tracked
  - Click "Quotes" button → panel expands inline
  - Add a quote with attribution → appears in panel
  - Switch to Clinical or Executive audience → QuotesBlock appears above domain sections
  - Switch to Operational → QuotesBlock disappears

- [ ] **Step 9: Commit**

  ```bash
  git add client/src/pages/measure/MeasureOutput.tsx
  git commit -m "feat(measure): add QuotesBlock, ManageQuotesPanel, and audience-gated display"
  ```

---

## Task 6: measuredAt and entryDataSource pills on output cards

**Files:**
- Modify: `client/src/pages/measure/MeasureOutput.tsx`

The `FinancialDriverCard` and `SignalDriverRow` already receive `MeasurePDFDriver` which now has `measuredAt` and `entryDataSource`. Add display in the bottom attribution row of each.

- [ ] **Step 1: Add source + timestamp pills to `FinancialDriverCard`**

  In `FinancialDriverCard`, find the attribution pills row at the bottom of the card (~lines 191–203):

  ```tsx
  <div className="flex items-center gap-2 flex-wrap">
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#F0EBE4] text-[10px] font-medium text-[#8C7E6E]">
      {drv.attributionPercent}% attributed to Abridge
    </span>
    {drv.realizationPercent !== undefined && drv.realizationPercent !== 100 && (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#F5F5F5] text-[10px] font-medium text-[#888888]">
        {drv.realizationPercent}% realization
      </span>
    )}
    {drv.entryDataSource && (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#F0EBE4] text-[10px] font-medium text-[#8C7E6E]">
        {ENTRY_DATA_SOURCE_LABELS[drv.entryDataSource] ?? drv.entryDataSource}
      </span>
    )}
    {drv.isMonthlyMode && sparkValues && sparkValues.length >= 2 && (
      <span className="text-[10px] text-[#AAAAAA]">{sparkValues.length}-month trend</span>
    )}
  </div>
  ```

  After the pills row (still inside the `flex items-center justify-between` container, below the pills div), add the timestamp:

  ```tsx
  {drv.measuredAt && (
    <p className="text-[10px] text-[#AAAAAA] mt-1 w-full">
      Measured {new Date(drv.measuredAt + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
    </p>
  )}
  ```

  Note: append `T00:00:00` to the date string to avoid UTC offset shifting the displayed date.

- [ ] **Step 2: Add source + timestamp to `SignalDriverRow`**

  In `SignalDriverRow`, the right side currently has a sparkline. Add source/timestamp below the label area. After the `drv.notes` block (~line 261), add:

  ```tsx
  {(drv.entryDataSource || drv.measuredAt) && (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      {drv.entryDataSource && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#F0EBE4] text-[10px] font-medium text-[#8C7E6E]">
          {ENTRY_DATA_SOURCE_LABELS[drv.entryDataSource] ?? drv.entryDataSource}
        </span>
      )}
      {drv.measuredAt && (
        <span className="text-[10px] text-[#AAAAAA]">
          Measured {new Date(drv.measuredAt + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      )}
    </div>
  )}
  ```

- [ ] **Step 3: Verify types compile**

  ```bash
  npm run check
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add client/src/pages/measure/MeasureOutput.tsx
  git commit -m "feat(measure): show data source and measured-at labels on output driver cards"
  ```

---

## Task 7: measuredAt and entryDataSource inputs in MeasureDriverCard

**Files:**
- Modify: `client/src/components/measure/MeasureDriverCard.tsx`

The expanded driver accordion in `MeasureDriverCard.tsx` has a notes textarea in both the financial and signal branches. Add a 2-column row with a date input and a source dropdown after the notes field in both branches.

- [ ] **Step 1: Import `EntryDataSource` in MeasureDriverCard.tsx**

  At the top of `client/src/components/measure/MeasureDriverCard.tsx`, add to the measureCalculator import:

  ```ts
  import { ..., type EntryDataSource } from "@/lib/measureCalculator";
  ```

- [ ] **Step 2: Add source + date row to the financial driver branch**

  In `MeasureDriverCard.tsx`, find the financial driver notes textarea block ending around line 452. Immediately after the closing `</div>` of that notes block, add:

  ```tsx
  {/* Source + timestamp */}
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-wide mb-1.5 block">
        Data Source
      </label>
      <select
        value={entry.entryDataSource ?? ''}
        onChange={(e) => onUpdate({ entryDataSource: (e.target.value as EntryDataSource) || undefined })}
        className="w-full h-9 bg-[#FAFAF8] border border-[#E5E5E5] rounded-xl px-3 text-sm text-[#444] focus:border-[#EA2C00] focus:ring-1 focus:ring-[#EA2C00]/20 outline-none"
        data-testid={`select-source-${driver.id}`}
      >
        <option value="">Not specified</option>
        <option value="ehr">EHR</option>
        <option value="survey">Survey</option>
        <option value="admin_data">Admin data</option>
        <option value="chart_review">Chart review</option>
        <option value="manual_entry">Manual entry</option>
      </select>
    </div>
    <div>
      <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-wide mb-1.5 block">
        Measured On
      </label>
      <input
        type="date"
        value={entry.measuredAt ?? ''}
        onChange={(e) => onUpdate({ measuredAt: e.target.value || undefined })}
        className="w-full h-9 bg-[#FAFAF8] border border-[#E5E5E5] rounded-xl px-3 text-sm text-[#444] focus:border-[#EA2C00] focus:ring-1 focus:ring-[#EA2C00]/20 outline-none"
        data-testid={`input-measured-at-${driver.id}`}
      />
    </div>
  </div>
  ```

- [ ] **Step 3: Add source + date row to the signal/qualitative driver branch**

  Find the signal driver notes textarea block ending around line 511. Immediately after the closing `</div>` of that notes block (before the `<div className="flex items-center gap-2 text-[11px]...">` hint text), add the identical source + date row from Step 2 (same JSX, same `data-testid` patterns).

- [ ] **Step 4: Verify types compile**

  ```bash
  npm run check
  ```

- [ ] **Step 5: Test in browser**

  - Navigate to any Measure domain page (e.g., Capacity)
  - Expand a driver's accordion
  - Confirm "Data Source" dropdown and "Measured On" date picker appear below the notes field
  - Set a source and date → go to Output page → confirm the source pill and "Measured [date]" label appear on that driver's card

- [ ] **Step 6: Commit**

  ```bash
  git add client/src/components/measure/MeasureDriverCard.tsx
  git commit -m "feat(measure): add data source dropdown and measured-on date picker to driver entry accordion"
  ```

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Audience toggle (4 pills, on-brand, persistent on page) | Task 3 |
| Default audience = Executive | Task 3 |
| Toggle is local state, not persisted | Task 3 |
| Clinical: no dollars, no Revenue quadrant | Task 3 + 4 |
| Operational: no dollar attribution | Task 4 |
| Financial: dollars visible | Task 4 |
| Executive: everything | Task 4 (default) |
| Quotes: rep-entered per account | Task 5 |
| Quotes: surface on Clinical + Executive only | Task 5 |
| Quotes: QuoteCard with red accent bar, pull-quote style | Task 5 |
| Manage Quotes: inline expansion (not modal) | Task 5 |
| Manage Quotes: add / edit / delete | Task 5 |
| Manage Quotes button always visible | Task 5 |
| Timestamps: manual, ISO date string in state | Task 1 + 7 |
| Timestamps: display as "Measured [date]" on output | Task 6 |
| Timestamps: shown on all audience views | Task 6 |
| Data source: 5 options dropdown in entry card | Task 7 |
| Data source: displayed as pill on output | Task 6 |
| Data source: shown on all audience views | Task 6 |
| PDF unaffected (always Executive view, fields additive) | Type extension in Task 2 only |

**No placeholders:** All code blocks contain complete, working code.

**Type consistency:**
- `MeasureQuote` defined in Task 1, imported in Task 5 (`MeasureOutput.tsx`)
- `EntryDataSource` defined in Task 1, imported in Tasks 2 and 7
- `MeasurePDFDriver` extended in Task 2, used with new fields in Task 6
- `Audience` type defined at module scope in Task 3, referenced throughout Task 3 + 4
- `ENTRY_DATA_SOURCE_LABELS` defined in Task 5, used in Task 6 — both in same file ✓
- `showDollars`, `showRevenue`, `showQuotes` defined in Task 3, consumed in Tasks 4 + 5 — all in same component scope ✓
