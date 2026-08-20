// Stage 2 — EXHAUSTIVE no-bleed / visual-integrity fuzz for the Explore editorial PDF.
// Reads scratchpad/pdf-combos.json (528 combos), renders each at ?explorepdf=1 by
// seeding localStorage["abridge:explore-pdf"], and asserts every page is "solid":
//   (1) no content bleeds past its fixed 816x1056 page box,
//   (2) no empty/orphan page (near-blank) + every non-cover page carries the footer,
//   (3) the synthesis bar's segments reconcile to the stated total,
//   (4) every <text> inside an <svg> stays within its <svg> box.
// Collects failures (never throws), screenshots the first 5 failing combos, exits 1 on red.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = import.meta.dirname;
const URL = "http://localhost:5173/?explorepdf=1";
const KEY = "abridge:explore-pdf";
const PAGE_W = 816;
const PAGE_H = 1056;
const SLOP = 1.5;
const MAX_SCREENSHOTS = 5;

let combos = JSON.parse(readFileSync(`${BASE}/combos.json`, "utf8"));
if (process.env.LIMIT) combos = combos.slice(0, Number(process.env.LIMIT));
if (process.env.SAMPLE) {
  // one interesting combo per setting: all-drivers-on (last mask of each block)
  const bySetting = {};
  for (const c of combos) bySetting[c.setting] = c; // last seen = highest mask
  combos = Object.values(bySetting);
}

// ── fmtShort inverse: "$1.2M" -> 1200000, "$340K" -> 340000, "$0" -> 0, "$12,345" -> 12345
function parseShort(raw) {
  if (raw == null) return NaN;
  const s = String(raw).replace(/[−–]/g, "-");
  const neg = /-/.test(s);
  const m = s.match(/([\d,]+(?:\.\d+)?)\s*([MK])?/i);
  if (!m) return NaN;
  let n = Number(m[1].replace(/,/g, ""));
  const unit = (m[2] || "").toUpperCase();
  if (unit === "M") n *= 1e6;
  else if (unit === "K") n *= 1e3;
  return neg ? -n : n;
}

// Runs in the browser: measure every page and return compact geometry facts.
function measure() {
  const root = document.querySelector(".explore-pdf-root");
  if (!root) return { error: "no .explore-pdf-root" };
  const pages = [...root.children];
  const results = [];
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    const P = page.getBoundingClientRect();
    let worst = { over: 0, tag: "", text: "", edge: "" };
    const all = page.querySelectorAll("*");
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const overs = [
        ["right", r.right - P.right],
        ["bottom", r.bottom - P.bottom],
        ["left", P.left - r.left],
        ["top", P.top - r.top],
      ];
      for (const [edge, o] of overs) {
        if (o > worst.over) {
          worst = { over: o, edge, tag: el.tagName.toLowerCase(), text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50) };
        }
      }
    }
    const txt = (page.textContent || "").replace(/\s+/g, " ").trim();

    // SVG <text> containment
    let svgWorst = { over: 0, text: "" };
    for (const svg of page.querySelectorAll("svg")) {
      const S = svg.getBoundingClientRect();
      for (const t of svg.querySelectorAll("text")) {
        const r = t.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const o = Math.max(r.right - S.right, r.bottom - S.bottom, S.left - r.left, S.top - r.top);
        if (o > svgWorst.over) svgWorst = { over: o, text: (t.textContent || "").trim().slice(0, 40) };
      }
    }

    // Synthesis bars on this page
    const synths = [];
    const labels = [...page.querySelectorAll("*")].filter(
      (e) => e.childElementCount === 0 && (e.textContent || "").trim() === "The four areas, together",
    );
    for (const lbl of labels) {
      const header = lbl.parentElement;
      const rootDiv = header ? header.parentElement : null;
      if (!rootDiv || rootDiv.children.length < 2) continue;
      const totalText = header.children[1] ? header.children[1].textContent : "";
      const bar = rootDiv.children[1];
      const segTexts = [...bar.children].map((c) => (c.textContent || "").trim());
      synths.push({ totalText, segTexts });
    }

    results.push({
      index: pi,
      scrollH: page.scrollHeight,
      scrollW: page.scrollWidth,
      worst,
      svgWorst,
      textLen: txt.length,
      hasFooter: /Abridge ·/.test(txt),
      synths,
    });
  }
  return { pages: results };
}

const failures = [];
let screenshots = 0;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1120 }, deviceScaleFactor: 1 });

// Establish origin so localStorage is writable.
await page.goto(URL, { waitUntil: "domcontentloaded" });

let done = 0;
for (const combo of combos) {
  const { setting, mask, data } = combo;
  const empty = (data.totalAnnualValue || 0) === 0; // all-drivers-off model (UI-blocked, checked leniently)

  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, v),
    [KEY, JSON.stringify(data)],
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()));
  await page.waitForTimeout(120);

  const res = await page.evaluate(measure);
  const comboFails = [];

  if (res.error) {
    comboFails.push(`ROOT MISSING (${res.error})`);
  } else {
    for (const p of res.pages) {
      const tag = `page ${p.index}`;
      // (1) bleed — element spilling past the page box
      if (p.worst.over > SLOP) {
        comboFails.push(
          `BLEED ${tag}: <${p.worst.tag}> spills ${p.worst.over.toFixed(1)}px past ${p.worst.edge} ("${p.worst.text}")`,
        );
      }
      // (1b) page's own box grew past the fixed dimensions
      if (p.scrollH > PAGE_H + 2) comboFails.push(`BLEED ${tag}: scrollHeight ${p.scrollH} > ${PAGE_H}`);
      if (p.scrollW > PAGE_W + 2) comboFails.push(`BLEED ${tag}: scrollWidth ${p.scrollW} > ${PAGE_W}`);
      // (4) svg text overflow
      if (p.svgWorst.over > SLOP) {
        comboFails.push(`SVGTEXT ${tag}: "${p.svgWorst.text}" spills ${p.svgWorst.over.toFixed(1)}px past its <svg>`);
      }
      // (2) empty/orphan + footer — leniency for the UI-blocked empty model
      if (!empty) {
        if (p.textLen < 40) comboFails.push(`EMPTY ${tag}: only ${p.textLen} chars of text (near-blank)`);
        if (p.index > 0 && !p.hasFooter) comboFails.push(`NOFOOTER ${tag}: missing running footer`);
      }
      // (3) synthesis reconciliation
      if (!empty) {
        for (const syn of p.synths) {
          const total = parseShort(syn.totalText);
          if (!Number.isFinite(total) || total <= 0) continue;
          let segSum = 0;
          let ok = true;
          for (const st of syn.segTexts) {
            const dm = st.match(/\$[\d.,]+\s*[MK]?/);
            if (!dm) { ok = false; break; }
            const v = parseShort(dm[0]);
            if (!Number.isFinite(v)) { ok = false; break; }
            segSum += v;
          }
          if (!ok) continue;
          const tol = Math.max(total * 0.02, 300000);
          if (Math.abs(segSum - total) > tol) {
            comboFails.push(
              `SYNTH ${tag}: segments Σ=${segSum} vs total ${total} (Δ=${Math.round(segSum - total)}, tol=${Math.round(tol)}) [${syn.segTexts.join(", ")}]`,
            );
          }
        }
      }
    }
  }

  if (comboFails.length) {
    failures.push({ setting, mask, empty, fails: comboFails });
    if (screenshots < MAX_SCREENSHOTS) {
      const shot = `${BASE}/bleed-fail-${setting}-${mask}.png`;
      try {
        await page.screenshot({ path: shot, fullPage: true });
        failures[failures.length - 1].shot = shot;
        screenshots++;
      } catch {
        /* ignore */
      }
    }
  }

  done++;
  if (done % 50 === 0) process.stdout.write(`  …${done}/${combos.length}\n`);
}

await browser.close();

// ── Report ──
const perSetting = {};
for (const c of combos) {
  perSetting[c.setting] = perSetting[c.setting] || { total: 0, failed: 0 };
  perSetting[c.setting].total++;
}
for (const f of failures) perSetting[f.setting].failed++;

console.log("\n════════════════ NO-BLEED FUZZ REPORT ════════════════");
console.log(`Total combos: ${combos.length}   Passed: ${combos.length - failures.length}   Failed: ${failures.length}\n`);
for (const s of Object.keys(perSetting)) {
  const { total, failed } = perSetting[s];
  const mark = failed === 0 ? "GREEN ✓" : "RED ✗";
  console.log(`  ${mark}  ${s.padEnd(11)} ${total - failed}/${total} passed` + (failed ? `  (${failed} failed)` : ""));
}

if (failures.length) {
  console.log("\n──────────── FAILURES ────────────");
  for (const f of failures) {
    const flag = f.empty ? " [empty-model]" : "";
    console.log(`\n${f.setting} mask ${f.mask}${flag}${f.shot ? "  → " + f.shot : ""}`);
    for (const line of f.fails) console.log(`   • ${line}`);
  }
} else {
  console.log("\nAll pages solid — no bleed, no orphan pages, synthesis reconciles.");
}
console.log("═══════════════════════════════════════════════════════");

process.exit(failures.length ? 1 : 0);
