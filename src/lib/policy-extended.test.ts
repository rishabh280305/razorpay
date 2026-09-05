import { describe, expect, it } from "vitest";
import { runPriceDriftScenario } from "./chaos";
import { products } from "./catalog";
import { canonicalMandateHash } from "./mandate";
import { evaluatePolicyWithCatalog } from "./policy";
import type { Mandate } from "./types";

const payload = { id: "mandate_extended", merchantId: "m_demo", maxAmountPaise: 500000, categories: ["running"], maxQuantity: 5, expiresAt: "2030-01-01T00:00:00.000Z", recurringAllowed: false, approvalThresholdPaise: 100000 };
const mandate: Mandate = { ...payload, canonicalHash: canonicalMandateHash(payload) };

describe("extended deterministic policy", () => {
  it("canonicalizes category order for stable mandate hashes", () => {
    const one = canonicalMandateHash({ ...payload, categories: ["running", "skincare"] });
    const two = canonicalMandateHash({ ...payload, categories: ["skincare", "running"] });
    expect(one).toBe(two);
  });

  it("blocks mismatched agent identity and exhausted attempts", () => {
    const result = evaluatePolicyWithCatalog({ items: [{ productId: "p_runner", quantity: 1 }], mandate, catalog: products, controls: { expectedAgentIdentity: "buyer-agent-7", actualAgentIdentity: "unknown-agent", automatedAttempts: 2 } });
    expect(result.decision).toBe("DENY");
    expect(result.reasonCodes).toContain("AGENT_IDENTITY_MISMATCH");
    expect(result.reasonCodes).toContain("ATTEMPT_LIMIT_EXCEEDED");
  });

  it("enforces relative and absolute growth caps", () => {
    const result = evaluatePolicyWithCatalog({ items: [{ productId: "p_runner", quantity: 1 }, { productId: "p_belt", quantity: 1 }, { productId: "p_bottle", quantity: 1 }], mandate, catalog: products, controls: { baseCartTotalPaise: 329900, maximumUpsellPaise: 100000 } });
    expect(result.reasonCodes).toContain("UPSELL_LIMIT_EXCEEDED");
  });

  it("records the required price-drift outcome without a PSP action", () => {
    const result = runPriceDriftScenario(new Date("2026-09-05T00:00:00.000Z"));
    expect(result.policy.decision).toBe("DENY");
    expect(result.policy.reasonCodes).toEqual(expect.arrayContaining(["PRICE_CHANGED", "BUDGET_EXCEEDED"]));
    expect(result.razorpayActionCreated).toBe(false);
  });
});
