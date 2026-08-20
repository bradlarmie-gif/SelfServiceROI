import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
await page.goto("http://localhost:5199/?inpatientmock=1&step=workforce", { waitUntil: "networkidle" });

// Toggle Provider Retention (first switch) and Incremental Staffing (second switch)
const toggles = page.locator("button[aria-pressed]");
const count = await toggles.count();
console.log("toggle count", count);
await toggles.nth(0).click();
await toggles.nth(1).click();
await page.waitForTimeout(300);

await page.screenshot({ path: "/private/tmp/claude-501/-Users-brad/926eabfa-9fc7-4c7d-afc2-bd8edd5da9d9/scratchpad/v2-workforce-on.png", fullPage: true });

// Also click the lens toggle to tracked mode if present, to check retention "tracked" text
const lensBtn = page.locator('[data-testid="ed-retention-lens-providerWellbeing"] button, [data-testid^="ed-retention-lens"]');
console.log("lens count", await lensBtn.count());

await browser.close();
