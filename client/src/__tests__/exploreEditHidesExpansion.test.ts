import { describe, it, expect } from "vitest";
import { resolveExplorePhase } from "@/pages/explore/exploreState";

/**
 * Guardrail: when editing an existing proforma setting, the Explore "expansion"
 * (investment) page must NEVER come up — not via Next, not via a breadcrumb
 * step, and not via browser back/forward. Every setPhase path in ExploreFlow
 * (initial phase, navigate, popstate) funnels through resolveExplorePhase, so
 * proving this one function hides 'investment' while editing proves the page
 * can't surface from any of those paths.
 */
describe("Explore expansion page is hidden while editing a proforma setting", () => {
  it("redirects 'investment' to 'model' when editing", () => {
    expect(resolveExplorePhase("investment", true)).toBe("model");
  });

  it("still shows 'investment' when NOT editing (adding a new setting)", () => {
    expect(resolveExplorePhase("investment", false)).toBe("investment");
  });

  it("leaves every other phase untouched while editing", () => {
    for (const p of ["careSetting", "practice", "timeSavings", "capacity", "workforce", "revenue", "quality", "model"]) {
      expect(resolveExplorePhase(p, true)).toBe(p);
    }
  });

  it("still applies the legacy alias map (both modes)", () => {
    expect(resolveExplorePhase("valueDrivers", true)).toBe("capacity");
    expect(resolveExplorePhase("valueDrivers", false)).toBe("capacity");
    expect(resolveExplorePhase("docQuality", true)).toBe("revenue");
    expect(resolveExplorePhase("careQuality", true)).toBe("quality");
  });
});
