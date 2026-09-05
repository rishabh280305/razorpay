import { evaluatePolicyWithCatalog } from "./policy";
import type { Mandate, Product } from "./types";

const approvedProduct: Product = { id: "chaos_primary", sku: "CHAOS-01", name: "Approved routine", description: "Price drift fixture", category: "skincare", pricePaise: 179900, costPaise: 70000, inventory: 4, tags: ["sensitive-skin"], attributes: { fragrance: "none" }, image: "◈", crossSellIds: [], subscriptionEligible: false, available: true };

export function runPriceDriftScenario(now = new Date()) {
  const mandate: Mandate = { id: "mandate_price_drift", merchantId: "m_demo", maxAmountPaise: 200000, categories: ["skincare"], maxQuantity: 5, expiresAt: new Date(now.getTime() + 20 * 60_000).toISOString(), recurringAllowed: false, approvalThresholdPaise: 100000, canonicalHash: "fixture-hash" };
  const changedCatalog = [{ ...approvedProduct, pricePaise: 204900 }];
  const policy = evaluatePolicyWithCatalog({ items: [{ productId: approvedProduct.id, quantity: 1 }], mandate, catalog: changedCatalog, proposedTotalPaise: approvedProduct.pricePaise });
  return { approvedTotalPaise: approvedProduct.pricePaise, authoritativeTotalPaise: policy.authoritativeTotalPaise, mandateMaxPaise: mandate.maxAmountPaise, policy, razorpayActionCreated: false as const };
}
