import { findProduct } from "./catalog";
import { sumPaise } from "./money";
import { CartItem, Mandate, PolicyResult, ReasonCode } from "./types";

export function recomputeCart(items: Pick<CartItem, "productId" | "quantity">[]) {
  return items.map((item) => {
    const product = findProduct(item.productId);
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    return { ...item, unitPricePaise: product.pricePaise, product };
  });
}

export function evaluatePolicy(input: { items: Pick<CartItem, "productId" | "quantity">[]; mandate: Mandate; proposedTotalPaise?: number; previousExecution?: boolean }): PolicyResult {
  const codes: ReasonCode[] = [];
  const authoritative = recomputeCart(input.items);
  const total = sumPaise(authoritative);
  if (new Date(input.mandate.expiresAt).getTime() < Date.now()) codes.push("MANDATE_EXPIRED");
  if (input.previousExecution) codes.push("DUPLICATE_REQUEST");
  if (input.proposedTotalPaise !== undefined && input.proposedTotalPaise !== total) codes.push("PRICE_CHANGED");
  if (total > input.mandate.maxAmountPaise) codes.push("BUDGET_EXCEEDED");
  if (authoritative.some(({ product, quantity }) => !product.available || product.inventory < quantity)) codes.push("INVENTORY_CHANGED");
  if (authoritative.some(({ product }) => input.mandate.categories.length && !input.mandate.categories.includes(product.category))) codes.push("CATEGORY_BLOCKED");
  if (authoritative.some(({ quantity }) => quantity > input.mandate.maxQuantity)) codes.push("QUANTITY_EXCEEDED");
  const denyCodes: ReasonCode[] = ["MANDATE_EXPIRED", "DUPLICATE_REQUEST", "BUDGET_EXCEEDED", "INVENTORY_CHANGED", "CATEGORY_BLOCKED", "QUANTITY_EXCEEDED"];
  const denied = codes.some((code) => denyCodes.includes(code));
  const decision = denied ? "DENY" : total >= input.mandate.approvalThresholdPaise ? "REQUIRE_APPROVAL" : "ALLOW";
  if (decision === "REQUIRE_APPROVAL") codes.push("HUMAN_APPROVAL_REQUIRED");
  return { decision, reasonCodes: codes, authoritativeTotalPaise: total, explanation: decision === "DENY" ? "No Razorpay action was created. Authoritative catalog data or the buyer mandate rejected this request." : decision === "REQUIRE_APPROVAL" ? "The cart is within mandate bounds but requires a human confirmation before execution." : "Authoritative inventory, price, and deterministic policy checks passed." };
}
