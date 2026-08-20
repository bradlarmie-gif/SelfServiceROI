/**
 * SINGLE SOURCE OF TRUTH for the value of one recaptured HCC, by payer program.
 *
 * A recaptured HCC is worth very different money depending on who pays, so a
 * single hardcoded $/HCC is wrong for most partners:
 *   - Medicare Advantage — an incremental RAF point × a ~$12-14k benchmark; pays the most.
 *   - ACA / marketplace (HHS-HCC) — a budget-neutral risk-adjustment TRANSFER; lower,
 *     and only helps when you are below the market-average risk score.
 *   - Medicaid MCO — state capitation risk adjustment; the lowest per condition.
 *   - Custom / none selected — a conservative generic middle.
 *
 * Every surface that models HCC (the Value Model / Explore driver, the classic
 * HCC calculator, Quick ROI, and every PDF) reads these constants so the per-HCC
 * dollar can never fork across the app again. Change a number here, it moves
 * everywhere. Values are conservative starting anchors and stay editable in the tool.
 *
 * Keep this union in sync with `HccPlan['planType']` in `pages/explore/exploreState.ts`.
 */
export type HccPayerType = "medicare_advantage" | "aca_marketplace" | "medicaid_mco" | "custom";

/** Conservative $/HCC anchor per payer program. Editable in the tool; this is the seed. */
export const HCC_VALUE_BY_PAYER: Record<HccPayerType, number> = {
  medicare_advantage: 1500,
  aca_marketplace: 1000,
  medicaid_mco: 400,
  custom: 1000,
};

/** The generic $/HCC used when no specific payer is chosen. */
export const HCC_VALUE_GENERIC = HCC_VALUE_BY_PAYER.custom;

/** Full label for a payer program (used in selectors and PDF copy). */
export const HCC_PAYER_LABEL: Record<HccPayerType, string> = {
  medicare_advantage: "Medicare Advantage",
  aca_marketplace: "ACA / Exchange",
  medicaid_mco: "Medicaid managed care",
  custom: "Custom plan",
};

/** Short tag (MA / ACA / MCO) for compact chips. */
export const HCC_PAYER_SHORT: Record<HccPayerType, string> = {
  medicare_advantage: "MA",
  aca_marketplace: "ACA",
  medicaid_mco: "MCO",
  custom: "Custom",
};

/** Ordered [value, label] pairs for building a payer <select>. */
export const HCC_PAYER_OPTIONS: [HccPayerType, string][] = [
  ["medicare_advantage", HCC_PAYER_LABEL.medicare_advantage],
  ["aca_marketplace", HCC_PAYER_LABEL.aca_marketplace],
  ["medicaid_mco", HCC_PAYER_LABEL.medicaid_mco],
  ["custom", HCC_PAYER_LABEL.custom],
];

/** The default $/HCC for a payer type, falling back to the generic anchor. */
export function hccValueFor(planType: HccPayerType | string | undefined): number {
  if (planType && planType in HCC_VALUE_BY_PAYER) return HCC_VALUE_BY_PAYER[planType as HccPayerType];
  return HCC_VALUE_GENERIC;
}
