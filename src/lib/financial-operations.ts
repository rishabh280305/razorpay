export type RefundOrderEvidence = { state: string; amountPaise: number; razorpayPaymentId: string | null };

export function evaluateFullRefund(order: RefundOrderEvidence | null) {
  if (!order) return { eligible: false as const, code: "PAYMENT_NOT_FOUND" as const, amountPaise: 0 };
  if (!order.razorpayPaymentId) return { eligible: false as const, code: "PAYMENT_NOT_VERIFIED" as const, amountPaise: 0 };
  if (!["PAYMENT_CAPTURED", "ORDER_CONFIRMED", "COMPLETED"].includes(order.state)) return { eligible: false as const, code: "PAYMENT_NOT_CAPTURED" as const, amountPaise: 0 };
  if (order.amountPaise <= 0) return { eligible: false as const, code: "INVALID_REFUND_AMOUNT" as const, amountPaise: 0 };
  return { eligible: true as const, code: "FULL_REFUND_ALLOWED" as const, amountPaise: order.amountPaise };
}
