export type Product = {
  id: string; sku: string; name: string; description: string; category: string;
  pricePaise: number; compareAtPaise?: number; costPaise: number; inventory: number;
  tags: string[]; attributes: Record<string, string>; image: string;
  crossSellIds: string[]; subscriptionEligible: boolean; available: boolean;
};

export type CartItem = { productId: string; quantity: number; unitPricePaise: number };
export type Decision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
export type ReasonCode = "BUDGET_EXCEEDED" | "PRICE_CHANGED" | "INVENTORY_CHANGED" | "HUMAN_APPROVAL_REQUIRED" | "DUPLICATE_REQUEST" | "MANDATE_EXPIRED" | "CATEGORY_BLOCKED" | "MARGIN_FLOOR_VIOLATION" | "QUANTITY_EXCEEDED" | "UPSELL_LIMIT_EXCEEDED";

export type Mandate = {
  id: string; merchantId: string; maxAmountPaise: number; categories: string[];
  maxQuantity: number; expiresAt: string; recurringAllowed: boolean; approvalThresholdPaise: number;
  canonicalHash: string;
};

export type PolicyResult = { decision: Decision; reasonCodes: ReasonCode[]; explanation: string; authoritativeTotalPaise: number };

export type CommerceState =
  | "INTENT_RECEIVED" | "CATALOG_SEARCHED" | "CART_PROPOSED" | "GROWTH_OPTIMIZED"
  | "PRICE_VERIFIED" | "POLICY_EVALUATED" | "AWAITING_APPROVAL" | "AUTHORIZED"
  | "RAZORPAY_ORDER_CREATED" | "CHECKOUT_PENDING" | "PAYMENT_AUTHORIZED" | "PAYMENT_CAPTURED"
  | "ORDER_CONFIRMED" | "FULFILLMENT_PENDING" | "COMPLETED" | "CANCELLED" | "PAYMENT_FAILED"
  | "POLICY_BLOCKED" | "EXPIRED" | "REFUND_REQUESTED" | "REFUNDED";

export type AuditEvent = {
  id: string; timestamp: string; sessionId: string; actor: string; actorType: "buyer" | "agent" | "policy" | "system" | "razorpay";
  action: string; inputSummary: string; outputSummary: string; amountBeforePaise?: number; amountAfterPaise?: number;
  policyDecision?: Decision; reasonCodes?: ReasonCode[]; mandateHash?: string; requestId: string; idempotencyKey?: string;
  previousHash: string; currentHash: string;
};
