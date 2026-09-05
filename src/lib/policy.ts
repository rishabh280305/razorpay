import { findProduct } from "./catalog";
import { sumPaise } from "./money";
import { CartItem, Mandate, PolicyControls, PolicyResult, ReasonCode } from "./types";
import type { Product } from "./types";

export function recomputeCart(items: Pick<CartItem, "productId" | "quantity">[]) {
  return items.map((item) => {
    const product = findProduct(item.productId);
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    return { ...item, unitPricePaise: product.pricePaise, product };
  });
}

export function evaluatePolicy(input: { items: Pick<CartItem, "productId" | "quantity">[]; mandate: Mandate; proposedTotalPaise?: number; previousExecution?: boolean }): PolicyResult {
  return evaluatePolicyWithCatalog({ ...input, catalog: input.items.map(item => {
    const product = findProduct(item.productId);
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    return product;
  }) });
}

export const defaultPolicyControls: PolicyControls = { dailyBudgetPaise: 500000, dailySpentPaise: 0, maximumItemPricePaise: 400000, deniedCategories: ["weapons", "gambling"], merchantMarginFloorBps: 1200, maximumUpsellPaise: 100000, maximumUpsellPercent: 160, maximumAutomatedAttempts: 2, automatedAttempts: 0, cooldownActive: false, catalogMaxAgeMs: 30 * 24 * 60 * 60_000, priceChangeTolerancePaise: 0, recurringRequested: false };

export function evaluatePolicyWithCatalog(input: { items: Pick<CartItem, "productId" | "quantity">[]; mandate: Mandate; catalog: Product[]; proposedTotalPaise?: number; previousExecution?: boolean; controls?: Partial<PolicyControls> }): PolicyResult {
  const codes: ReasonCode[] = [];
  const controls = { ...defaultPolicyControls, ...input.controls };
  const authoritative = input.items.map(item => {
    const product = input.catalog.find(candidate => candidate.id === item.productId);
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    return { ...item, unitPricePaise: product.pricePaise, product };
  });
  const total = sumPaise(authoritative);
  if (new Date(input.mandate.expiresAt).getTime() < Date.now()) codes.push("MANDATE_EXPIRED");
  if (input.previousExecution) codes.push("DUPLICATE_REQUEST");
  if (input.proposedTotalPaise !== undefined && Math.abs(input.proposedTotalPaise - total) > controls.priceChangeTolerancePaise) codes.push("PRICE_CHANGED");
  if (total > input.mandate.maxAmountPaise) codes.push("BUDGET_EXCEEDED");
  if (controls.dailySpentPaise + total > controls.dailyBudgetPaise) codes.push("DAILY_BUDGET_EXCEEDED");
  if (authoritative.some(({ product }) => product.pricePaise > controls.maximumItemPricePaise)) codes.push("ITEM_PRICE_EXCEEDED");
  if (authoritative.some(({ product, quantity }) => !product.available || product.inventory < quantity)) codes.push("INVENTORY_CHANGED");
  if (authoritative.some(({ product }) => (input.mandate.categories.length && !input.mandate.categories.includes(product.category)) || controls.deniedCategories.includes(product.category))) codes.push("CATEGORY_BLOCKED");
  if (authoritative.some(({ quantity }) => quantity > input.mandate.maxQuantity)) codes.push("QUANTITY_EXCEEDED");
  if (authoritative.some(({ product }) => product.pricePaise > 0 && ((product.pricePaise - product.costPaise) / product.pricePaise) * 10_000 < controls.merchantMarginFloorBps)) codes.push("MARGIN_FLOOR_VIOLATION");
  if (controls.recurringRequested && !input.mandate.recurringAllowed) codes.push("RECURRING_NOT_ALLOWED");
  if (controls.automatedAttempts >= controls.maximumAutomatedAttempts) codes.push("ATTEMPT_LIMIT_EXCEEDED");
  if (controls.cooldownActive) codes.push("TRANSACTION_COOLDOWN");
  if (controls.expectedAgentIdentity && controls.actualAgentIdentity !== controls.expectedAgentIdentity) codes.push("AGENT_IDENTITY_MISMATCH");
  if (authoritative.some(({ product }) => product.updatedAt && Date.now() - new Date(product.updatedAt).getTime() > controls.catalogMaxAgeMs)) codes.push("CATALOG_STALE");
  if (controls.baseCartTotalPaise !== undefined) { const upsell = Math.max(0, total - controls.baseCartTotalPaise); if (upsell > controls.maximumUpsellPaise || (controls.baseCartTotalPaise > 0 && upsell / controls.baseCartTotalPaise * 100 > controls.maximumUpsellPercent)) codes.push("UPSELL_LIMIT_EXCEEDED"); }
  const denyCodes: ReasonCode[] = ["MANDATE_EXPIRED", "DUPLICATE_REQUEST", "BUDGET_EXCEEDED", "DAILY_BUDGET_EXCEEDED", "ITEM_PRICE_EXCEEDED", "INVENTORY_CHANGED", "CATALOG_STALE", "CATEGORY_BLOCKED", "QUANTITY_EXCEEDED", "MARGIN_FLOOR_VIOLATION", "UPSELL_LIMIT_EXCEEDED", "RECURRING_NOT_ALLOWED", "ATTEMPT_LIMIT_EXCEEDED", "TRANSACTION_COOLDOWN", "AGENT_IDENTITY_MISMATCH"];
  const denied = codes.some((code) => denyCodes.includes(code));
  const decision = denied ? "DENY" : total >= input.mandate.approvalThresholdPaise ? "REQUIRE_APPROVAL" : "ALLOW";
  if (decision === "REQUIRE_APPROVAL") codes.push("HUMAN_APPROVAL_REQUIRED");
  return { decision, reasonCodes: codes, authoritativeTotalPaise: total, explanation: decision === "DENY" ? "No Razorpay action was created. Authoritative catalog data or the buyer mandate rejected this request." : decision === "REQUIRE_APPROVAL" ? "The cart is within mandate bounds but requires a human confirmation before execution." : "Authoritative inventory, price, and deterministic policy checks passed." };
}
