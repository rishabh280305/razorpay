import { describe, expect, it } from "vitest";
import { evaluateFullRefund } from "./financial-operations";

describe("refund authorization", () => {
  it("derives a full refund from a captured authoritative order", () => {
    expect(evaluateFullRefund({ state: "PAYMENT_CAPTURED", amountPaise: 149800, razorpayPaymentId: "pay_test" })).toEqual({ eligible: true, code: "FULL_REFUND_ALLOWED", amountPaise: 149800 });
  });

  it("blocks browser-visible but uncaptured payments", () => {
    expect(evaluateFullRefund({ state: "PAYMENT_AUTHORIZED", amountPaise: 149800, razorpayPaymentId: "pay_test" }).code).toBe("PAYMENT_NOT_CAPTURED");
    expect(evaluateFullRefund(null).code).toBe("PAYMENT_NOT_FOUND");
  });
});
