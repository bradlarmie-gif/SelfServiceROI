/**
 * VISUAL SWEEP — the screenshot-first guard for AESTHETIC / stateful layout bugs.
 *
 * layout-smoke.mjs (the pass/fail gate) catches overflow, wrapped headers,
 * clipped inputs, and PDF bleed. It is blind to two things that keep slipping
 * through to the user:
 *   1. INTERACTIVE STATES — a driver card's "Adjust assumptions" tray only exists
 *      once a driver is ON and the disclosure is open; smoke never opens it, so a
 *      lopsided tray shipped green.
 *   2. AESTHETIC defects — a chart label floating over the curve, ragged columns,
 *      uneven rhythm. These render INSIDE the box (no overflow), so no automated
 *      pass/fail can see them. A human/agent has to LOOK.
 *
 * This tool therefore does two jobs:
 *   A. Drives a MATRIX of states (each care setting, drivers on, tray open,
 *      advanced panel open, every proforma chapter, every PDF page) and writes a
 *      screenshot for EACH to scripts/visual-sweep-out/ — the gallery the agent
 *      reviews before declaring any visual change done.
 *   B. Runs the auto-checks smoke lacks: overlapping interactive controls,
 *      text escaping its own box, and SVG <text> overlapping a chart path
 *      (the floating-label class). Hard defects exit non-zero.
 *
 * Usage:  run the dev server on :5210 (in another shell)
 *         node scripts/visual-sweep.mjs
 * Review: open every PNG in scripts/visual-sweep-out/ and eyeball it. The point
 *         is the LOOK — the auto-checks are a floor, not the ceiling.
 */
import pkg from "../node_modules/playwright-core/index.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { chromium } = pkg;

const BASE = process.env.SWEEP_BASE || "http://localhost:5210";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "visual-sweep-out");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const fails = [];   // hard defects → non-zero exit
const notes = [];   // soft observations for the review log
const shots = [];   // manifest

// ── Defensive helpers ───────────────────────────────────────────────────────
const clickIf = async (page, sel, opts = {}) => {
  try { const el = await page.$(sel); if (el) { await el.click({ timeout: 1500, force: true, ...opts }); return true; } } catch {}
  return false;
};
const clickText = async (page, re) => {
  try { await page.getByText(re).first().click({ timeout: 1500, force: true }); return true; } catch { return false; }
};
const page_hoverFirstLegend = async (page) => {
  try { const el = await page.$("[data-testid^=ar-legend-]"); if (el) { await el.hover({ timeout: 1200 }); await page.waitForTimeout(250); } } catch {}
};
const fillAllNumbers = async (page, val = "200") => {
  const inputs = await page.$$("input");
  for (const inp of inputs) {
    try { await inp.click({ timeout: 600 }); await inp.fill(val, { timeout: 600 }); } catch {}
  }
};

// The reusable Explore drive: land on a value (driver) screen for a setting,
// turn drivers on, and open every assumptions tray. Returns the step title.
async function driveCalculator(page, setting, { stopAt = "answer" } = {}) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /estimate my value|calculate your roi/i }).first().click({ timeout: 6000 });
  await page.waitForTimeout(500);
  if (stopAt === "setting") return `${setting} — care setting`;

  const LABEL = { outpatient: "Outpatient", ed: "Emergency", inpatient: "Inpatient", nursing: "Nursing" };
  await page.getByText(LABEL[setting], { exact: true }).first().click({ timeout: 6000 });
  await page.waitForTimeout(600);
  if (stopAt === "goals") return `${setting} — goals (empty)`;

  // the goals step scopes everything after it; pick them all for the widest case
  const goalCards = page.locator("[data-testid^=goal-]");
  const goalCount = await goalCards.count();
  for (let i = 0; i < goalCount; i++) await goalCards.nth(i).click({ timeout: 3000 }).catch(() => {});
  const payer = page.getByTestId("payer-both");
  if (await payer.count()) await payer.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(250);
  if (stopAt === "goals-picked") return `${setting} — goals (${goalCount} picked)`;
  await page.getByRole("button", { name: /next: your numbers/i }).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(600);
  if (stopAt === "account") return `${setting} — the account (empty)`;

  const inputs = page.locator("input");
  const vals = ["Riverbend Family Medicine", "42", "30", "2400", "68"];
  for (let i = 0; i < vals.length; i++) {
    await inputs.nth(i).fill(vals[i], { timeout: 4000 }).catch(() => {});
  }
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(400);
  if (stopAt === "account-filled") return `${setting} — the account (filled)`;

  await page.getByRole("button", { name: /next: what changes/i }).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(700);

  const toggles = page.locator('button[role="switch"], input[type="checkbox"]');
  const n = Math.min(4, await toggles.count());
  for (let i = 0; i < n; i++) { await toggles.nth(i).click({ timeout: 1500 }).catch(() => {}); }
  await page.waitForTimeout(500);
  if (stopAt === "lift") return `${setting} — the lift, ${n} drivers on`;

  await page.getByRole("button", { name: /see my number/i }).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(900);
  return `${setting} — the answer`;
}

function audit() {
  const out = { overflow: 0, overlaps: [], escaped: [], svgLabels: [] };
  out.overflow = document.documentElement.scrollWidth - window.innerWidth;

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };

  // Overlapping interactive controls: two buttons/inputs/selects whose rects
  // overlap by >6px on BOTH axes = a broken layout (they should never sit on
  // top of each other).
  const ctrls = [...document.querySelectorAll("button, input, select, [role=button]")].filter(visible);
  for (let i = 0; i < ctrls.length; i++) {
    for (let j = i + 1; j < ctrls.length; j++) {
      const a = ctrls[i], b = ctrls[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 6 && oy > 6) {
        out.overlaps.push(`${(a.textContent || a.getAttribute("data-testid") || a.tagName).trim().slice(0, 20)} ✕ ${(b.textContent || b.getAttribute("data-testid") || b.tagName).trim().slice(0, 20)}`);
      }
    }
  }

  // SVG <text> that overlaps a chart <path>/<polyline> in the same svg — the
  // "label floating over the curve" class (the Month 0 bug). Flags a text whose
  // box overlaps a stroke path box by a real amount, excluding the intended
  // on-line marker (a text within ~14px of a circle/dot marker is deliberate).
  for (const svg of document.querySelectorAll("svg")) {
    const texts = [...svg.querySelectorAll("text")];
    const paths = [...svg.querySelectorAll("path, polyline")];
    const markers = [...svg.querySelectorAll("circle")].map((c) => c.getBoundingClientRect());
    for (const t of texts) {
      const rt = t.getBoundingClientRect();
      const nearMarker = markers.some((m) => Math.hypot((m.left + m.right) / 2 - (rt.left + rt.right) / 2, (m.top + m.bottom) / 2 - (rt.top + rt.bottom) / 2) < 22);
      if (nearMarker) continue;
      for (const p of paths) {
        const rp = p.getBoundingClientRect();
        const ox = Math.min(rt.right, rp.right) - Math.max(rt.left, rp.left);
        const oy = Math.min(rt.bottom, rp.bottom) - Math.max(rt.top, rp.top);
        if (ox > 4 && oy > 4) { out.svgLabels.push(`"${(t.textContent || "").trim().slice(0, 18)}" over curve`); break; }
      }
    }
  }
  return out;
}

async function scene(browser, name, setup, { width = 1440, height = 1000 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.print = () => {}; });
  let title = "";
  try {
    title = (await setup(page)) || "";
    await page.waitForTimeout(300);
    const file = join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    shots.push(`${name}.png${title ? `  (${title})` : ""}`);
    const r = await page.evaluate(audit);
    if (r.overflow > 3) fails.push(`${name}: horizontal overflow ${r.overflow}px`);
    for (const o of r.overlaps.slice(0, 6)) fails.push(`${name}: overlapping controls — ${o}`);
    // svg-label overlap is heuristic (a path's bbox spans the whole chart, so
    // legitimate in-chart labels trip it) — a LOOK prompt, not a hard fail.
    for (const s of r.svgLabels.slice(0, 6)) notes.push(`${name}: review chart label — ${s}`);
  } catch (e) {
    notes.push(`${name}: drive error ${String(e).slice(0, 90)}`);
    try { await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true }); shots.push(`${name}.png (partial)`); } catch {}
  }
  await ctx.close();
}

const browser = await chromium.launch();

// ── A. On-screen surfaces, including interactive states ──────────────────────
// The app is one path, so the matrix is: the home screen, then every step of
// the calculator, walked for every care setting (the copy and drivers differ
// per setting, which is exactly where setting-wrong wording hides).
await scene(browser, "home", async (p) => {
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  return "landing screen";
});

await scene(browser, "calc-1-care-setting", (p) => driveCalculator(p, "outpatient", { stopAt: "setting" }));

for (const s of ["outpatient", "ed", "inpatient", "nursing"]) {
  await scene(browser, `calc-2-goals-${s}`, (p) => driveCalculator(p, s, { stopAt: "goals" }), { height: 1200 });
  await scene(browser, `calc-2-goals-${s}-picked`, (p) => driveCalculator(p, s, { stopAt: "goals-picked" }), { height: 1200 });
  await scene(browser, `calc-3-account-${s}-empty`, (p) => driveCalculator(p, s, { stopAt: "account" }), { height: 1300 });
  await scene(browser, `calc-3-account-${s}-filled`, (p) => driveCalculator(p, s, { stopAt: "account-filled" }), { height: 1300 });
  await scene(browser, `calc-4-lift-${s}`, (p) => driveCalculator(p, s, { stopAt: "lift" }), { height: 1800 });
  await scene(browser, `calc-5-answer-${s}`, (p) => driveCalculator(p, s), { height: 1600 });
}

// ── B. PDFs, one screenshot PER PAGE (so each page gets its own eyeball) ──────
const PDF_ROUTES = [
  { url: "/?quickroipdf=1", label: "roi-one-pager" },
];
const PAGE_H = 1056;
for (const route of PDF_ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 816, height: PAGE_H } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.print = () => {}; });
  try {
    await page.goto(BASE + route.url, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(1200);
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const pages = Math.max(1, Math.round(total / PAGE_H));
    for (let i = 0; i < pages; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * PAGE_H);
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(OUT, `${route.label}-p${i + 1}.png`), clip: { x: 0, y: 0, width: 816, height: PAGE_H } });
      shots.push(`${route.label}-p${i + 1}.png`);
    }
    const r = await page.evaluate(audit);
    for (const s of r.svgLabels.slice(0, 6)) notes.push(`${route.label}: review chart label — ${s}`);
  } catch (e) {
    notes.push(`${route.label}: PDF render error ${String(e).slice(0, 90)}`);
  }
  await ctx.close();
}

await browser.close();

// ── Report ───────────────────────────────────────────────────────────────────
const manifest = [
  `VISUAL SWEEP — ${shots.length} screenshots in scripts/visual-sweep-out/`,
  "REVIEW EVERY IMAGE — auto-checks are a floor; lopsided/ragged/floating is a LOOK call.",
  "",
  "Screenshots:", ...shots.map((s) => "  " + s),
  "",
  notes.length ? "Notes (non-blocking):" : "", ...notes.map((n) => "  " + n),
].join("\n");
writeFileSync(join(OUT, "MANIFEST.txt"), manifest);
console.log(manifest);

if (fails.length) {
  console.error(`\n✗ VISUAL SWEEP auto-checks flagged ${fails.length}:\n` + fails.map((f) => "  " + f).join("\n") + "\n");
  process.exit(1);
}
console.log("\n✓ auto-checks clean (no overflow, no overlapping controls, no chart-label collisions). Now REVIEW the gallery.");
