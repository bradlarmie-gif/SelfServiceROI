import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { scanFiles, formatHits, type Rule } from "./support/copyGuardrail";

/**
 * COPY guardrails for the Self Service ROI Tool.
 *
 * This app is a single path, so this is the whole customer-visible copy
 * surface: the landing screen, the calculator's three steps, the driver labels
 * its calc summaries quote, and the exported PDF. The objective
 * tripwires (em dashes, causal/guarantee absolutes, "credited to") live in
 * ./support/copyGuardrail and are shared.
 *
 * NOTE: `scanFiles` skips paths it cannot read, so a guardrail pointed at a
 * deleted file passes while checking nothing. That is exactly how the previous
 * per-tool guardrails rotted when their features were removed. The first test
 * below is the negative control: it fails loudly if any listed path stops
 * existing, so this guard can never go quietly vacuous.
 */

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_SRC = join(here, "..");

const FILES: string[] = [
  "pages/SplashScreen.tsx",
  "pages/forecast/QuickRoiCalculator.tsx",
  "components/forecast/QuickRoiEditorialPdf.tsx",
  "components/forecast/QuickRoiEditorialPdfRoute.tsx",
  "components/UnifiedHeader.tsx",
  // the driver titles, notes, field labels and worked-math strings all render
  // on the "what changes" step and inside the PDF, so they are live copy too
  "pages/forecast/roiEngine.ts",
  "lib/exploreDriverCalcs.ts",
];

// Deliberately NOT scanned: lib/exploreDrivers.ts. It reads as copy (it is full
// of taglines and shortDescriptions) but this app only consumes its driver ids
// and quadrant mapping; none of its prose reaches the screen. Verified by
// dumping the rendered text of every screen in every setting and finding zero
// matches. Scanning it only produces findings on dead strings, which is how a
// guard trains people to ignore it. If any of it is ever rendered, add it back.

/**
 * AUDIENCE rules, specific to this tool.
 *
 * This is self service: the reader is a doctor or a small group sizing their
 * own practice. They have no Abridge rep and no impact-analysis data pull, so
 * copy inherited from the rep-facing calculator ("your partner", "read it off
 * the impact analysis", "the rep dials it") is not merely off-tone, it points
 * at something the reader does not have. This tool used to be that tool, so
 * the vocabulary is a live regression risk, not a hypothetical one.
 */
const AUDIENCE_RULES: Rule[] = [
  { name: "rep-vocabulary", hit: (c) => /\b(partner|partners|the rep|impact analysis|impact-analysis|data pull|prospect)\b/i.test(c) },
  // "realization" was removed from the inputs; it must not come back in the
  // worked math or a label either. Matches the phrasings a reader would SEE
  // ("x 75% realization", "realization rate"), not the identifiers and field
  // names the engine legitimately uses (f.realization, wrvuRealization).
  { name: "realization-jargon", hit: (c) => /%\s*realization\b/i.test(c) || /\brealization\s+(rate|rates|share|assumption)\b/i.test(c) },
  /**
   * Harm-prevention claims. The shared core rule catches the verb "prevents",
   * but the noun forms walked straight past it: the nursing quality drivers
   * shipped "x 10% prevention" and a field labelled "Prevention attributable to
   * timely docs", which tells a physician the product prevents falls, CLABSI and
   * pressure injuries. It does not. It surfaces documentation sooner, and the
   * care team decides and acts. Any avoided-harm share must keep the team as the
   * actor. "preventable"/"avoidable" as a standing clinical descriptor is fine.
   */
  { name: "prevention-claim", hit: (c) => /\bprevent(ion|ions|ed|ing)\b/i.test(c) },
];

describe("ROI Calculator COPY guardrails", () => {
  it("every file this guard claims to scan actually exists", () => {
    const missing = FILES.filter((rel) => !existsSync(join(CLIENT_SRC, rel)));
    expect(missing, `Guardrail points at files that no longer exist:\n${missing.join("\n")}`).toEqual([]);
    expect(FILES.length).toBeGreaterThan(0);
  });

  it("no em dashes, no causal/guarantee absolutes, no 'credited to' in live copy", () => {
    const hits = scanFiles(CLIENT_SRC, FILES);
    expect(hits.length, `Copy guardrail hits (${hits.length}):\n${formatHits(hits)}`).toBe(0);
  });

  it("speaks to a practice sizing itself, not to a rep selling a partner", () => {
    const names = new Set(AUDIENCE_RULES.map((r) => r.name));
    // Filter to the audience rules only (the core tripwires have their own
    // test above), but never to a single rule: filtering by one name is how a
    // rule can sit in the list doing nothing, which is what happened here.
    const hits = scanFiles(CLIENT_SRC, FILES, AUDIENCE_RULES).filter((h) => names.has(h.rule));
    expect(hits.length, `Rep-facing vocabulary in self-service copy (${hits.length}):\n${formatHits(hits)}`).toBe(0);
  });
});
