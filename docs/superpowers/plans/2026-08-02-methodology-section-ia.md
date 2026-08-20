# Methodology Section IA Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a new first tab "The Methodology" (the founding-story screen) to the on-screen Value Methodology section, and rework "Across settings" so its two cross-setting views read as one narrative.

**Architecture:** New screen `MethodologyOverview.tsx` (default landing) + a new `overview` nav key in the shared `MethodologyHeader`; `MethodologyContinuum` gets a "same record, four economics" comparison lead above its existing (reframed) matrix. Content reuses `@/lib/methodologyContent` (`METHODOLOGY_SETTINGS`); the matrix keeps `methodologyData.ts`.

**Tech stack:** React 18 + TS strict + Vite + Tailwind.

## Global Constraints

- Voice: plain, mechanism-first. NO em dashes. NO costume words — use "complete record" (never "faithful"/"fidelity"/"lossy"/"unlock").
- Legal: capability + conditional only; never "causes/guarantees/prevents/prevented by" as an Abridge claim.
- On-screen editorial tokens (NOT the PDF): page `#FDFCFA`, body `#5E534A`, headings `font-abridge` `#1A1A1A`, eyebrow `#443A32` / coral `#EA2C00`, muted `#8C8073`, hairline `#E8E2DA`, card `#FDFBF8`, pill `#F2EDE5`, 1120px container. Coral for money/accent only.
- tsc `--noEmit` 0 errors + `npx vitest run` green + `npm run build` succeeds after every task.
- Visual + exact copy source of truth (with "faithful"→"complete" applied): the approved mockup `/private/tmp/claude-501/-Users-brad/926eabfa-9fc7-4c7d-afc2-bd8edd5da9d9/scratchpad/methodology-screen-mockup/index.html`. Match the existing screens' patterns in `client/src/pages/methodology/editorial/MethodologyContinuum.tsx` and `MethodologyHeader.tsx`.

---

### Task 1: Add the "overview" tab to MethodologyHeader

**Files:**
- Modify: `client/src/pages/methodology/editorial/MethodologyHeader.tsx`

**Interfaces:**
- Produces: `MethodologyNavKey` extended to `"overview" | "outpatient" | "ed" | "inpatient" | "nursing" | "continuum"`.

- [ ] **Step 1:** In `MethodologyHeader.tsx`, extend the type: `export type MethodologyNavKey = "overview" | "outpatient" | "ed" | "inpatient" | "nursing" | "continuum";`

- [ ] **Step 2:** Render "The Methodology" as the FIRST tab, before the setting tabs, with a divider after it (mirroring the existing divider before "Across settings"). In the tab group JSX, prepend:
```tsx
<button onClick={() => onNavigate?.("overview")} className={tab(active === "overview")}>
  The Methodology
</button>
<span className="w-px h-4 bg-[#DCD3C6] mx-1" />
```
before the `SETTINGS.map(...)`. Leave the existing settings + "Across settings" as-is.

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors (other files that construct `MethodologyHeader` with `active` still pass their existing keys).

- [ ] **Step 4: Commit**
```bash
git add client/src/pages/methodology/editorial/MethodologyHeader.tsx
git commit -m "Methodology: add 'The Methodology' overview tab to the header"
```

---

### Task 2: The MethodologyOverview screen

**Files:**
- Create: `client/src/pages/methodology/editorial/MethodologyOverview.tsx`
- Test: `client/src/__tests__/methodologyOverview.test.tsx`

**Interfaces:**
- Consumes: `MethodologyHeader`, `MethodologyNavKey` (Task 1); `METHODOLOGY_SETTINGS` from `@/lib/methodologyContent`.
- Produces: `export default function MethodologyOverview({ onBack, onHome, onNavigate }: { onBack: () => void; onHome: () => void; onNavigate?: (key: MethodologyNavKey) => void }): JSX.Element`.

**Build guidance:** Port screen 1 of the mockup (`methodology-screen-mockup/index.html`, the `<!-- SCREEN 1 -->` block) into React/Tailwind, matching the token classes already used in `MethodologyContinuum.tsx`. Sections: header (`<MethodologyHeader active="overview" activeLabel="The Methodology" ... />`), hero ("The note is written from memory." with coral on "memory" + the plain lead), the two-card record graphic (left neutral greys, right coral+tints, arrow between; caption "The same visit, recorded two ways. **Everything in this methodology comes from closing that gap.**"), "What a complete record makes possible" (sub uses "One **complete** record …"; 4 value cards Revenue/Capacity/Workforce/Quality with dot colors `#EA2C00`/`#F0704E`/`#F4A48C`/`#B4A896` and the one-line descriptions from the mockup; right-aligned "the floor, not the ceiling"), and "The signal that leads every setting" panel ("Note completeness moves **first**." + the text) with four bridge chips that call `onNavigate?.(<setting>)`. Wrap content in `max-w-[1120px] mx-auto px-5 sm:px-8 lg:px-14`. NO em dashes; NO "faithful".

- [ ] **Step 1: Write the failing test**
```tsx
// client/src/__tests__/methodologyOverview.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MethodologyOverview from "@/pages/methodology/editorial/MethodologyOverview";

describe("MethodologyOverview (The Methodology tab)", () => {
  const html = renderToStaticMarkup(
    <MethodologyOverview onBack={() => {}} onHome={() => {}} onNavigate={() => {}} />,
  );
  it("renders the founding thesis, the four values, and the signal spine", () => {
    expect(html).toContain("written from");
    expect(html).toContain("memory");
    expect(html).toContain("Revenue");
    expect(html).toContain("Capacity");
    expect(html).toContain("Workforce");
    expect(html).toContain("Quality");
    expect(html).toContain("the floor, not the ceiling");
    expect(html).toContain("Note completeness");
  });
  it("carries no em dash and no costume words", () => {
    expect(html).not.toContain("—");
    expect(html.toLowerCase()).not.toContain("faithful");
    expect(html.toLowerCase()).not.toContain("fidelity");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run client/src/__tests__/methodologyOverview.test.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement** `MethodologyOverview.tsx` per the build guidance.

- [ ] **Step 4: Run to verify it passes** — `npx vitest run client/src/__tests__/methodologyOverview.test.tsx` → PASS.

- [ ] **Step 5: Commit**
```bash
git add client/src/pages/methodology/editorial/MethodologyOverview.tsx client/src/__tests__/methodologyOverview.test.tsx
git commit -m "Methodology: The Methodology overview screen (record made complete, four values, signal spine)"
```

---

### Task 3: Route the overview screen (default landing) + deep link

**Files:**
- Modify: `client/src/pages/LearnPath.tsx`
- Modify: `client/src/App.tsx` (the `/learn/` deep-link `validScreens` array, ~line 193)

**Interfaces:** Consumes `MethodologyOverview` (Task 2).

- [ ] **Step 1:** In `LearnPath.tsx`: import `MethodologyOverview`; add `"overview"` to the `LearnScreen` union; change the default landing so entering the section lands on overview:
  - `resolveInitial`: return `s` if it is a valid setting, `"continuum"`, or `"overview"`; else default to `"overview"`.
  - Add a branch before the continuum branch: `if (currentScreen === "overview") return <MethodologyOverview onBack={onBack} onHome={onBack} onNavigate={handleNavigate} />;`
  - Keep the continuum + setting branches unchanged.

- [ ] **Step 2:** In `App.tsx` `/learn/` deep-link handler (~line 193), add `"overview"` to `validScreens` so `/learn/overview` resolves.

- [ ] **Step 3: Verify** `npx tsc --noEmit` → 0 errors; `npm run build` → succeeds.

- [ ] **Step 4: Commit**
```bash
git add client/src/pages/LearnPath.tsx client/src/App.tsx
git commit -m "Methodology: route The Methodology overview as default landing + /learn/overview deep link"
```

---

### Task 4: Rework "Across settings" (comparison lead + Counted-once coda)

**Files:**
- Modify: `client/src/pages/methodology/editorial/MethodologyContinuum.tsx`
- Test: `client/src/__tests__/methodologyContinuum.test.tsx`

**Interfaces:** Consumes `METHODOLOGY_SETTINGS` from `@/lib/methodologyContent`.

**Build guidance:** Port screen 2 of the mockup. Replace the current hero ("One conversation. Four domains. Every setting.") with the new lead: eyebrow "Across the continuum", headline **"The same record. Four economics."**, lead ("A **complete** record does the same thing everywhere … it lands on different money, because each setting's work, payment, and constraint are different."). Under it, a comparison table iterating `METHODOLOGY_SETTINGS`: columns Setting (label + `unit` chip) · The lever (`dominantLever`) · The signal you see first (`comparisonSignals`) · The outcome it opens (`comparisonOutcomes`), styled like the mockup's `.cmp` table using existing token classes. THEN keep the existing dollar-vs-proof matrix, but under a new section heading **"Counted once"** with the existing sub about the proof layer moving / no double count, and keep the existing "The read" paragraph. Keep the "Go deep on a setting" block if present. NO em dashes; NO "faithful".

- [ ] **Step 1: Write the failing test**
```tsx
// client/src/__tests__/methodologyContinuum.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MethodologyContinuum from "@/pages/methodology/editorial/MethodologyContinuum";

describe("MethodologyContinuum (Across settings, reworked)", () => {
  const html = renderToStaticMarkup(
    <MethodologyContinuum onBack={() => {}} onHome={() => {}} onNavigate={() => {}} />,
  );
  it("leads with the four-economics comparison and closes on Counted once", () => {
    expect(html).toContain("The same record");
    expect(html).toContain("Four economics");
    expect(html).toContain("Volume"); // outpatient lever
    expect(html).toContain("Speed");  // ed lever
    expect(html).toContain("Acuity"); // inpatient lever
    expect(html).toContain("Counted once");
  });
  it("carries no em dash and no costume words", () => {
    expect(html).not.toContain("—");
    expect(html.toLowerCase()).not.toContain("faithful");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run client/src/__tests__/methodologyContinuum.test.tsx` → FAIL (strings not present yet).

- [ ] **Step 3: Implement** the rework per the build guidance.

- [ ] **Step 4: Run to verify it passes** — `npx vitest run client/src/__tests__/methodologyContinuum.test.tsx` → PASS.

- [ ] **Step 5: Commit**
```bash
git add client/src/pages/methodology/editorial/MethodologyContinuum.tsx client/src/__tests__/methodologyContinuum.test.tsx
git commit -m "Methodology: rework Across settings (four-economics comparison lead + Counted-once coda)"
```

---

### Task 5: Copy guardrail for the methodology screens

**Files:**
- Create: `client/src/__tests__/methodologyScreenCopyGuardrails.test.ts`

**Interfaces:** Consumes `scanFiles`, `formatHits` from `./support/copyGuardrail`.

- [ ] **Step 1: Write the test**
```ts
// client/src/__tests__/methodologyScreenCopyGuardrails.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { scanFiles, formatHits } from "./support/copyGuardrail";

const CLIENT_SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = "pages/methodology/editorial";
const FILES = readdirSync(join(CLIENT_SRC, DIR)).filter((f) => f.endsWith(".tsx")).map((f) => join(DIR, f));

describe("Methodology screen COPY guardrails", () => {
  it("no em dashes, no causal/guarantee absolutes, no prevents/prevented-by, no credited-to", () => {
    const hits = scanFiles(CLIENT_SRC, FILES);
    expect(hits.length, `Copy guardrail hits (${hits.length}):\n${formatHits(hits)}`).toBe(0);
  });
  it("no costume words (faithful / fidelity / lossy / unlock)", () => {
    const offenders: string[] = [];
    for (const rel of FILES) {
      const src = readFileSync(join(CLIENT_SRC, rel), "utf8");
      // strip block + line comments so an explanatory code comment cannot trip it
      const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, " ").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
      for (const w of ["faithful", "fidelity", "lossy", "unlock"]) {
        if (new RegExp(`\\b${w}\\b`, "i").test(code)) offenders.push(`${rel}: ${w}`);
      }
    }
    expect(offenders, offenders.join("\n")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run client/src/__tests__/methodologyScreenCopyGuardrails.test.ts`. If it flags hits in the files from Tasks 2/4, FIX the copy (not the test), re-run to green. (Note: existing per-setting `MethodologyEditorial.tsx` is also scanned; if it has pre-existing em dashes, fix them minimally to plain punctuation.)

- [ ] **Step 3: Commit**
```bash
git add client/src/__tests__/methodologyScreenCopyGuardrails.test.ts client/src/pages/methodology/editorial
git commit -m "Methodology: copy guardrail over the methodology screens"
```

---

### Task 6: Layout-smoke coverage for the new screens

**Files:**
- Modify: `scripts/layout-smoke.mjs` (the `ROUTES` array, ~line 37)

**Interfaces:** none.

- [ ] **Step 1:** Add to `ROUTES`:
```js
{ url: "/learn/overview", label: "Methodology · overview" },
{ url: "/learn/continuum", label: "Methodology · across settings" },
```

- [ ] **Step 2: Run** — start the dev server (`npx vite --port 5199 --strictPort`, sandbox disabled; poll curl for 200), then `node scripts/layout-smoke.mjs` (sandbox disabled). Both new routes must pass the desktop checks (no horizontal overflow, header <= 104px). Kill the server after. If overflow appears on a new screen, fix the component (constrain widths / wrap) until green. Do NOT weaken thresholds.

- [ ] **Step 3: Commit**
```bash
git add scripts/layout-smoke.mjs
git commit -m "Methodology: layout-smoke coverage for overview + across-settings screens"
```

---

## Final verification (after all tasks)
- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → all green (new: methodologyOverview, methodologyContinuum, methodologyScreenCopyGuardrails)
- `npm run build` → succeeds
- `npm run layout:smoke` → green including the two new methodology routes
- Manual (Brad, Replit): open `/learn/overview` → the new tab is first and default; walk the tabs; open `/learn/continuum` → comparison lead + Counted-once coda.
