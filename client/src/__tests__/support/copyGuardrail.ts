import { readFileSync } from "fs";
import { join } from "path";

/**
 * Shared COPY-guardrail scanner for every customer-facing PDF/editorial file.
 *
 * One source of truth for the objective Legal/brand tripwires, so a rule added
 * here (e.g. "prevents") is enforced across all four tools at once instead of
 * drifting per copy of the test. Tone stays a human review pass; this catches
 * only the mechanical, repeatable hits and fails with file:line.
 *
 * Enforced on all customer-facing copy:
 *   - NO em dashes (—). Brad's standing rule and the #1 "AI wrote this" tell.
 *   - NO causal/guarantee absolutes: guarantee, ensures, proven to, "causes X",
 *     "will <increase/save/…>", and present-tense "prevents" / "prevented by".
 *     Abridge surfaces and enables; it does not cause, guarantee, or prevent.
 *   - "attributed to", never "credited to".
 */

export interface Hit {
  file: string;
  line: number;
  rule: string;
  text: string;
}

export interface Rule {
  name: string;
  hit: (copy: string) => boolean;
}

// Block/JSX comments are blanked at the file level (so multi-line `/* … */` and
// `{/* … */}` never trip a rule); per line we skip `//` and `*` comment lines,
// trailing inline comments (the `://` guard leaves URLs intact), and the "—"
// empty-state placeholder (a UI dash, quoted or as JSX text — not prose).
const stripBlockComments = (c: string) =>
  c
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
const isCommentLine = (l: string) => /^\s*(\/\/|\*)/.test(l);
const stripComments = (l: string) => l.replace(/([^:"'`])\/\/.*$/, "$1");
const stripPlaceholders = (l: string) =>
  l.replace(/(["'`])\s*—\s*\1/g, "$1$1").replace(/>\s*—\s*</g, "><");

// Guarantee/ensure/cause/proven as a positive CLAIM. Negated forms
// ("not a guarantee", "no guarantee") are the disclaimer and are allowed.
const GUARANTEE = /\bguarantee[sd]?\b/i;
// Allow a short list between the negation and "guarantee" ("not a commitment or
// guarantee of savings"), not only the adjacent form ("not a guarantee").
const GUARANTEE_NEGATED = /\b(not a|no|never a|without)\s+(?:\w+\s+(?:and|or)\s+)?guarantee/i;
const ENSURES = /\bensures?\b/i;
const PROVEN = /\bproven to\b|\bclinically proven\b/i;
// "causes" as an Abridge-attributed EFFECT verb ("documentation causes X").
// NOT flagged: "all-cause"/"root cause" (medical terms), "cause of X"
// (describing the problem), and the plural NOUN after a determiner/quantifier
// ("has many causes", "the causes", "several causes") which names reasons, not
// an Abridge claim.
const CAUSES = /(?<!all-)(?<!root )(?<!\b(?:many|several|multiple|few|other|various|common|possible|potential|underlying|leading|the|its|of|no)\s)\bcauses?\b(?!\s+of\b)/i;
const CAUSAL_WILL = /\bwill\s+(increase|reduce|improve|save|generate|deliver|drive|lower|raise|cut|boost)\b/i;
const CREDITED = /credited to/i;
// Present-tense "prevents" and "prevented by" attribute prevention causally.
// The approved forms use the bare infinitive ("expected to prevent", "the share
// you expect to prevent"), which these patterns deliberately do NOT match.
const PREVENTS = /\bprevents\b/i;
const PREVENTED_BY = /\bprevented by\b/i;
// Present-tense "eliminates" / "eradicates" attribute removal causally, same as
// "prevents". The approved forms are descriptive ("clears", "expected to
// eliminate"), which the bare present tense here does not match.
const ELIMINATES = /\b(eliminates|eradicates)\b/i;

const CORE_RULES: Rule[] = [
  { name: "em-dash", hit: (c) => c.includes("—") },
  { name: "guarantee-claim", hit: (c) => GUARANTEE.test(c) && !GUARANTEE_NEGATED.test(c) },
  { name: "ensures", hit: (c) => ENSURES.test(c) },
  { name: "proven-to", hit: (c) => PROVEN.test(c) },
  { name: "causes", hit: (c) => CAUSES.test(c) },
  { name: "causal-will", hit: (c) => CAUSAL_WILL.test(c) },
  { name: "credited-to", hit: (c) => CREDITED.test(c) },
  { name: "prevents", hit: (c) => PREVENTS.test(c) },
  { name: "prevented-by", hit: (c) => PREVENTED_BY.test(c) },
  { name: "eliminates", hit: (c) => ELIMINATES.test(c) },
];

/** Scan `files` (relative to `root`) with the core rules plus any `extra` rules. */
export function scanFiles(root: string, files: string[], extra: Rule[] = []): Hit[] {
  const rules = [...CORE_RULES, ...extra];
  const hits: Hit[] = [];
  for (const rel of files) {
    let content: string;
    try {
      content = readFileSync(join(root, rel), "utf8");
    } catch {
      continue;
    }
    stripBlockComments(content).split("\n").forEach((line, i) => {
      if (isCommentLine(line)) return;
      const copy = stripPlaceholders(stripComments(line));
      for (const r of rules) if (r.hit(copy)) hits.push({ file: rel, line: i + 1, rule: r.name, text: line.trim() });
    });
  }
  return hits;
}

export function formatHits(hits: Hit[]): string {
  return hits.map((h) => `  [${h.rule}] ${h.file}:${h.line}  →  ${h.text.slice(0, 120)}`).join("\n");
}
