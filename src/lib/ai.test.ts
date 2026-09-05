import { describe, expect, it } from "vitest";
import { buildBoundedPlan, fallbackBuyerIntent, normalizeCatalogTaxonomy, rankCatalog } from "./ai";
import { products } from "./catalog";

describe("buyer and growth planning", () => {
  it("extracts Indian rupee budgets and recurring intent without a model", () => {
    const intent = fallbackBuyerIntent("Buy my usual coffee every month but never above ₹900.");
    expect(intent.budgetPaise).toBe(90000);
    expect(intent.recurring).toBe(true);
    expect(intent.categories).toContain("pantry");
  });

  it("resolves only authoritative product IDs", () => {
    const intent = fallbackBuyerIntent("Find me a running setup under ₹5,000.");
    const ranked = rankCatalog(intent, products);
    expect(ranked[0]?.id).toBe("p_runner");
    expect(ranked.every(product => products.some(source => source.id === product.id))).toBe(true);
  });

  it("keeps growth proposals within the hard budget", () => {
    const intent = fallbackBuyerIntent("I need a skincare routine for sensitive skin under ₹2,000. Avoid fragrance.");
    const plan = buildBoundedPlan(intent, products, { provider: "deterministic-fallback", model: "test", latencyMs: 0, usage: null, safeFallback: true });
    expect(plan.items.some(item => item.role === "growth_proposal")).toBe(true);
    expect(plan.proposedTotalPaise).toBeLessThanOrEqual(intent.budgetPaise);
    expect(plan.items.every(item => products.some(source => source.id === item.id))).toBe(true);
  });

  it("does not force an upsell when none fits", () => {
    const intent = fallbackBuyerIntent("Buy my usual coffee every month but never above ₹700.");
    const plan = buildBoundedPlan(intent, products, { provider: "deterministic-fallback", model: "test", latencyMs: 0, usage: null, safeFallback: true });
    expect(plan.proposedTotalPaise).toBeLessThanOrEqual(70000);
    expect(plan.growthAmountPaise).toBe(0);
  });

  it("normalizes model taxonomy to canonical merchant categories", () => {
    const raw = { ...fallbackBuyerIntent("Find a USB-C charger setup under ₹2,500."), categories: ["technology accessories"] };
    const normalized = normalizeCatalogTaxonomy(raw, "Find a USB-C charger setup", products);
    const plan = buildBoundedPlan(normalized, products, { provider: "deterministic-fallback", model: "test", latencyMs: 0, usage: null, safeFallback: true });
    expect(normalized.categories).toContain("electronics");
    expect(plan.items.map(item => item.id)).toEqual(["p_charger", "p_cable"]);
  });
});
