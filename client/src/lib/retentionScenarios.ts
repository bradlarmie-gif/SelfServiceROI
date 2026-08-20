// Single source of truth for the wellbeing / retention scenarios: Abridge's
// estimated impact on burnout-related turnover, as conservative / typical /
// optimistic shares. Physician (Outpatient / ED / Inpatient provider wellbeing)
// and nursing are kept as SEPARATE named sets even when equal, so one can move
// without the other. Every screen (Explore driver cards + engine) and the
// proforma reads from here so the number can never drift between them again.
//
// The only thing that still hardcodes these numbers is the qualitative tooltip
// prose in the driver cards ("Conservative (20%): ..."), which cannot be
// templated cleanly. Update that copy by hand if these change.

export type RetentionScenarioKey = "conservative" | "typical" | "optimistic" | "custom";

export const PHYSICIAN_RETENTION_SCENARIOS = { conservative: 20, typical: 30, optimistic: 40 } as const;
export const NURSING_RETENTION_SCENARIOS = { conservative: 20, typical: 30, optimistic: 40 } as const;

/** Rates keyed by scenario, with the caller's custom % filled in (default 10). */
export const physicianRetentionRates = (customPct = 10): Record<string, number> =>
  ({ ...PHYSICIAN_RETENTION_SCENARIOS, custom: customPct });
export const nursingRetentionRates = (customPct = 10): Record<string, number> =>
  ({ ...NURSING_RETENTION_SCENARIOS, custom: customPct });
