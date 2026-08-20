import { test, expect, type Page } from "@playwright/test";

/**
 * The whole application, end to end.
 *
 * One path: the landing screen hands off to the ROI Calculator, which walks
 * care setting → the practice's numbers → what changed → the answer, and
 * exports the one-pager. Run on desktop and mobile; the download is asserted
 * desktop-only (mobile opens the print view in a new tab instead).
 */

const VIEWPORTS = [
  { name: "Desktop", width: 1280, height: 800, canDownload: true },
  { name: "iPhone 12", width: 390, height: 844, canDownload: false },
];

async function expectNoHorizontalOverflow(page: Page, where: string) {
  const { scrollW, clientW } = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  expect(scrollW, `${where}: overflows — scrollWidth ${scrollW} > viewport ${clientW}`).toBeLessThanOrEqual(clientW + 1);
}

/** Enter the practice (ROI) path: the flow now forks on who is asking. */
async function enterCalculator(page: Page) {
  await page.goto("/");
  await page.getByTestId("button-enter-app").click();
  await page.getByTestId("audience-practice").click();
  await expect(page.getByText("Outpatient", { exact: true })).toBeVisible();
}

/**
 * Pick every goal the setting offers, answer the revenue follow-up if this
 * setting has one, then move on to the numbers step.
 */
async function pickAllGoals(page: Page, payer: "ffs" | "vbc" | "both" = "both") {
  const cards = page.locator("[data-testid^=goal-]");
  const n = await cards.count();
  expect(n, "the goals step offered nothing to pick").toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await cards.nth(i).click();
  const payerBtn = page.getByTestId(`payer-${payer}`);
  if (await payerBtn.count()) await payerBtn.click();
  await page.getByRole("button", { name: /next: your numbers/i }).click();
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("landing screen leads into the fork, then the calculator", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByTestId("button-enter-app")).toBeVisible();
      await expectNoHorizontalOverflow(page, "landing");
      await page.getByTestId("button-enter-app").click();
      // who is asking decides which walk they get
      await expect(page.getByTestId("audience-me")).toBeVisible();
      await expect(page.getByTestId("audience-practice")).toBeVisible();
      await expectNoHorizontalOverflow(page, "audience fork");
      await page.getByTestId("audience-practice").click();
      await expect(page.getByText("Outpatient", { exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page, "care setting");
    });

    /**
     * The individual was told to use Abridge by someone else. A return multiple
     * is not their question, and putting one in front of them is where the tool
     * would start selling at them.
     */
    test("the individual walk never shows a price or a return", async ({ page }) => {
      await page.goto("/");
      await page.getByTestId("button-enter-app").click();
      await page.getByTestId("audience-me").click();
      await page.getByText("Outpatient", { exact: true }).first().click();

      const q = page.locator("input");
      await expect(q, "the individual walk should ask three things, not five").toHaveCount(3);
      await q.nth(0).fill("3000");
      await q.nth(1).fill("7");
      await q.nth(2).fill("4");
      await page.getByRole("button", { name: /see what i get back/i }).click();

      await expect(page.getByText(/hours a year/)).toBeVisible();
      await expect(page.getByText(/back on a working day/)).toBeVisible();
      const body = await page.locator("body").innerText();
      expect(body, "the individual walk must not price or sell").not.toMatch(/×|what Abridge costs you|left over each year|not yet counted/);
      expect(body, "no dollar figure belongs on this screen").not.toMatch(/\$[\d]/);
    });

    test("every care setting offers its own goals, and cannot be skipped", async ({ page }) => {
      for (const setting of ["Outpatient", "Emergency", "Inpatient", "Nursing"]) {
        await enterCalculator(page);
        await page.getByText(setting, { exact: true }).first().click();
        // the goals step gates the flow: nothing picked, nothing to continue to
        const next = page.getByRole("button", { name: /next: your numbers/i });
        await expect(next, `${setting}: continue should be disabled with no goal picked`).toBeDisabled();
        await expect(page.locator("[data-testid^=goal-]").first()).toBeVisible();
        await expectNoHorizontalOverflow(page, `${setting} goals step`);
        await pickAllGoals(page);
        await expect(page.locator("h1")).toBeVisible();
        await expectNoHorizontalOverflow(page, `${setting} account step`);
      }
    });

    test("what changes only shows the goals that were picked", async ({ page }) => {
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      // pick Revenue only
      await page.getByTestId("goal-revenue").click();
      await page.getByTestId("payer-both").click();
      await page.getByRole("button", { name: /next: your numbers/i }).click();

      const inputs = page.locator("input");
      const vals = ["Riverbend Family Medicine", "42", "30", "2400", "68"];
      for (let i = 0; i < vals.length; i++) await inputs.nth(i).fill(vals[i]);
      await page.getByRole("button", { name: /next: what changes/i }).click();

      await expect(page.getByRole("button", { name: /^Revenue/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Workforce/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Capacity/ })).toHaveCount(0);
    });

    test("cannot roll out to more clinicians than the practice has", async ({ page }) => {
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await pickAllGoals(page);

      const inputs = page.locator("input");
      const total = inputs.nth(1);
      const using = inputs.nth(2);

      // typing past the headcount is capped as you type
      await total.fill("40");
      await using.fill("200");
      await expect(using, "the subset should cap at the headcount while typing").toHaveValue("40");

      // and lowering the headcount afterwards pulls the subset down with it,
      // otherwise adoption reads over 100%
      await using.fill("40");
      await total.fill("12");
      await page.locator("body").click();
      await expect(using, "lowering the headcount should pull the subset down").toHaveValue("12");
    });

    // Split per payer model on purpose: one test doing two full walks was the
    // longest in the suite and intermittently tripped the 45s timeout under
    // load. Two short tests also say which half broke.
    async function revenueOnly(page: Page, payer: "ffs" | "vbc") {
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await page.getByTestId("goal-revenue").click();
      await expect(
        page.getByRole("button", { name: /next: your numbers/i }),
        "revenue picked but no payer answer should keep the flow gated",
      ).toBeDisabled();
      await page.getByTestId(`payer-${payer}`).click();
      await page.getByRole("button", { name: /next: your numbers/i }).click();
      const inputs = page.locator("input");
      const vals = ["Riverbend", "42", "30", "2400", "68"];
      for (let i = 0; i < vals.length; i++) await inputs.nth(i).fill(vals[i]);
      await page.getByRole("button", { name: /next: what changes/i }).click();
    }

    test("fee for service shows coding, not risk capture", async ({ page }) => {
      await revenueOnly(page, "ffs");
      await expect(page.getByText("Coding accuracy")).toBeVisible();
      await expect(page.getByText("Risk capture (HCC)")).toHaveCount(0);
    });

    test("value based shows risk capture, not coding", async ({ page }) => {
      await revenueOnly(page, "vbc");
      await expect(page.getByText("Risk capture (HCC)")).toBeVisible();
      await expect(page.getByText("Coding accuracy")).toHaveCount(0);
    });

    /**
     * Typed one character at a time, the way a person does. `fill()` cannot
     * catch this class: the bug was a deferred select-on-focus landing AFTER
     * the first keystroke, selecting it so the second keystroke replaced it.
     * Every numeric field silently ate its first character ("42" became "2")
     * and focus never moved, so nothing looked wrong on screen.
     */
    test("typing a number keeps every character", async ({ page }) => {
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await pickAllGoals(page);

      const typed: [number, string, string][] = [
        [1, "42", "42"],
        [2, "30", "30"],
        [3, "2400", "2,400"],
        [4, "68", "68"],
      ];
      for (const [idx, keys, expected] of typed) {
        const field = page.locator("input").nth(idx);
        await field.click();
        await page.keyboard.type(keys, { delay: 25 });
        await expect(field, `typing "${keys}" should leave "${expected}"`).toHaveValue(expected);
      }

      await expect(
        page.getByRole("button", { name: /next: what changes/i }),
        "all four numbers are in, so the step should be complete",
      ).toBeEnabled();
    });

    /**
     * The tab counter and the card list are two views of the same set. They
     * used to filter independently, so the payer answer hid the risk-capture
     * card while the tab still counted it: "3 to switch on" above two cards.
     */
    test("the tab count matches the cards actually shown", async ({ page }) => {
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await page.getByTestId("goal-revenue").click();
      await page.getByTestId("payer-ffs").click();   // hides risk capture
      await page.getByRole("button", { name: /next: your numbers/i }).click();
      const inputs = page.locator("input");
      for (const [i, v] of [["Riverbend"], ["60"], ["49"], ["2400"], ["68"]].entries()) {
        await inputs.nth(i).fill(v[0]);
      }
      await page.getByRole("button", { name: /next: what changes/i }).click();

      const tab = page.getByRole("button", { name: /^Revenue/ });
      const label = (await tab.innerText()).trim();
      const claimed = Number(label.match(/(\d+) to switch on/)?.[1] ?? -1);
      const shown = await page.locator('button[role="switch"]').count();
      expect(claimed, `tab says "${label}" but ${shown} cards are on screen`).toBe(shown);
    });

    test("only one Back on a step, in the header", async ({ page }) => {
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await pickAllGoals(page);
      await expect(
        page.getByRole("button", { name: /^Back$/ }),
        "the header owns Back; a second one at the bottom of the step is duplication",
      ).toHaveCount(1);
    });

    /**
     * A solo practice is a different shape, not a smaller one. Retention and
     * locum cover model replacing a clinician who leaves; a solo doctor cannot
     * backfill themselves, and offering those levers is the moment they can
     * tell the tool was not built for them. It was also counting them.
     */
    test("a solo practice is not offered team-scale levers", async ({ page }) => {
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await pickAllGoals(page, "ffs");

      const inputs = page.locator("input");
      await inputs.nth(0).fill("Dr Ellis");
      await inputs.nth(1).fill("1");
      // the "how many of them would use Abridge" row answers itself at n=1
      await expect(inputs, "the solo step should not ask a question with one answer").toHaveCount(4);
      await inputs.nth(2).fill("3200");
      await inputs.nth(3).fill("80");
      await page.getByRole("button", { name: /next: what changes/i }).click();

      await page.getByRole("button", { name: /^Workforce/ }).click();
      await expect(page.getByText("Retention (burnout)")).toHaveCount(0);
      await expect(page.getByText("Locum / agency avoided")).toHaveCount(0);
      // the one workforce lever a solo doctor really has
      await expect(page.getByText("Scribe cost reduction")).toBeVisible();
    });

    test("a solo practice is led by time, a group by money", async ({ page }) => {
      // solo, with a before and after entered: hours lead
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await pickAllGoals(page, "ffs");
      const solo = page.locator("input");
      await solo.nth(0).fill("Dr Ellis");
      await solo.nth(1).fill("1");
      await solo.nth(2).fill("3200");
      await solo.nth(3).fill("80");
      await page.getByRole("button", { name: /next: what changes/i }).click();
      // Capacity leads for a solo reader, and holds the before/after minutes
      await page.getByRole("button", { name: /^Capacity/ }).click();
      const mins = page.locator("input");
      await mins.nth(0).fill("7");
      await mins.nth(1).fill("4");
      // confirm the hours actually landed before advancing, or this test is
      // asserting against a screen that never got the numbers
      await expect(page.getByText(/clinician hours a year/)).toBeVisible();
      await page.getByRole("button", { name: /see my number/i }).click();

      await expect(page.getByText(/could give back/)).toBeVisible();
      await expect(page.getByText(/hours a year/)).toBeVisible();
      await expect(page.getByText(/back on a working day/)).toBeVisible();

      // a group with the same shape still leads with the money
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await pickAllGoals(page, "ffs");
      const grp = page.locator("input");
      await grp.nth(0).fill("Riverbend");
      await grp.nth(1).fill("40");
      await grp.nth(2).fill("30");
      await grp.nth(3).fill("3200");
      await grp.nth(4).fill("80");
      await page.getByRole("button", { name: /next: what changes/i }).click();
      // switch something on, or the group correctly lands on the empty state
      await page.locator('button[role="switch"]').first().click();
      await page.getByRole("button", { name: /see my number/i }).click();
      await expect(page.getByText(/could be worth/)).toBeVisible();
      await expect(page.getByText(/could give back/)).toHaveCount(0);
    });

    /**
     * The price field used to sit inside a `priced ? (...) : (...)` ternary, so
     * the FIRST digit flipped the branch, React unmounted the input, focus went
     * to the body and the rest of the number was dropped. A price of "2"
     * against $396K printed a 76,953x return. An input must never be unmounted
     * by the state it drives, and only typing catches it.
     */
    test("typing a price keeps every digit and stays focused", async ({ page }) => {
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await pickAllGoals(page, "ffs");
      const acct = page.locator("input");
      for (const [i, v] of [["Riverbend"], ["40"], ["30"], ["3200"], ["80"]].entries()) {
        await acct.nth(i).fill(v[0]);
      }
      await page.getByRole("button", { name: /next: what changes/i }).click();
      await page.locator('button[role="switch"]').first().click();
      await page.getByRole("button", { name: /see my number/i }).click();

      const price = page.locator('input[placeholder="a year, all in"]');
      await price.click();
      await page.keyboard.type("250000", { delay: 25 });
      await expect(price, "the price field dropped characters").toHaveValue("250,000");
      await expect(price, "focus left the price field while typing").toBeFocused();
      // and the multiple must be sane, not the 76,953x a one-digit price gave
      const body = await page.locator("body").innerText();
      const multiple = Number(body.match(/([\d.]+)×/)?.[1] ?? -1);
      expect(multiple, "return multiple is not believable").toBeLessThan(50);
    });

    test("a full run produces a dollar answer", async ({ page }) => {
      await enterCalculator(page);
      await page.getByText("Outpatient", { exact: true }).first().click();
      await pickAllGoals(page);

      const inputs = page.locator("input");
      const vals = ["Riverbend Family Medicine", "42", "30", "2400", "68"];
      for (let i = 0; i < vals.length; i++) await inputs.nth(i).fill(vals[i]);

      await page.getByRole("button", { name: /next: what changes/i }).click();

      const toggles = page.locator('button[role="switch"], input[type="checkbox"]');
      const n = Math.min(3, await toggles.count());
      for (let i = 0; i < n; i++) await toggles.nth(i).click();

      await page.getByRole("button", { name: /see my number/i }).click();

      // the headline number must be real money, not $0 and not NaN
      const body = await page.locator("body").innerText();
      expect(body, "the answer step shows no dollar figure").toMatch(/\$[\d.,]+[KM]?/);
      expect(body).not.toContain("NaN");
      await expectNoHorizontalOverflow(page, "answer step");
    });
  });
}
