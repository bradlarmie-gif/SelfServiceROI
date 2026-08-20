# Attain — Value Attainment Strategy Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new home-screen journey, **Attain**, that walks a partner (self-serve, or rep-assisted) through a guided decision tree to co-build a Value Attainment Strategy for a chosen goal in a chosen care setting, ending in an on-screen plan and a downloadable PDF that matches the locked mockup.

**Architecture:** A self-contained flow (`AttainFlow`) mirroring the existing `ExploreFlow` pattern (internal step state, sticky live right-panel, `onBackToJourney`). A data catalog (`lib/attain/`) defines four goal engines (Access, Retention, Revenue, Quality) parameterized per care setting; goals map to the existing four quadrants so dollar math reuses the calculator's defensible engine. Output renders on-screen as sections and via `@react-pdf/renderer` as the 6-page document. Plan state is saved via URL-encoding + localStorage draft (accounts/backend persistence noted as follow-on).

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind + shadcn/ui, framer-motion, lucide-react, `@react-pdf/renderer`, lz-string (URL state), vitest (engine/reconciliation tests), Playwright (flow e2e).

**Canonical design + content source (reproduce exactly):**
- `~/Desktop/Value-Attainment/mockup/value-attainment-patient-access.html` — the LOCKED 6-page visual design (cover, Your Starting Point, Closing the Gap curve, value chain, hardest link, cadence).
- `~/Desktop/Value-Attainment/mockup/content.py` + `generate.py` — the per-goal content model to port into TypeScript.
- `~/Desktop/Value-Attainment/Value-Attainment-Playbook-v1.md` — the method (5 moves, chains, fragile middle).

## Global Constraints

- Palette ONLY: coral `#EA2C00`, ink `#1A1A1A`, warm grays (`#3A3A3A`/`#666`/`#8C8C8C`/`#B4B4B4`), cream panels `#F4F0EA`/`#F8F5F1`, tan rule `#E7E0D6`, gray hairline `#E5E5E5`. Domain pills: Capacity `#1A1A1A`, Workforce `#574A43`, Revenue `#EA2C00`, Quality `#6B7280`. NO green/amber/RAG traffic lights.
- Fonts: `font-abridge` (Abridge otf, already loaded in `index.css`) for titles + big numbers; Inter for body; letter-spaced uppercase for eyebrows/labels.
- Copy voice: teach the mechanism in plain language, no corporate jargon, NO em dashes, causal chains. Never claim Abridge "causes" an outcome (surfaces/enables; partner acts).
- Numbers: contribution margin not gross charges; net-new only; conservative; no-double-count (Revenue books E/M OR wRVU, not both).
- Do NOT run `npm run build` while the dev server runs. Work on a branch; do not push.
- All new interactive elements get `data-testid`.

---

## File Structure

**Create:**
- `client/src/lib/attain/attainTypes.ts` — `AttainState`, `GoalId`, `AttainSetting`, `ChainLink`, `GoalDef`, `SettingGoalContent`.
- `client/src/lib/attain/attainGoals.ts` — the `GOAL_CATALOG` (4 goals × per-setting content), ported from `content.py`; `goalsForSetting()`, `getGoalContent()`.
- `client/src/lib/attain/attainCalc.ts` — target/attainment math; ties goal → quadrant driver value via existing `exploreDriverCalcs`.
- `client/src/lib/attain/attainUrlState.ts` — encode/decode `AttainState` (follow `lib/intakeUrlState.ts` / `dataRequestUrlState.ts` pattern, lz-string).
- `client/src/pages/attain/AttainFlow.tsx` — orchestrator (step state, live panel, nav).
- `client/src/pages/attain/steps/StepSetting.tsx`, `StepVision.tsx`, `StepScope.tsx`, `StepAmbition.tsx`, `StepPath.tsx`, `StepBaseline.tsx`, `StepPlan.tsx`.
- `client/src/pages/attain/AttainLivePanel.tsx` — sticky right-rail plan preview.
- `client/src/components/attain/AttainmentCurve.tsx` — the bespoke SVG curve (screen).
- `client/src/lib/attain/attain-pdf.tsx` — `@react-pdf/renderer` document (6 pages) + `AttainmentCurvePdf` (react-pdf `<Svg>`).
- `client/src/__tests__/attainGoals.test.ts` — catalog integrity + value reconciliation.
- `e2e/attain-flow.spec.ts` — click-through.

**Modify:**
- `client/src/pages/JourneySelector.tsx` — add `onSelectAttain` prop + Attain card between Explore and Measure.
- `client/src/App.tsx` — add `"attain"` to `AppView`, render `<AttainFlow>`, wire `onSelectAttain`.

---

## Task 1: Data model + goal catalog (the engine)

**Files:**
- Create: `client/src/lib/attain/attainTypes.ts`, `client/src/lib/attain/attainGoals.ts`
- Test: `client/src/__tests__/attainGoals.test.ts`

**Interfaces produced:**
```ts
export type AttainSetting = 'outpatient' | 'ed' | 'inpatient' | 'nursing';
export type GoalId = 'access' | 'retention' | 'revenue' | 'quality';
export type DomainPillKey = 'Capacity' | 'Workforce' | 'Revenue' | 'Quality';

export interface ChainLink {
  n: number; name: string; signal: string;
  ownerRole: string;         // default role suggestion
  fragile: boolean;          // links 3 & 4 by convention
  isAbridge: boolean;        // links 1-2 delivered by Abridge
}
export interface Mechanism { heading: string; body: string; }
export interface GoalDef {
  id: GoalId; label: string; pill: DomainPillKey; pillBg: string;
  domainSub: string; chainTitle: string; chainArrow: '↑' | '↓';
  quadrant: 'Capacity' | 'Workforce' | 'Revenue' | 'Quality'; // ties to existing calc
  chain: ChainLink[];        // 7 links
  mechanisms: Mechanism[];   // 3, for the hardest-link page
  flow: { label: string; kind: 'start'|'mid'|'risk'|'end' }[]; // pill-flow
}
export interface SettingGoalContent {   // per (setting, goal) copy + defaults
  subtitle: string; thesis1: string; thesis2: string;
  p1Lead: string; worldCards: { k: string; n: string; coral?: boolean; f: string }[];
  opportunity: string; trappedLabel: string; trappedSteps: string[]; trappedCap: string;
  goodHead: string; goodCells: { n: string; coral?: boolean; k: string }[];
  curveIntro: string; bendsLead: string; bends: string[]; bendsCloser: string;
  fragile: string; hardestTitle: string; hardestArrow: '↑'|'↓'; hardestLead: string;
  splitLabel: string; splitLeft: [string,string]; splitRight: [string,string];
  splitCloser: string; barHead: string; barAcc: number; barTarget: number;
  barAccLbl: string; barRelLbl: string;
  cadenceLead: string; monthly: string[]; renewal: string;
  ambition: { key: 'conservative'|'typical'|'ambitious'; label: string;
              goalLabel: string; usualLabel: string; goalMargin: number }[];
}
export const GOAL_CATALOG: Record<GoalId, GoalDef>;
export const SETTING_GOAL_MATRIX: Record<AttainSetting, GoalId[]>;
export const CONTENT: Record<AttainSetting, Partial<Record<GoalId, SettingGoalContent>>>;
export function goalsForSetting(s: AttainSetting): GoalDef[];
export function getContent(s: AttainSetting, g: GoalId): SettingGoalContent | undefined;
```
`SETTING_GOAL_MATRIX`: outpatient `['access','retention','revenue']`, ed `['access','retention','revenue']`, inpatient `['revenue','retention']`, nursing `['quality','retention']`.

- [ ] **Step 1:** Port the four goal definitions + content from `content.py` (Patient Access from the locked HTML; retention/revenue/quality from `content.py`) into `attainGoals.ts`. Outpatient content is complete from the mockups; author ED/Inpatient parameterizations of each goal reusing the same chain shapes with setting-appropriate metrics and copy (follow the voice rules).
- [ ] **Step 2: Write the failing test** (`attainGoals.test.ts`): every setting in `SETTING_GOAL_MATRIX` resolves `getContent(setting, goal)` to a defined object; every `GoalDef.chain` has exactly 7 links with links 3 and 4 `fragile: true`; every content block's `worldCards`/`goodCells` have length 4; no copy string contains an em dash (`—`).
- [ ] **Step 3:** Run `npx vitest run client/src/__tests__/attainGoals.test.ts` — expect FAIL (content gaps).
- [ ] **Step 4:** Fill gaps until PASS.
- [ ] **Step 5:** Commit `feat(attain): goal + content catalog`.

## Task 2: Attainment/target calc + reconciliation

**Files:** Create `client/src/lib/attain/attainCalc.ts`; extend `attainGoals.test.ts`.
**Interfaces produced:** `computeGoalTarget(goal, setting, scope, ambitionKey): { count: number; margin: number; label: string }`, `computeAttainment(state): { pct: number; onPacePct: number; marginToDate: number }`.
- [ ] **Step 1:** Implement target/attainment. Where a goal maps to a quadrant driver, derive the dollar value by calling the existing `computeAllDriverValues` (from `@/lib/exploreDriverCalcs`) with a synthesized `ExploreState`, so figures reconcile with the rest of the app rather than being invented.
- [ ] **Step 2–4:** Test that a known scope+ambition produces the mockup's illustrative figures within tolerance (e.g. outpatient/access/typical ≈ $760K); run vitest; make pass.
- [ ] **Step 5:** Commit `feat(attain): target + attainment math`.

## Task 3: Home card + routing

**Files:** Modify `JourneySelector.tsx`, `App.tsx`.
- [ ] **Step 1:** Add `onSelectAttain: () => void` to `JourneySelectorProps`. Add an Attain card (lucide `Target` icon) between the Explore and Measure cards, matching card markup exactly. Tagline "Committed to a goal?", title "Attain", description "Pick the outcome you're chasing and build the step-by-step plan to reach it, together.", button "Build the Plan", `data-testid="card-attain"`.
- [ ] **Step 2:** In `App.tsx`: add `"attain"` to `AppView`; import `AttainFlow`; in `<JourneySelector>` pass `onSelectAttain={() => navigateTo("attain")}`; render `{currentView === "attain" && <AttainFlow onBackToJourney={handleBackToJourney} />}`.
- [ ] **Step 3:** Manual verify: dev server, home shows Attain between Explore and Measure; clicking routes to a stub AttainFlow.
- [ ] **Step 4:** Commit `feat(attain): home card + route`.

## Task 4: Flow shell + live panel + step nav

**Files:** Create `AttainFlow.tsx`, `AttainLivePanel.tsx`.
- [ ] **Step 1:** Build `AttainFlow` modeled on `ExploreFlow`: `useState` for `AttainState` + `step` index over `['setting','vision','scope','ambition','path','baseline','plan']`; `UnifiedHeader`/back handling like Explore; two-column layout with sticky `AttainLivePanel` on the right (goal statement forming, curve preview once ambition set, chain status). Stub each step as a placeholder that advances.
- [ ] **Step 2:** Manual verify click-through advances steps and the live panel updates.
- [ ] **Step 3:** Commit `feat(attain): flow shell + live panel`.

## Task 5: Steps 1–4 (Setting, Vision, Scope, Ambition)

**Files:** Create the four step components.
- [ ] Setting: 4 cards (reuse setting labels from `lib/SETTING_CONFIG.ts`). Vision: render `goalsForSetting(setting)` as cards (pill-colored) with the goal's one-line promise. Scope: multi-select service lines/units (presets per setting) + provider/bed count input (use shared `NumberField`). Ambition: Conservative/Typical/Ambitious selector driving `computeGoalTarget`, with a live "what good looks like" readout.
- [ ] Each step writes into `AttainState`; premium styling per Global Constraints; `data-testid`s.
- [ ] Manual verify + commit `feat(attain): steps setting/vision/scope/ambition`.

## Task 6: Step 5 (The Path) + Step 6 (Baseline)

- [ ] Path: render the goal's 7-link chain; each link shows signal + an owner-role `Select` (default from `ChainLink.ownerRole`) + a horizon picker; fragile links 3–4 visually flagged (coral tick); inline teach text so a solo partner understands. Baseline: the goal's `worldCards` inputs prefilled with benchmark defaults, editable, skippable.
- [ ] Manual verify + commit `feat(attain): path + baseline steps`.

## Task 7: Step 7 — on-screen plan + AttainmentCurve

**Files:** Create `StepPlan.tsx`, `components/attain/AttainmentCurve.tsx`.
- [ ] Build `AttainmentCurve` as inline SVG reproducing the locked mockup curve (coral plan line to goal dot, dashed gray drift to "what usually happens", shaded gap, Today marker, axis labels) driven by attainment/on-pace props.
- [ ] Render the six sections on screen (cover summary, Your Starting Point, Closing the Gap, the chain, the hardest link, the cadence) from `AttainState` + catalog, matching the mockup. "Download PDF" + "Save" buttons.
- [ ] Manual verify against the locked HTML side by side + commit `feat(attain): on-screen plan + curve`.

## Task 8: PDF document (`@react-pdf/renderer`)

**Files:** Create `lib/attain/attain-pdf.tsx`; wire Download in `StepPlan`.
- [ ] Reproduce the 6-page locked design with react-pdf primitives, reusing conventions from `lib/pdf-theme.tsx` and following `pdf_layout_guidelines.md` (footer contract, `wrap={false}` atomic units). Render the curve via react-pdf `<Svg>` (`Path`/`Line`/`Circle`/`Text`). Font: register Abridge otf with react-pdf.
- [ ] Add a reconciliation vitest (mirror `exploreNarrativePdfReconciliation.test.ts`): the PDF's goal figure equals `computeGoalTarget`.
- [ ] Visual review: Chrome print the generated PDF, screenshot, compare to mockup. Commit `feat(attain): pdf export`.

## Task 9: Save / share

**Files:** Create `attainUrlState.ts`; wire Save in `StepPlan`; handle deep-link in `App.tsx`.
- [ ] Encode `AttainState` to a URL param (lz-string, per `intakeUrlState`), decode on load to rehydrate the plan; also write a localStorage draft so a return visit resumes. Add `?attain=` handling to `getInitialDeepLink()`.
- [ ] Manual verify: build a plan, copy Save link, open in a fresh tab, plan rehydrates. Commit `feat(attain): save + shareable link`.

## Task 10: e2e + polish pass

- [ ] `e2e/attain-flow.spec.ts`: home → Attain → outpatient → access → scope → typical → path → baseline → plan renders with goal figure; Download button present.
- [ ] Cross-goal smoke: each `SETTING_GOAL_MATRIX` entry reaches a rendered plan without error.
- [ ] Responsive + transition polish to match app. Commit `test(attain): e2e + polish`.

---

## Self-Review

- **Spec coverage:** home card (T3), self-serve decision tree S1–S7 (T4–T7), all goals × settings (T1 matrix + content), on-screen plan + PDF matching mockup (T7–T8), save/return for stickiness (T9), defensible reused math (T2). Covered.
- **Placeholders:** content authoring for ED/Inpatient parameterizations is real work called out in T1 with the voice rules and source; not a code placeholder.
- **Type consistency:** `AttainState`, `GoalDef`, `SettingGoalContent`, `getContent`, `goalsForSetting`, `computeGoalTarget` used consistently across tasks.
- **Persistence honesty:** T9 delivers URL + localStorage; account/backend persistence is explicitly a follow-on, not silently assumed.
