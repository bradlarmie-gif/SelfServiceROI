# Data Request Builder — Multi-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a rep pick more than one care setting in the Data Request Builder and download ONE combined Excel (a shared Instructions sheet plus one Data Fields sheet per selected setting), keeping the existing premium look.

**Architecture:** Two new pure functions carry the logic and are unit-tested — a combined-workbook builder in `dataRequestExcel.ts` that reuses the existing per-setting styled sheet builders, and a field-plan aggregator in `dataRequestFields.ts`. The UI (`DataRequestBuilder.tsx`) is then refactored from single-setting state (`setting`, `selectedIds`) to multi-setting state (`settings`, `selectedBySetting`) and wired to the new combined generator. The existing single-setting functions and their guard test stay untouched.

**Tech Stack:** React + TypeScript (strict), Vite, Tailwind, framer-motion, lucide-react, xlsx-js-style, vitest.

## Global Constraints

- No em dashes anywhere in copy or code comments; use "·", ":", or a period instead.
- No jargon; plain, defensible copy consistent with the rest of the app.
- Premium look preserved: reuse the existing card + dark right-panel styles; coral `#EA2C00` + warm neutrals only; no stoplight colors, no status pills.
- TypeScript strict: every `Record<DataRequestSetting, …>` must stay exhaustive over `'outpatient' | 'ed' | 'inpatient' | 'nursing'`.
- Do NOT change the Excel visual styling, the receipt/intake flows, or any other path.
- Do NOT break the existing single-setting functions `buildDataRequestWorkbook` / `generateDataRequestExcel` or the guard test `client/src/__tests__/dataRequestExcel.test.ts`.
- Keep the Exit button (`data-testid="btn-exit-data-request"`) intact.
- Verify every task with `npx tsc --noEmit -p tsconfig.json` (0 errors) and `npx vitest run` (all green). Run `npm run build` for the UI task. This environment cannot render the app or open Excel, so the workbook structure and field-plan aggregation are proven by unit tests; the visual and the Excel are verified by the user on Replit.

---

### Task 1: Combined-workbook builder (`buildMultiDataRequestWorkbook` + `generateMultiDataRequestExcel`)

**Files:**
- Modify: `client/src/lib/dataRequestExcel.ts` (add a multi-instructions sheet builder + two exported functions; leave everything else unchanged)
- Test: `client/src/__tests__/dataRequestMultiExcel.test.ts` (create)

**Interfaces:**
- Consumes (already in this file): `buildDataFieldsSheet(setting, selectedDriverIds)`, `styleIfExists`, `b`, the `C` palette, `SETTING_TAB_COLORS`, `SETTING_FILE_LABELS`, `XLSX_MIME`, `shareOrSaveBlob`; imported `getDriverFieldGroups` and type `DataRequestSetting`.
- Produces (later tasks rely on these):
  - `buildMultiDataRequestWorkbook(settings: DataRequestSetting[], selectedBySetting: Record<DataRequestSetting, string[]>, orgName?: string): XLSX.WorkBook`
  - `generateMultiDataRequestExcel(settings: DataRequestSetting[], selectedBySetting: Record<DataRequestSetting, string[]>, orgName?: string): Promise<void>`
  - Sheet names per setting: `outpatient` → `"Outpatient"`, `ed` → `"Emergency Dept"`, `inpatient` → `"Inpatient"`, `nursing` → `"Nursing"`. The Instructions sheet is always first.

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/dataRequestMultiExcel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx-js-style";
import { buildMultiDataRequestWorkbook } from "@/lib/dataRequestExcel";
import type { DataRequestSetting } from "@/lib/dataRequestFields";

const selectedBySetting: Record<DataRequestSetting, string[]> = {
  outpatient: ["patientAccess", "wrvu"],
  ed: ["lwbsRecovery", "admissionCapture"],
  inpatient: [],
  nursing: [],
};

describe("multi-setting data request workbook", () => {
  it("has Instructions first, then one Data Fields sheet per selected setting", () => {
    const wb = buildMultiDataRequestWorkbook(["outpatient", "ed"], selectedBySetting, "Test Health");
    expect(wb.SheetNames[0]).toBe("Instructions");
    expect(wb.SheetNames).toEqual(["Instructions", "Outpatient", "Emergency Dept"]);
  });

  it("styles each per-setting data sheet and serializes to a real file", () => {
    const wb = buildMultiDataRequestWorkbook(["outpatient", "ed"], selectedBySetting, "Test Health");
    for (const name of ["Outpatient", "Emergency Dept"]) {
      const sheet = wb.Sheets[name];
      expect((sheet["A1"] as { s?: unknown })?.s).toBeTruthy();
    }
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array;
    expect(buf.byteLength).toBeGreaterThan(3000);
  });

  it("builds for a single selected setting too", () => {
    const wb = buildMultiDataRequestWorkbook(["nursing"], { ...selectedBySetting, nursing: ["nursingRetention"] });
    expect(wb.SheetNames).toEqual(["Instructions", "Nursing"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/dataRequestMultiExcel.test.ts`
Expected: FAIL — `buildMultiDataRequestWorkbook` is not exported.

- [ ] **Step 3: Add the multi-instructions sheet builder**

In `client/src/lib/dataRequestExcel.ts`, immediately after the existing `buildInstructionsSheet` function (it ends with `return ws;` and `}` at roughly line 307, just before the `// ── Export ──` comment), insert this new function:

```ts
function buildMultiInstructionsSheet(
  settings: DataRequestSetting[],
  selectedBySetting: Record<DataRequestSetting, string[]>,
  orgName?: string,
): XLSX.WorkSheet {
  const settingDisplay: Record<DataRequestSetting, string> = {
    outpatient: 'Outpatient',
    ed: 'Emergency Department',
    inpatient: 'Inpatient',
    nursing: 'Nursing',
  };

  const aoa: (string | null)[][] = [];
  const rowHeights: number[] = [];
  const push = (text: string | null, hpt: number) => { aoa.push([text]); rowHeights.push(hpt); };

  push(null, 8);
  push('ABRIDGE', 14);
  push('Data Request Template', 32);
  push(orgName ? `Prepared for ${orgName}` : 'Prepared by your Abridge account team', 18);
  push(null, 10);
  push(null, 4);
  const purposeHeaderRow = aoa.length; push('PURPOSE', 16);
  const purposeBodyRow = aoa.length; push('This collects the numbers we use to model the value of Abridge across the care settings below. Each setting has its own tab. We only truly need the short "We need these" block on each tab. Everything else is optional and sharpens the estimate.', 60);
  push(null, 10);
  const howHeaderRow = aoa.length; push('HOW TO USE', 16);
  const how1Row = aoa.length; push('1.  Each care setting has its own tab along the bottom. Fill the "We need these" block on each.', 16);
  const how2Row = aoa.length; push('2.  Optional fields make it sharper. Leave any blank and we use an industry benchmark.', 16);
  const how3Row = aoa.length; push('3.  Return the file to your Abridge account team.', 16);
  push(null, 10);
  const settingsHeaderRow = aoa.length; push('CARE SETTINGS IN THIS FILE', 16);
  const settingRows: number[] = [];
  for (const s of settings) {
    const groups = getDriverFieldGroups(s, selectedBySetting[s] ?? []);
    const labels = groups.map(g => g.driverLabel).join(', ');
    settingRows.push(aoa.length);
    push(`    ${settingDisplay[s]}${labels ? `:  ${labels}` : ''}`, 30);
  }
  push(null, 10);
  const contactRow = aoa.length; push('Questions? Contact your Abridge account team.', 15);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 82 }];
  ws['!rows'] = rowHeights.map(hpt => ({ hpt }));
  (ws as any)['!sheetView'] = [{ showGridLines: false }];

  const at = (rowIdx: number) => `A${rowIdx + 1}`;

  if (ws['A2']) ws['A2'].s = { font: { bold: true, sz: 8, color: { rgb: C.textMuted } } };
  if (ws['A3']) ws['A3'].s = { font: { bold: true, sz: 20, color: { rgb: C.black } } };
  if (ws['A4']) ws['A4'].s = {
    font: { bold: true, sz: 12, color: { rgb: C.red } },
    border: { bottom: b(C.separator) },
  };

  const sectionStyle = {
    font: { bold: true, sz: 9, color: { rgb: C.textSection } },
    border: { bottom: b(C.red, 'medium') },
  };
  const bodyStyle = {
    font: { sz: 10, color: { rgb: C.textBody } },
    alignment: { wrapText: true, vertical: 'top' },
  };
  const listStyle = {
    font: { sz: 10, color: { rgb: C.textBody } },
    alignment: { wrapText: true, vertical: 'top' },
  };
  const mutedStyle = { font: { sz: 9, italic: true, color: { rgb: C.textMuted } } };

  styleIfExists(ws, at(purposeHeaderRow), sectionStyle);
  styleIfExists(ws, at(purposeBodyRow), bodyStyle);
  styleIfExists(ws, at(howHeaderRow), sectionStyle);
  styleIfExists(ws, at(how1Row), listStyle);
  styleIfExists(ws, at(how2Row), listStyle);
  styleIfExists(ws, at(how3Row), listStyle);
  styleIfExists(ws, at(settingsHeaderRow), sectionStyle);
  for (const r of settingRows) styleIfExists(ws, at(r), listStyle);
  styleIfExists(ws, at(contactRow), mutedStyle);

  return ws;
}
```

- [ ] **Step 4: Add the exported builder + generator**

In the same file, in the `// ── Export ──` section, immediately after the existing `SETTING_FILE_LABELS` constant (roughly line 323, before `export function buildDataRequestWorkbook`), add the sheet-name map:

```ts
const SETTING_SHEET_NAMES: Record<DataRequestSetting, string> = {
  outpatient: 'Outpatient',
  ed:         'Emergency Dept',
  inpatient:  'Inpatient',
  nursing:    'Nursing',
};
```

Then, immediately after the existing `generateDataRequestExcel` function (the file's last export, which ends with the `shareOrSaveBlob(...)` call and its closing `}`), append:

```ts
/** Combined workbook across multiple care settings: one shared Instructions
 *  sheet plus one Data Fields sheet per selected setting. Reuses the same
 *  styled per-setting sheet builder as the single-setting path. */
export function buildMultiDataRequestWorkbook(
  settings: DataRequestSetting[],
  selectedBySetting: Record<DataRequestSetting, string[]>,
  orgName?: string,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const instrSheet = buildMultiInstructionsSheet(settings, selectedBySetting, orgName);
  XLSX.utils.book_append_sheet(wb, instrSheet, 'Instructions');

  for (const setting of settings) {
    const dataSheet = buildDataFieldsSheet(setting, selectedBySetting[setting] ?? []);
    XLSX.utils.book_append_sheet(wb, dataSheet, SETTING_SHEET_NAMES[setting]);
  }

  // Tab colors: Instructions black, then one accent per setting tab.
  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Sheets = wb.Workbook.Sheets || [];
  (wb.Workbook.Sheets[0] as any) = { ...(wb.Workbook.Sheets[0] || {}), tabColor: { rgb: C.black } };
  settings.forEach((setting, i) => {
    (wb.Workbook!.Sheets![i + 1] as any) = {
      ...(wb.Workbook!.Sheets![i + 1] || {}),
      tabColor: { rgb: SETTING_TAB_COLORS[setting] },
    };
  });

  return wb;
}

export async function generateMultiDataRequestExcel(
  settings: DataRequestSetting[],
  selectedBySetting: Record<DataRequestSetting, string[]>,
  orgName?: string,
): Promise<void> {
  const wb = buildMultiDataRequestWorkbook(settings, selectedBySetting, orgName);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const fileLabel = settings.length === 1 ? SETTING_FILE_LABELS[settings[0]] : 'Multi-Setting';
  await shareOrSaveBlob(
    new Blob([buf], { type: XLSX_MIME }),
    `Abridge-Data-Request-${fileLabel}.xlsx`,
    'Abridge Data Request',
  );
}
```

- [ ] **Step 5: Run the new test + the guard test to verify both pass**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/dataRequestMultiExcel.test.ts client/src/__tests__/dataRequestExcel.test.ts`
Expected: PASS — all tests in both files green (the guard test still passes, proving the single-setting path is untouched).

- [ ] **Step 6: Typecheck**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/lib/dataRequestExcel.ts client/src/__tests__/dataRequestMultiExcel.test.ts
git commit -m "feat: combined multi-setting data request workbook builder"
```

---

### Task 2: Field-plan aggregator (`getMultiRequestFieldPlan`)

**Files:**
- Modify: `client/src/lib/dataRequestFields.ts` (add one interface + one function at the end of the file)
- Test: `client/src/__tests__/dataRequestMultiFieldPlan.test.ts` (create)

**Interfaces:**
- Consumes (already in this file): `getRequestFieldPlan(setting, driverIds): RequestFieldPlan`, `interface RequestFieldPlan`, type `DataRequestSetting`.
- Produces (Task 3 relies on these):
  - `interface MultiRequestFieldPlan { perSetting: { setting: DataRequestSetting; plan: RequestFieldPlan }[]; requiredCount: number; optionalCount: number; }`
  - `getMultiRequestFieldPlan(settings: DataRequestSetting[], selectedBySetting: Record<DataRequestSetting, string[]>): MultiRequestFieldPlan`

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/dataRequestMultiFieldPlan.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getMultiRequestFieldPlan, getRequestFieldPlan, type DataRequestSetting } from "@/lib/dataRequestFields";

describe("getMultiRequestFieldPlan", () => {
  it("sums required and optional counts across settings", () => {
    const sel: Record<DataRequestSetting, string[]> = {
      outpatient: ["patientAccess"],
      ed: ["lwbsRecovery"],
      inpatient: [],
      nursing: [],
    };
    const multi = getMultiRequestFieldPlan(["outpatient", "ed"], sel);
    const op = getRequestFieldPlan("outpatient", sel.outpatient);
    const ed = getRequestFieldPlan("ed", sel.ed);

    expect(multi.requiredCount).toBe(op.requiredCount + ed.requiredCount);
    expect(multi.optionalCount).toBe(op.optionalCount + ed.optionalCount);
    expect(multi.perSetting.map(p => p.setting)).toEqual(["outpatient", "ed"]);
  });

  it("returns zero counts for no settings", () => {
    const multi = getMultiRequestFieldPlan([], { outpatient: [], ed: [], inpatient: [], nursing: [] });
    expect(multi).toEqual({ perSetting: [], requiredCount: 0, optionalCount: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/dataRequestMultiFieldPlan.test.ts`
Expected: FAIL — `getMultiRequestFieldPlan` is not exported.

- [ ] **Step 3: Implement the aggregator**

At the very end of `client/src/lib/dataRequestFields.ts` (after `getDriverFieldGroups`), append:

```ts
export interface MultiRequestFieldPlan {
  perSetting: { setting: DataRequestSetting; plan: RequestFieldPlan }[];
  requiredCount: number;
  optionalCount: number;
}

export function getMultiRequestFieldPlan(
  settings: DataRequestSetting[],
  selectedBySetting: Record<DataRequestSetting, string[]>,
): MultiRequestFieldPlan {
  const perSetting = settings.map(setting => ({
    setting,
    plan: getRequestFieldPlan(setting, selectedBySetting[setting] ?? []),
  }));
  return {
    perSetting,
    requiredCount: perSetting.reduce((n, p) => n + p.plan.requiredCount, 0),
    optionalCount: perSetting.reduce((n, p) => n + p.plan.optionalCount, 0),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run client/src/__tests__/dataRequestMultiFieldPlan.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/lib/dataRequestFields.ts client/src/__tests__/dataRequestMultiFieldPlan.test.ts
git commit -m "feat: aggregate field-plan counts across care settings"
```

---

### Task 3: Multi-select UI in `DataRequestBuilder.tsx`

**Files:**
- Modify (full rewrite): `client/src/pages/data-request/DataRequestBuilder.tsx`

**Interfaces:**
- Consumes: `generateMultiDataRequestExcel` (Task 1), `getMultiRequestFieldPlan` (Task 2), plus existing `BASELINE_FIELDS`, `DRIVER_FIELDS`, `type DataRequestSetting` from `@/lib/dataRequestFields`.
- Produces: no exports beyond the default component; this is the terminal UI task.

Note: this is a pure-UI task; its correctness rests on the unit-tested logic from Tasks 1 and 2. Verification is `tsc` + `vitest` (existing suite stays green) + `npm run build`, and the user verifies the visual and the downloaded Excel on Replit.

- [ ] **Step 1: Replace the file with the multi-select version**

Overwrite `client/src/pages/data-request/DataRequestBuilder.tsx` with exactly:

```tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Download, Check, Building2, Stethoscope, Heart, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BASELINE_FIELDS, DRIVER_FIELDS, getMultiRequestFieldPlan, type DataRequestSetting } from "@/lib/dataRequestFields";
import { generateMultiDataRequestExcel } from "@/lib/dataRequestExcel";
import abridgeLogo from "@assets/abridge-logo-wordmark-red_1769020684647.png";

interface Props {
  onBack: () => void;
}

const SETTINGS: { id: DataRequestSetting; label: string; description: string; icon: LucideIcon }[] = [
  { id: 'ed',         label: 'Emergency Department', description: 'ED physicians and APPs',                    icon: Building2   },
  { id: 'outpatient', label: 'Outpatient',           description: 'Clinic and ambulatory providers',           icon: Stethoscope },
  { id: 'inpatient',  label: 'Inpatient',            description: 'Hospitalists and attending physicians',     icon: Heart       },
  { id: 'nursing',    label: 'Nursing',              description: 'Registered nurses and nursing leadership',  icon: Users       },
];

const SETTING_DRIVER_IDS: Record<DataRequestSetting, string[]> = {
  outpatient: ['patientAccess', 'wrvu', 'hccCapture', 'denialPrevention', 'providerWellbeing', 'physicianLocumAgency', 'scribeCostReduction'],
  ed:         ['lwbsRecovery', 'admissionCapture', 'edEmLevel', 'denialPrevention', 'providerWellbeing', 'physicianLocumAgency', 'scribeCostReduction'],
  inpatient:  ['drgAccuracy', 'obsDefense', 'ipDischargePlanning', 'ipProviderWellbeing', 'physicianLocumAgency'],
  nursing:    ['nursingRetention', 'nursingAgency', 'nursingOvertime', 'nursingHapi', 'nursingFalls', 'nursingCauti', 'nursingClabsi', 'nursingSepsis'],
};

const QUADRANTS = ['Capacity', 'Workforce', 'Revenue', 'Quality'] as const;

const EMPTY_SELECTION: Record<DataRequestSetting, string[]> = {
  outpatient: [], ed: [], inpatient: [], nursing: [],
};

export default function DataRequestBuilder({ onBack }: Props) {
  const [step, setStep]                       = useState<1 | 2>(1);
  const [settings, setSettings]               = useState<DataRequestSetting[]>([]);
  const [selectedBySetting, setSelectedBySetting] = useState<Record<DataRequestSetting, string[]>>(EMPTY_SELECTION);
  const [downloaded, setDownloaded]           = useState(false);

  // Canonical display order, filtered to what's selected.
  const orderedSettings = SETTINGS.filter(s => settings.includes(s.id)).map(s => s.id);

  function toggleSetting(id: DataRequestSetting) {
    setDownloaded(false);
    setSettings(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleDriver(setting: DataRequestSetting, id: string) {
    setDownloaded(false);
    setSelectedBySetting(prev => {
      const cur = prev[setting];
      return { ...prev, [setting]: cur.includes(id) ? cur.filter(d => d !== id) : [...cur, id] };
    });
  }

  function handleContinue() {
    if (settings.length === 0) return;
    setStep(2);
  }

  function handleDownload() {
    if (orderedSettings.length === 0) return;
    generateMultiDataRequestExcel(orderedSettings, selectedBySetting);
    setDownloaded(true);
  }

  function startOver() {
    setSettings([]);
    setSelectedBySetting(EMPTY_SELECTION);
    setDownloaded(false);
    setStep(1);
  }

  const driversForSetting = (setting: DataRequestSetting) =>
    SETTING_DRIVER_IDS[setting]
      .map(id => DRIVER_FIELDS.find(g => g.driverId === id))
      .filter(Boolean) as typeof DRIVER_FIELDS;

  const settingLabel = (id: DataRequestSetting) => SETTINGS.find(s => s.id === id)?.label ?? '';

  const totalSelectedDrivers = orderedSettings.reduce((n, s) => n + selectedBySetting[s].length, 0);
  const multiPlan = getMultiRequestFieldPlan(orderedSettings, selectedBySetting);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-sm border-b border-[#EDEBE6]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={step === 2 ? () => setStep(1) : onBack}
            className="flex items-center gap-1.5 text-[#888888] text-sm hover:text-[#1A1A1A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 2 ? 'Change settings' : 'Back'}
          </button>
          <img src={abridgeLogo} alt="Abridge" className="h-5" />
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[#888888] text-sm hover:text-[#1A1A1A] transition-colors"
            data-testid="btn-exit-data-request"
          >
            Exit <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="pt-14">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Setting Selection (multi-select) ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
              className="max-w-[680px] mx-auto px-4 sm:px-6 py-16"
            >
              <div className="text-center mb-12">
                <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#EA2C00] mb-4">
                  Data Request Builder
                </p>
                <h1 className="text-[32px] font-bold tracking-tight text-[#1A1A1A] leading-tight mb-3">
                  Who are you modeling for?
                </h1>
                <p className="text-[15px] text-[#888888] leading-relaxed max-w-md mx-auto">
                  Pick every care setting in scope. You'll choose the value drivers for each, and we'll generate one clean Excel with a tab per setting.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SETTINGS.map((s, i) => {
                  const Icon = s.icon;
                  const driverCount = SETTING_DRIVER_IDS[s.id].length;
                  const selected = settings.includes(s.id);
                  return (
                    <motion.button
                      key={s.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      onClick={() => toggleSetting(s.id)}
                      aria-pressed={selected}
                      data-testid={`ds-setting-${s.id}`}
                      className={`group text-left bg-white border rounded-2xl p-6 transition-all duration-200 ${
                        selected
                          ? 'border-[#1A1A1A] shadow-md'
                          : 'border-[#E5E5E5] hover:border-[#1A1A1A] hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                          selected ? 'bg-[#EA2C00]/10' : 'bg-[#FEF2EE] group-hover:bg-[#EA2C00]/10'
                        }`}>
                          <Icon className="w-5 h-5 text-[#EA2C00]" />
                        </div>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                          selected ? 'bg-[#1A1A1A] border-[#1A1A1A]' : 'border-[#D5D5D5]'
                        }`}>
                          {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                      </div>
                      <p className="font-bold text-[#1A1A1A] text-base mb-1">{s.label}</p>
                      <p className="text-sm text-[#888888] mb-4">{s.description}</p>
                      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#AAAAAA]">
                        {driverCount} drivers available
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-10 flex flex-col items-center">
                <button
                  onClick={handleContinue}
                  disabled={settings.length === 0}
                  data-testid="ds-continue"
                  className="inline-flex items-center gap-2 bg-[#1A1A1A] text-white rounded-xl px-7 py-3 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black transition-all"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[12px] text-[#888888] mt-3 h-4">
                  {settings.length > 0
                    ? `${settings.length} ${settings.length === 1 ? 'care setting' : 'care settings'} selected`
                    : ''}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Driver Selection (grouped by setting) + Right Panel ── */}
          {step === 2 && orderedSettings.length > 0 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
              className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10"
            >
              <div className="flex flex-col lg:flex-row gap-10 items-start">

                {/* Left: Driver Selection, grouped by setting */}
                <div className="flex-1 min-w-0">
                  <div className="mb-8">
                    <p className="text-[10px] font-bold uppercase tracking-[2.5px] text-[#888888] mb-3">
                      {orderedSettings.length} {orderedSettings.length === 1 ? 'care setting' : 'care settings'}
                    </p>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#1A1A1A] mb-2">
                      Which areas are you modeling?
                    </h1>
                    <p className="text-[14px] text-[#888888]">
                      Select the value drivers relevant to this prospect, per setting. Only drivers with quantifiable dollar impact are shown.
                    </p>
                  </div>

                  <div className="space-y-12">
                    {orderedSettings.map(setting => {
                      const settingDrivers = driversForSetting(setting);
                      return (
                        <div key={setting} data-testid={`ds-setting-section-${setting}`}>
                          <p className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#1A1A1A] mb-5 pb-2 border-b border-[#EDEBE6]">
                            {settingLabel(setting)}
                          </p>
                          <div className="space-y-8">
                            {QUADRANTS.map(q => {
                              const qDrivers = settingDrivers.filter(d => d.quadrant === q);
                              if (qDrivers.length === 0) return null;
                              return (
                                <div key={q}>
                                  <p className="text-[10px] font-bold uppercase tracking-[2.5px] text-[#AAAAAA] mb-3">{q}</p>
                                  <div className="space-y-2">
                                    {qDrivers.map(driver => {
                                      const selected = selectedBySetting[setting].includes(driver.driverId);
                                      return (
                                        <button
                                          key={driver.driverId}
                                          onClick={() => toggleDriver(setting, driver.driverId)}
                                          className={`w-full text-left flex items-start gap-4 rounded-xl px-5 py-4 border transition-all duration-150 ${
                                            selected
                                              ? 'border-[#1A1A1A] bg-white shadow-sm'
                                              : 'border-[#E8E4DF] bg-white hover:border-[#CCCCCC]'
                                          }`}
                                        >
                                          <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                                            selected ? 'bg-[#1A1A1A] border-[#1A1A1A]' : 'border-[#CCCCCC]'
                                          }`}>
                                            {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold leading-snug ${selected ? 'text-[#1A1A1A]' : 'text-[#333333]'}`}>
                                              {driver.driverLabel}
                                            </p>
                                            <p className="text-xs text-[#888888] mt-0.5 leading-snug">
                                              {driver.fields.map(f => f.label).join(' · ')}
                                            </p>
                                          </div>
                                          <span className={`shrink-0 text-[9px] font-bold uppercase tracking-[1px] rounded-full px-2.5 py-1 mt-0.5 ${
                                            selected ? 'bg-[#1A1A1A] text-white' : 'bg-[#F5F0EB] text-[#888888]'
                                          }`}>
                                            {driver.fields.length} {driver.fields.length === 1 ? 'field' : 'fields'}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Live Preview Panel (aggregated across settings) */}
                <motion.div
                  className="w-full lg:w-[320px] shrink-0 lg:sticky lg:top-24"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <div className="bg-[#1A1A1A] rounded-2xl p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[2px] text-white/50 mb-3">Your Data Request</p>
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {orderedSettings.map(s => (
                        <span key={s} className="inline-flex items-center bg-white/10 rounded-full px-2.5 py-1 text-[11px] font-medium text-white/80">
                          {settingLabel(s)}
                        </span>
                      ))}
                    </div>

                    {orderedSettings.map(setting => {
                      const baseline = BASELINE_FIELDS[setting];
                      const groups = driversForSetting(setting).filter(d => selectedBySetting[setting].includes(d.driverId));
                      return (
                        <div key={setting} className="mb-5">
                          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-white/50 mb-2">{settingLabel(setting)}</p>

                          <div className="mb-3">
                            <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-white/25 mb-1.5">Baseline · always included</p>
                            <ul className="space-y-1">
                              {baseline.map(f => (
                                <li key={f.id} className="flex items-center gap-2">
                                  <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                                  <span className="text-[12px] text-white/60">{f.label}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {groups.map(group => (
                            <div key={group.driverId} className="mb-3">
                              <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-white/25 mb-1.5">{group.driverLabel}</p>
                              <ul className="space-y-1">
                                {group.fields.map(f => (
                                  <li key={f.id} className="flex items-center gap-2">
                                    <span className="w-1 h-1 rounded-full bg-[#EA2C00]/60 shrink-0" />
                                    <span className="text-[12px] text-white/70">{f.label}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    {totalSelectedDrivers === 0 && (
                      <p className="text-[12px] text-white/30 italic mb-4">Select drivers to add them to the request.</p>
                    )}

                    <div className="border-t border-white/10 pt-4 mt-2 mb-5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-white/40">The ask</span>
                        <span className="text-[13px] font-bold text-white">
                          <span className="text-[#EA2C00]">{multiPlan.requiredCount} required</span>
                          <span className="text-white/40"> · {multiPlan.optionalCount} optional</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-white/30 mt-1">
                        Only the required numbers must be filled. Optional fields use an industry benchmark if left blank.
                      </p>
                    </div>

                    {downloaded ? (
                      <div className="bg-white/10 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Check className="w-4 h-4 text-white" />
                          <p className="text-[13px] font-semibold text-white">Downloaded</p>
                        </div>
                        <p className="text-[11px] text-white/50 mb-3">Share with your prospect to collect their numbers.</p>
                        <button
                          onClick={startOver}
                          className="text-[11px] text-[#EA2C00] hover:text-[#EA2C00]/80 font-medium transition-colors"
                        >
                          Start over →
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleDownload}
                        disabled={totalSelectedDrivers === 0}
                        data-testid="ds-download"
                        className="w-full flex items-center justify-center gap-2 bg-white text-[#1A1A1A] rounded-xl py-3 text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/90 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Download Excel
                      </button>
                    )}
                  </div>
                </motion.div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx tsc --noEmit -p tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Run the full test suite**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npx vitest run`
Expected: all tests pass (the two new files from Tasks 1 & 2 plus the untouched guard test).

- [ ] **Step 4: Build the UI**

Run: `cd "/Users/brad/Desktop/The-ROI-Calculator 2" && npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/brad/Desktop/The-ROI-Calculator 2"
git add client/src/pages/data-request/DataRequestBuilder.tsx
git commit -m "feat: multi-select care settings in the Data Request Builder"
```

---

## Self-Review

**1. Spec coverage:**
- Multi-setting state (`settings` + `selectedBySetting`) → Task 3 state refactor. ✓
- Step 1 multi-select cards + Continue (disabled until ≥1) → Task 3 Step 1. ✓
- Step 2 drivers grouped per setting; aggregated right panel; counts summed → Task 3 (grouping) + Task 2 (aggregation). ✓
- "Change settings" back preserves selections → Task 3 header back button sets `step` only, state untouched. ✓
- One combined Excel: shared Instructions + one Data Fields sheet per setting; reuse styled internals; single-setting functions + guard test intact → Task 1. ✓
- Unit tests: workbook has Instructions + one sheet per setting, styled/non-empty; aggregated counts sum correctly → Task 1 + Task 2 tests. ✓
- Wire Download to multi generator; Exit + premium styling intact → Task 3. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; no "handle edge cases". ✓

**3. Type consistency:** `buildMultiDataRequestWorkbook` / `generateMultiDataRequestExcel` / `getMultiRequestFieldPlan` signatures match across tasks; `Record<DataRequestSetting, string[]>` used consistently and exhaustively (`EMPTY_SELECTION` covers all four keys). Sheet names in Task 1 (`"Emergency Dept"`, `"Outpatient"`, `"Inpatient"`, `"Nursing"`) match the test's `toEqual`. ✓

**4. Copy check:** No em dashes anywhere in the rewritten file (the pre-existing "Baseline — always included" label was changed to "Baseline · always included" to comply). All copy uses "·", ":", or ".".
