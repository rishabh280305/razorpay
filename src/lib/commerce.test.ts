import { describe, expect, it } from "vitest";
import { appendAudit, verifyAuditChain } from "./audit";
import { runBenchmark } from "./benchmark";
import { evaluatePolicy } from "./policy";
import { transition } from "./state-machine";
import { validWebhookSignature } from "./razorpay";
import { createHmac } from "crypto";
import type { Mandate } from "./types";

const mandate: Mandate = { id: "m1", merchantId: "m_demo", maxAmountPaise: 200000, categories: ["skincare"], maxQuantity: 5, expiresAt: "2030-01-01T00:00:00.000Z", recurringAllowed: false, approvalThresholdPaise: 100000, canonicalHash: "abc" };
describe("money safety core", () => {
  it("recomputes prices and blocks price drift beyond the mandate", () => { const result = evaluatePolicy({ items: [{ productId: "p_cleanser", quantity: 1 }, { productId: "p_moisturizer", quantity: 1 }, { productId: "p_spf", quantity: 1 }], mandate, proposedTotalPaise: 179900 }); expect(result.decision).toBe("DENY"); expect(result.reasonCodes).toContain("BUDGET_EXCEEDED"); expect(result.reasonCodes).toContain("PRICE_CHANGED"); });
  it("requires approval without bypassing mandate bounds", () => { const result = evaluatePolicy({ items: [{ productId: "p_cleanser", quantity: 1 }, { productId: "p_moisturizer", quantity: 1 }], mandate, proposedTotalPaise: 149800 }); expect(result.decision).toBe("REQUIRE_APPROVAL"); expect(result.authoritativeTotalPaise).toBe(149800); });
  it("rejects impossible state transitions", () => { expect(() => transition("INTENT_RECEIVED", "PAYMENT_CAPTURED")).toThrow(/Impossible/); expect(transition("AUTHORIZED", "RAZORPAY_ORDER_CREATED")).toBe("RAZORPAY_ORDER_CREATED"); });
  it("detects audit tampering", () => { const first = appendAudit({ sessionId: "s", actor: "agent", actorType: "agent", action: "intent", inputSummary: "x", outputSummary: "y", requestId: "r" }); const second = appendAudit({ sessionId: "s", actor: "policy", actorType: "policy", action: "allow", inputSummary: "x", outputSummary: "y", requestId: "r2" }, first); expect(verifyAuditChain([first, second])).toBe(true); expect(verifyAuditChain([{ ...second, outputSummary: "tampered" }])).toBe(false); });
  it("is deterministic and has no simulated policy violation", () => { const a = runBenchmark(); const b = runBenchmark(); expect(a).toEqual(b); expect(a.sessions).toBe(500); expect(a.policyViolationRatePercent).toBe(0); expect(a.treatmentGmvPaise).toBeGreaterThan(a.baselineGmvPaise); });
  it("verifies only a raw-body webhook HMAC", () => { process.env.RAZORPAY_WEBHOOK_SECRET = "test_secret"; const raw = '{"event":"payment.captured"}'; const signature = createHmac("sha256", "test_secret").update(raw).digest("hex"); expect(validWebhookSignature(raw, signature)).toBe(true); expect(validWebhookSignature(`${raw} `, signature)).toBe(false); });
});
