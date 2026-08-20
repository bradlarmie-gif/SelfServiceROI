/**
 * Standalone screenshot capture for the Notion manual.
 *
 * Reuses the SAME server setup as the Playwright e2e suite: it serves the built
 * static client via e2e/static-server.cjs (run `npm run build` first, or it uses
 * the existing dist/public) — NOT a dev server.
 *
 * Run:  npx tsx scripts/capture-screenshots.ts
 *
 * Captures EVERY screen of EVERY flow as consistent 1440×900 viewport crops
 * (fullPage:false) into notion-hub-screenshots/, OVERWRITING existing files.
 * Each screen is reached by clicking through from the home/journey selector
 * the way the e2e specs do (the app has almost no deep-link URLs). Where a
 * screen's hero is below the fold, the key element is scrolled into view first.
 * If a screen can't be reached it is logged and skipped — the run never aborts.
 */
import { chromium, type Page, type Browser } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "notion-hub-screenshots");
const PORT = 5066;
const BASE = `http://localhost:${PORT}`;
const VIEWPORT = { width: 1440, height: 900 };

mkdirSync(OUT_DIR, { recursive: true });

const captured: string[] = [];
const skipped: { name: string; reason: string }[] = [];

async function waitForServer(url: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server did not come up at ${url}`);
}

async function shoot(page: Page, name: string) {
  await page.waitForTimeout(500); // let animations settle
  // Consistent viewport-height crops (NOT full-page) so every image is the same
  // 1440×900 size and the manual reads uniform.
  await page.screenshot({ path: resolve(OUT_DIR, name), fullPage: false });
  if (!captured.includes(name)) captured.push(name);
  console.log(`  captured ${name}`);
}

function skip(name: string, reason: string) {
  if (!skipped.find((s) => s.name === name)) skipped.push({ name, reason });
  console.warn(`  SKIPPED ${name} — ${reason}`);
}

// Click the first visible AND enabled testid from a list of candidates.
// Many footers render the SAME testid for desktop AND mobile twins (one hidden
// via CSS), so a bare getByTestId is a 2-match strict-mode locator. We therefore
// scan each match and click the first that is actually visible + enabled.
async function clickFirstVisible(page: Page, ids: string[]): Promise<boolean> {
  for (const id of ids) {
    const loc = page.getByTestId(id);
    const count = await loc.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const el = loc.nth(i);
      if (
        (await el.isVisible().catch(() => false)) &&
        (await el.isEnabled().catch(() => false))
      ) {
        await el.scrollIntoViewIfNeeded().catch(() => {});
        const ok = await el.click({ timeout: 4000 }).then(() => true).catch(() => false);
        if (ok) return true;
      }
    }
  }
  return false;
}

async function fillIfVisible(page: Page, testid: string, value: string) {
  const el = page.getByTestId(testid);
  if (await el.isVisible().catch(() => false)) {
    await el.fill(value).catch(() => {});
  }
}

async function scrollIntoView(page: Page, testid: string) {
  await page.getByTestId(testid).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
}

async function home(page: Page) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.getByTestId("button-enter-app").click();
  await page.getByTestId("card-explore").waitFor({ state: "visible" });
}

// ───────────────────────── HOME ─────────────────────────
async function captureHome(page: Page) {
  console.log("HOME");
  try {
    await home(page);
    await shoot(page, "home-journey-selector.png");
  } catch (e) {
    skip("home-journey-selector.png", String(e));
  }
}

// Explore desktop/mobile twin continue buttons (incl. revenue's bespoke ids).
const EXPLORE_ADVANCE = [
  "button-continue", "button-continue-mobile", "button-panel-continue",
  "button-continue-revenue", "button-continue-revenue-mobile",
];

// ───────────────────────── EXPLORE (9 steps) ─────────────────────────
async function captureExplore(page: Page) {
  console.log("EXPLORE");
  try {
    await home(page);
    await page.getByTestId("card-explore").click();

    // 01 — care settings
    await page.getByTestId("card-setting-outpatient").waitFor({ state: "visible" });
    await shoot(page, "explore-01-care-settings.png");

    await page.getByTestId("card-setting-outpatient").click();
    await page.getByTestId("button-continue").click();
    await page.waitForTimeout(1100); // care-setting screen has ~800ms setup delay

    // 02 — opportunity / size
    await page.getByTestId("input-providers").waitFor({ state: "visible" });
    await page.getByTestId("input-providers").fill("50");
    await page.getByTestId("input-total-encounters").fill("150000");
    await page.getByTestId("input-utilization").fill("75");
    await page.waitForTimeout(500);
    await shoot(page, "explore-02-opportunity-size.png");
    await clickFirstVisible(page, EXPLORE_ADVANCE);
    await page.waitForTimeout(800);

    // 03 — time savings (pick "typical" so live panel + Continue enable)
    if (await page.getByTestId("button-scenario-typical").isVisible().catch(() => false)) {
      await page.getByTestId("button-scenario-typical").click();
      await page.waitForTimeout(500);
    }
    await shoot(page, "explore-03-time-savings.png");
    await clickFirstVisible(page, EXPLORE_ADVANCE);
    await page.waitForTimeout(800);

    // 04 — Capacity quadrant
    await shoot(page, "explore-04-capacity.png");
    await clickFirstVisible(page, ["button-scenario-typical"]);
    await clickFirstVisible(page, EXPLORE_ADVANCE);
    await page.waitForTimeout(800);

    // 05 — Workforce quadrant
    await shoot(page, "explore-05-workforce.png");
    await clickFirstVisible(page, ["button-scenario-typical"]);
    await clickFirstVisible(page, EXPLORE_ADVANCE);
    await page.waitForTimeout(800);

    // 06 — Revenue quadrant, with the wRVU driver toggled on + a preset (live calc)
    if (await page.getByTestId("toggle-wrvu").isVisible().catch(() => false)) {
      await page.getByTestId("toggle-wrvu").click();
      await page.waitForTimeout(500);
      await clickFirstVisible(page, ["button-cf-cms", "button-cf-commercial"]);
      await page.waitForTimeout(400);
      await scrollIntoView(page, "toggle-wrvu");
      await shoot(page, "explore-06-revenue.png");
    } else {
      // Not on revenue — capture whatever quadrant we're on, then log.
      await shoot(page, "explore-06-revenue.png");
      skip("explore-06-revenue.png", "toggle-wrvu not visible — shot may be wrong quadrant");
    }
    await clickFirstVisible(page, ["button-scenario-typical"]);
    await clickFirstVisible(page, EXPLORE_ADVANCE);
    await page.waitForTimeout(800);

    // 07 — Quality quadrant
    await shoot(page, "explore-07-quality.png");
    await clickFirstVisible(page, ["button-scenario-typical"]);
    await clickFirstVisible(page, EXPLORE_ADVANCE);
    await page.waitForTimeout(800);

    // 08 — Investment / expansion (has its own button-continue → model)
    // Confirm we're not already on the model.
    if (!(await page.getByTestId("button-add-proforma").isVisible().catch(() => false))) {
      await shoot(page, "explore-08-investment.png");
      await clickFirstVisible(page, EXPLORE_ADVANCE);
      await page.waitForTimeout(800);
    } else {
      skip("explore-08-investment.png", "investment page skipped (jumped to model)");
    }

    // 09 — Your Model rollup
    if (await page.getByTestId("button-add-proforma").isVisible().catch(() => false)) {
      await scrollIntoView(page, "text-net-value");
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(300);
      await shoot(page, "explore-09-your-model.png");
    } else {
      // Walk forward a few more times in case a gate held us up.
      for (let i = 0; i < 4; i++) {
        if (await page.getByTestId("button-add-proforma").isVisible().catch(() => false)) break;
        await clickFirstVisible(page, ["button-scenario-typical"]);
        if (!(await clickFirstVisible(page, EXPLORE_ADVANCE))) break;
        await page.waitForTimeout(700);
      }
      if (await page.getByTestId("button-add-proforma").isVisible().catch(() => false)) {
        await page.waitForTimeout(300);
        await shoot(page, "explore-09-your-model.png");
      } else {
        skip("explore-09-your-model.png", "never reached the Model (button-add-proforma)");
      }
    }
  } catch (e) {
    skip("explore-*", String(e));
  }
}

// ───────────────────────── MEASURE (7 steps) ─────────────────────────
// Order: setup → capacity → workforce → revenue → quality → output → forecast.
const MEASURE_ADVANCE = ["capacity", "workforce", "revenue", "quality", "forecast"].flatMap((q) => [
  `button-continue-measure-${q}`,
  `button-continue-measure-${q}-mobile`,
]);

async function addMeasureDriver(page: Page) {
  const addBtn = page.getByRole("button", { name: /Add a driver to track/i }).first();
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click().catch(() => {});
    const docTime = page.getByRole("button", { name: /Documentation Time per Note/i });
    if (await docTime.isVisible().catch(() => false)) {
      await docTime.click().catch(() => {});
      await page.waitForTimeout(500);
      const without = page.locator('[data-testid^="input-without-"]').first();
      const withh = page.locator('[data-testid^="input-with-"]').first();
      if (await without.isVisible().catch(() => false)) await without.fill("12").catch(() => {});
      if (await withh.isVisible().catch(() => false)) await withh.fill("8").catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

async function captureMeasure(page: Page) {
  console.log("MEASURE");
  try {
    await home(page);
    await page.getByTestId("card-forecast").click();
    await page.getByTestId("card-forecast-partner").click();
    await page.getByTestId("pills-care-settings").waitFor({ state: "visible" });

    // 01 — Partner Profile setup
    await page.getByTestId("input-org-name").fill("Northstar Health");
    await page.getByTestId("input-total-providers").fill("100");
    await page.getByTestId("input-live-providers").fill("80");
    await fillIfVisible(page, "input-encounters-outpatient", "200000");
    await page.waitForTimeout(500);
    await shoot(page, "measure-01-partner-profile.png");
    await page.getByTestId("button-next").click();
    await page.waitForTimeout(800);

    // 02 — Capacity (add a driver so the output isn't empty later)
    await addMeasureDriver(page);
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(300);
    await shoot(page, "measure-02-capacity.png");
    await clickFirstVisible(page, MEASURE_ADVANCE);
    await page.waitForTimeout(800);

    // 03 — Workforce
    await shoot(page, "measure-03-workforce.png");
    await clickFirstVisible(page, MEASURE_ADVANCE);
    await page.waitForTimeout(800);

    // 04 — Revenue
    await shoot(page, "measure-04-revenue.png");
    await clickFirstVisible(page, MEASURE_ADVANCE);
    await page.waitForTimeout(800);

    // 05 — Quality (its Continue → output)
    await shoot(page, "measure-05-quality.png");
    await clickFirstVisible(page, MEASURE_ADVANCE);
    await page.waitForTimeout(900);

    // 06 — Evidence Summary (output)
    if (await page.getByTestId("card-realized-today").isVisible().catch(() => false)) {
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(300);
      await shoot(page, "measure-06-evidence-summary.png");
    } else {
      // try a couple more advances
      for (let i = 0; i < 4; i++) {
        if (await page.getByTestId("card-realized-today").isVisible().catch(() => false)) break;
        if (!(await clickFirstVisible(page, MEASURE_ADVANCE))) break;
        await page.waitForTimeout(700);
      }
      if (await page.getByTestId("card-realized-today").isVisible().catch(() => false)) {
        await shoot(page, "measure-06-evidence-summary.png");
      } else {
        skip("measure-06-evidence-summary.png", "never reached Output (card-realized-today)");
      }
    }

    // 07 — Scale Forecast (output → onNext → forecast phase)
    // Output's primary CTA advances to the forecast/scale phase.
    const toForecast = page.getByRole("button", { name: /scale|forecast|project|full scale/i }).first();
    let onForecast = false;
    if (await toForecast.isVisible().catch(() => false)) {
      await toForecast.click().catch(() => {});
      await page.waitForTimeout(900);
      onForecast = true;
    }
    if (onForecast) {
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(300);
      await shoot(page, "measure-07-scale-forecast.png");
    } else {
      skip("measure-07-scale-forecast.png", "could not find Output CTA to the scale/forecast phase");
    }
  } catch (e) {
    skip("measure-*", String(e));
  }
}

// ───────────────────────── ASSESS ─────────────────────────
async function captureAssessPathSelection(page: Page) {
  console.log("ASSESS — path selection");
  try {
    await home(page);
    await page.getByTestId("card-switch").click();
    await page.getByTestId("button-path-ambient").waitFor({ state: "visible" });
    await shoot(page, "assess-00-path-selection.png");
  } catch (e) {
    skip("assess-00-path-selection.png", String(e));
  }
}

// Pick a Level on the ambient domain screen, confirm it, then advance.
async function ambientDomainAdvance(page: Page) {
  const lvl = page.locator("button").filter({ hasText: /^.{0,3}Level 2/ }).first();
  if (await lvl.isVisible().catch(() => false)) {
    await lvl.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  const confirm = page.getByRole("button", { name: /^Confirm/i }).first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  const cta = page.getByRole("button", { name: /Continue to/i }).first();
  if ((await cta.isVisible().catch(() => false)) && (await cta.isEnabled().catch(() => false))) {
    await cta.click().catch(() => {});
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

async function captureAssessAmbient(page: Page) {
  console.log("ASSESS — Ambient (8)");
  try {
    await home(page);
    await page.getByTestId("card-switch").click();
    await page.getByTestId("button-path-ambient").click();
    await page.waitForTimeout(800);

    // 01 — Organization
    const orgInput = page.locator('input[placeholder="your health system"]');
    if (await orgInput.isVisible().catch(() => false)) {
      await shoot(page, "assess-ambient-01-organization.png");
      await orgInput.fill("Northstar Health");
      await orgInput.press("Enter");
      await page.waitForTimeout(800);
    } else {
      skip("assess-ambient-01-organization.png", "organization input not visible");
    }

    // 02 — Tenure (auto-advances on select)
    if (await page.getByText(/how long/i).first().isVisible().catch(() => false)) {
      await shoot(page, "assess-ambient-02-tenure.png");
    } else {
      await shoot(page, "assess-ambient-02-tenure.png");
    }
    await page.getByRole("button").filter({ hasText: /year|month|less than|more than/i }).first().click().catch(() => {});
    await page.waitForTimeout(800);

    // 03 — Org type (auto-advances on select)
    await shoot(page, "assess-ambient-03-org-type.png");
    await page.getByRole("button").filter({ hasText: /academic|community|critical|integrated|specialty|health system|safety net/i }).first().click().catch(() => {});
    await page.waitForTimeout(800);

    // 04 — Scale (three progressive numeric questions)
    await page.waitForTimeout(300);
    for (const v of ["200", "160", "75"]) {
      const empties = page.locator("input:visible");
      const n = await empties.count();
      for (let i = 0; i < n; i++) {
        const f = empties.nth(i);
        if (!(await f.inputValue().catch(() => "x"))) {
          await f.fill(v).catch(() => {});
          break;
        }
      }
      await page.waitForTimeout(400);
    }
    await shoot(page, "assess-ambient-04-scale.png");
    const scaleCont = page.getByRole("button", { name: /Continue/i }).first();
    if ((await scaleCont.isVisible().catch(() => false)) && (await scaleCont.isEnabled().catch(() => false))) {
      await scaleCont.click();
      await page.waitForTimeout(900);
    }

    // Framework intro overlay — Skip it.
    const skipBtn = page.getByRole("button", { name: /Skip/i });
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(900);
    }

    // 05 — Four Domains (first domain screen)
    if (await page.getByTestId("text-domain-headline").isVisible().catch(() => false)) {
      await shoot(page, "assess-ambient-05-four-domains.png");
    } else {
      skip("assess-ambient-05-four-domains.png", "never reached Four Domains (text-domain-headline)");
    }

    // Walk the four domain screens → patient experience → score reveal → score → analysis.
    for (let i = 0; i < 20; i++) {
      if (await page.getByTestId("text-composite-score").isVisible().catch(() => false)) break;

      // Score-reveal overlay (full-screen, intercepts clicks).
      const overlay = page.locator('div.fixed.inset-0.z-\\[60\\]');
      if (await overlay.first().isVisible().catch(() => false)) {
        const seeScore = page.getByRole("button", { name: /See the Score/i });
        await seeScore.waitFor({ state: "visible", timeout: 6000 }).catch(() => {});
        if (await seeScore.isVisible().catch(() => false)) await seeScore.click().catch(() => {});
        else await overlay.first().click().catch(() => {});
        await page.waitForTimeout(900);
        continue;
      }

      // Domain screen.
      if (await page.getByTestId("text-domain-headline").isVisible().catch(() => false)) {
        if (await ambientDomainAdvance(page)) continue;
        break;
      }

      // Patient Experience screen (step 6).
      const px = page.getByText(/noticed/i).first();
      if (await px.isVisible().catch(() => false)) {
        // Capture PX before answering.
        if (!captured.includes("assess-ambient-06-patient-experience.png")) {
          await shoot(page, "assess-ambient-06-patient-experience.png");
        }
        const opt = page.getByRole("button").filter({ hasText: /Not yet|Some feedback|brought it up|part of how|noticed/i }).first();
        if (await opt.isVisible().catch(() => false)) {
          await opt.click().catch(() => {});
          await page.waitForTimeout(450);
        }
        const calc = page.getByRole("button", { name: /Calculate the Score/i }).first();
        if ((await calc.isVisible().catch(() => false)) && (await calc.isEnabled().catch(() => false))) {
          await calc.click();
          await page.waitForTimeout(900);
        }
        continue;
      }
      break;
    }
    if (!captured.includes("assess-ambient-06-patient-experience.png")) {
      skip("assess-ambient-06-patient-experience.png", "never reached Patient Experience screen");
    }

    // 07 — Score
    if (await page.getByTestId("text-composite-score").isVisible().catch(() => false)) {
      await scrollIntoView(page, "card-score-hero");
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(300);
      await shoot(page, "assess-ambient-07-score.png");

      // 08 — Domain Analysis (Score's primary CTA → step 8 / Screen5Gap)
      const next = page.getByRole("button", { name: /see the (gap|analysis)|domain analysis|where the value|continue|breakdown|see your/i }).first();
      let advanced = false;
      if (await next.isVisible().catch(() => false)) {
        await next.click().catch(() => {});
        await page.waitForTimeout(900);
        advanced = true;
      }
      if (advanced && (await page.getByTestId("button-export").isVisible().catch(() => false))) {
        await page.evaluate(() => window.scrollTo({ top: 0 }));
        await page.waitForTimeout(300);
        await shoot(page, "assess-ambient-08-domain-analysis.png");
      } else if (advanced) {
        await shoot(page, "assess-ambient-08-domain-analysis.png");
      } else {
        skip("assess-ambient-08-domain-analysis.png", "could not find Score CTA to Domain Analysis");
      }
    } else {
      skip("assess-ambient-07-score.png", "never reached the score (text-composite-score)");
      skip("assess-ambient-08-domain-analysis.png", "never reached the score");
    }
  } catch (e) {
    skip("assess-ambient-*", String(e));
  }
}

async function captureAssessScribes(page: Page) {
  console.log("ASSESS — Scribes (2)");
  try {
    await home(page);
    await page.getByTestId("card-switch").click();
    await page.getByTestId("button-path-scribes").click();

    // 01 — inputs
    await page.getByTestId("input-scribe-count").waitFor({ state: "visible" });
    await page.getByTestId("input-scribe-count").fill("10");
    await page.getByTestId("input-scribe-cost").fill("25");
    await page.getByTestId("input-providers-with-scribes").fill("40");
    await page.getByTestId("input-total-providers").fill("100");
    await page.getByTestId("input-scribe-hours").fill("36");
    await page.getByTestId("input-annual-encounters").fill("200000");
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(300);
    await shoot(page, "assess-scribes-01-inputs.png");

    // 02 — full analysis
    await page.getByTestId("button-see-full-analysis").click();
    await page.getByTestId("button-export-pdf-hero").waitFor({ state: "visible" });
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(400);
    await shoot(page, "assess-scribes-02-analysis.png");
  } catch (e) {
    skip("assess-scribes-*", String(e));
  }
}

async function captureAssessNursing(page: Page) {
  console.log("ASSESS — Nursing (6)");
  try {
    await home(page);
    await page.getByTestId("card-switch").click();
    await page.getByTestId("button-path-nursing").click();
    await page.getByTestId("text-nursing-program-headline").waitFor({ state: "visible" });

    // 01 — program
    await page.getByTestId("input-staffed-beds").fill("300");
    await page.getByTestId("input-nurse-ftes").fill("450");
    await page.waitForTimeout(500);
    await shoot(page, "assess-nursing-01-program.png");
    await clickFirstVisible(page, ["button-nursing-next-1"]);
    await page.waitForTimeout(700);

    // 02 — priorities (gates Next until a priority is picked)
    await shoot(page, "assess-nursing-02-priorities.png");
    const priority = page.locator('[data-testid^="priority-card-"]').first();
    if (await priority.isVisible().catch(() => false)) await priority.click().catch(() => {});
    await page.waitForTimeout(400);
    await clickFirstVisible(page, ["button-nursing-next-2"]);
    await page.waitForTimeout(700);

    // 03 — explore (fill a couple inputs so it renders with content)
    await fillIfVisible(page, "input-turnover-rate", "18");
    await fillIfVisible(page, "input-replacement-cost", "56000");
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(300);
    await shoot(page, "assess-nursing-03-explore.png");
    await clickFirstVisible(page, ["button-nursing-next-3"]);
    await page.waitForTimeout(700);

    // 04 — picture
    await shoot(page, "assess-nursing-04-picture.png");
    await clickFirstVisible(page, ["button-nursing-next-4"]);
    await page.waitForTimeout(700);

    // 05 — focus
    await shoot(page, "assess-nursing-05-focus.png");
    await clickFirstVisible(page, ["button-nursing-next-5"]);
    await page.waitForTimeout(700);

    // 06 — next steps
    if (await page.getByTestId("text-nursing-nextstep-headline").isVisible().catch(() => false)) {
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(300);
      await shoot(page, "assess-nursing-06-next-steps.png");
    } else {
      skip("assess-nursing-06-next-steps.png", "never reached Next Step (text-nursing-nextstep-headline)");
    }
  } catch (e) {
    skip("assess-nursing-*", String(e));
  }
}

// ───────────────────────── FORECAST ─────────────────────────
async function captureForecastModeAndDealDesk(page: Page) {
  console.log("FORECAST — mode + deal desk");
  try {
    await home(page);
    await page.getByTestId("card-forecast").click();
    await page.getByTestId("card-forecast-pricing").waitFor({ state: "visible" });

    // 01 — three-card mode selector
    await shoot(page, "forecast-01-mode-selector.png");

    // 02 — Compare Pricing deal desk
    await page.getByTestId("card-forecast-pricing").click();
    await page.getByTestId("input-org-providers").waitFor({ state: "visible" });
    await page.getByTestId("input-org-providers").fill("50");
    await page.getByTestId("input-deal-price-0").fill("120");
    await page.getByTestId("input-deal-price-1").fill("150");
    await page.getByTestId("pricing-scoreboard").waitFor({ state: "visible" });
    await page.waitForTimeout(700);
    await shoot(page, "forecast-02-deal-desk.png");
  } catch (e) {
    skip("forecast-mode/deal-desk", String(e));
  }
}

// Proforma: build one Explore setting, add it, open hub, view, present.
async function captureForecastProforma(page: Page) {
  console.log("FORECAST — proforma");
  try {
    await home(page);
    await page.getByTestId("card-explore").click();
    await page.getByTestId("card-setting-outpatient").click();
    await page.getByTestId("button-continue").click();
    await page.waitForTimeout(1100);

    await page.getByTestId("input-providers").fill("50");
    await page.getByTestId("input-total-encounters").fill("150000");
    await page.getByTestId("input-utilization").fill("75");
    await clickFirstVisible(page, EXPLORE_ADVANCE);
    await page.waitForTimeout(800);

    // Walk to the Model, toggling wRVU on for real value.
    let toggled = false;
    for (let i = 0; i < 12; i++) {
      if (await page.getByTestId("button-add-proforma").isVisible().catch(() => false)) break;
      if (!toggled && (await page.getByTestId("toggle-wrvu").isVisible().catch(() => false))) {
        await page.getByTestId("toggle-wrvu").click().catch(() => {});
        toggled = true;
        await page.waitForTimeout(300);
      }
      await clickFirstVisible(page, ["button-scenario-typical"]);
      if (!(await clickFirstVisible(page, EXPLORE_ADVANCE))) break;
      await page.waitForTimeout(700);
    }

    if (!(await page.getByTestId("button-add-proforma").isVisible().catch(() => false))) {
      skip("forecast-proforma-01-hub.png", "never reached Explore Model to add to proforma");
      skip("forecast-proforma-02-view.png", "never reached Explore Model to add to proforma");
      skip("forecast-proforma-03-present.png", "never reached Explore Model to add to proforma");
      return;
    }

    // Add to proforma → hub.
    await page.getByTestId("button-add-proforma").click();
    await page.getByTestId("button-present").waitFor({ state: "visible" });
    await page.waitForTimeout(700);

    // 01 — hub (top: summary bar + setting cards)
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(300);
    await shoot(page, "forecast-proforma-01-hub.png");

    // 02 — embedded ProformaView (rendered below the hub once ≥1 setting exists)
    const view = page.getByTestId("proforma-summary-bar");
    // The ProformaView is the lower, dark business-case section; scroll well down.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.6 }));
    await page.waitForTimeout(500);
    await shoot(page, "forecast-proforma-02-view.png");
    void view;

    // 03 — Present overlay
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(300);
    await page.getByTestId("button-present").click();
    await page.getByTestId("proforma-present").waitFor({ state: "visible" });
    await page.waitForTimeout(800);
    await shoot(page, "forecast-proforma-03-present.png");
  } catch (e) {
    skip("forecast-proforma-*", String(e));
  }
}

// Standalone Forecast flow at /forecast — start → baseline → contract → dashboard.
async function captureForecastFlow(page: Page) {
  console.log("FORECAST — standalone flow (/forecast)");
  try {
    await page.goto(BASE + "/forecast", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Detect whether the SPA route resolved (vs a static 404 / journey fallback).
    const onForecast =
      (await page.getByTestId("card-forecast-import-hero").isVisible().catch(() => false)) ||
      (await page.getByText(/forecast/i).first().isVisible().catch(() => false));
    if (!onForecast) {
      skip("forecast-flow-01-start.png", "static server did not resolve the /forecast SPA route");
      skip("forecast-flow-02-baseline.png", "static server did not resolve the /forecast SPA route");
      skip("forecast-flow-03-contract.png", "static server did not resolve the /forecast SPA route");
      skip("forecast-flow-04-dashboard.png", "static server did not resolve the /forecast SPA route");
      return;
    }

    // 01 — Start
    await shoot(page, "forecast-flow-01-start.png");

    // Start from scratch → Baseline.
    await clickFirstVisible(page, ["card-forecast-scratch"]);
    await page.waitForTimeout(900);

    // 02 — Baseline
    if (await page.getByTestId("section-baseline").isVisible().catch(() => false) ||
        await page.getByTestId("section-care-settings").isVisible().catch(() => false)) {
      await fillIfVisible(page, "input-forecast-active-users", "80");
      await fillIfVisible(page, "input-forecast-provisioned-seats", "100");
      await fillIfVisible(page, "input-forecast-abridge-encounters", "150000");
      await fillIfVisible(page, "input-forecast-total-encounters", "200000");
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(300);
      await shoot(page, "forecast-flow-02-baseline.png");

      // Continue to Contract (gated on activeUsersToday>0 && abridgeEncountersLTM>0).
      await clickFirstVisible(page, ["btn-baseline-continue"]);
      await page.waitForTimeout(900);
    } else {
      skip("forecast-flow-02-baseline.png", "Baseline section not reached from Start");
    }

    // 03 — Contract
    if (await page.getByTestId("section-contract-terms").isVisible().catch(() => false)) {
      await clickFirstVisible(page, ["btn-term-3", "btn-term-1"]);
      // Continue is gated on a unit price > 0.
      await fillIfVisible(page, "input-unit-price", "300");
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(300);
      await shoot(page, "forecast-flow-03-contract.png");

      // Continue → dashboard/results (gated; btn-contract-continue).
      await clickFirstVisible(page, ["btn-contract-continue"]);
      await page.waitForTimeout(1000);
    } else {
      skip("forecast-flow-03-contract.png", "Contract section not reached from Baseline");
    }

    // 04 — Dashboard (results)
    if (await page.getByTestId("section-hero-roi").isVisible().catch(() => false) ||
        await page.getByTestId("text-dashboard-title").isVisible().catch(() => false)) {
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(400);
      await shoot(page, "forecast-flow-04-dashboard.png");
    } else {
      skip("forecast-flow-04-dashboard.png", "Dashboard/results not reached from Contract");
    }
  } catch (e) {
    skip("forecast-flow-*", String(e));
  }
}

// ───────────────────────── VALUE STORY (methodology) ─────────────────────────
async function captureValueStory(page: Page) {
  console.log("VALUE STORY");
  try {
    await home(page);
    await page.getByTestId("link-learn").click();
    await page.waitForTimeout(800);

    // 01 — Framework
    await shoot(page, "value-story-01-framework.png");

    const settings: Array<[string, string]> = [
      ["outpatient", "value-story-02-outpatient.png"],
      ["ed", "value-story-03-ed.png"],
      ["inpatient", "value-story-04-inpatient.png"],
      ["nursing", "value-story-05-nursing.png"],
    ];
    for (const [id, file] of settings) {
      // Each care-setting page is opened from the framework via button-setting-{id};
      // the back action returns to the framework.
      if (await page.getByTestId(`button-setting-${id}`).isVisible().catch(() => false)) {
        await page.getByTestId(`button-setting-${id}`).click();
        await page.waitForTimeout(800);
        await page.evaluate(() => window.scrollTo({ top: 0 }));
        await page.waitForTimeout(300);
        await shoot(page, file);
        // Return to framework for the next one.
        const back = page.getByTestId("button-back");
        if (await back.isVisible().catch(() => false)) {
          await back.click().catch(() => {});
          await page.waitForTimeout(700);
        } else {
          // fall back: re-enter from home
          await home(page);
          await page.getByTestId("link-learn").click();
          await page.waitForTimeout(700);
        }
      } else {
        skip(file, `button-setting-${id} not visible on framework`);
      }
    }
  } catch (e) {
    skip("value-story-*", String(e));
  }
}

async function main() {
  console.log(`Serving built client from dist/public on ${BASE} …`);
  const server: ChildProcess = spawn(
    "node",
    [resolve(ROOT, "e2e", "static-server.cjs"), String(PORT)],
    { stdio: "inherit" },
  );

  let browser: Browser | undefined;
  try {
    await waitForServer(BASE + "/");
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.warn("  [pageerror]", String(e)));

    await captureHome(page);
    await captureExplore(page);
    await captureMeasure(page);
    await captureAssessPathSelection(page);
    await captureAssessAmbient(page);
    await captureAssessScribes(page);
    await captureAssessNursing(page);
    await captureForecastModeAndDealDesk(page);
    await captureForecastProforma(page);
    await captureForecastFlow(page);
    await captureValueStory(page);
  } finally {
    await browser?.close().catch(() => {});
    server.kill();
  }

  console.log("\n──────────── SUMMARY ────────────");
  console.log(`Captured (${captured.length}):`);
  captured.forEach((c) => console.log("  " + c));
  if (skipped.length) {
    console.log(`\nSkipped (${skipped.length}):`);
    skipped.forEach((s) => console.log(`  ${s.name} — ${s.reason}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
