import { Product } from "./types";

export const merchant = { id: "m_demo", name: "Nila Everyday", category: "Wellness & lifestyle" };

export const products: Product[] = [
  { id: "p_cleanser", sku: "NIL-CLN-100", name: "Calm Cloud Cleanser", description: "A gentle, fragrance-free daily gel cleanser for reactive and sensitive skin.", category: "skincare", pricePaise: 59900, compareAtPaise: 69900, costPaise: 22000, inventory: 42, tags: ["sensitive-skin", "fragrance-free", "cleanser"], attributes: { fragrance: "none", skin: "sensitive", size: "100 ml" }, image: "◌", crossSellIds: ["p_moisturizer", "p_spf"], subscriptionEligible: true, available: true },
  { id: "p_moisturizer", sku: "NIL-MOI-050", name: "Barrier Repair Moisturizer", description: "Ceramide moisturizer that pairs with a gentle cleanser; no added fragrance.", category: "skincare", pricePaise: 89900, compareAtPaise: 99900, costPaise: 35000, inventory: 28, tags: ["sensitive-skin", "fragrance-free", "ceramide"], attributes: { fragrance: "none", skin: "sensitive", size: "50 g" }, image: "✦", crossSellIds: ["p_cleanser", "p_spf"], subscriptionEligible: true, available: true },
  { id: "p_spf", sku: "NIL-SPF-050", name: "Daily Mineral SPF 50", description: "Sheer mineral sunscreen formulated for sensitive skin, fragrance free.", category: "skincare", pricePaise: 74900, costPaise: 30000, inventory: 19, tags: ["sensitive-skin", "fragrance-free", "sunscreen"], attributes: { fragrance: "none", spf: "50", skin: "sensitive" }, image: "☀", crossSellIds: ["p_cleanser", "p_moisturizer"], subscriptionEligible: true, available: true },
  { id: "p_coffee", sku: "NIL-COF-250", name: "Monsoon Estate Coffee", description: "Medium roast whole-bean coffee with cocoa and citrus notes.", category: "pantry", pricePaise: 64900, costPaise: 26000, inventory: 70, tags: ["coffee", "monthly", "whole-bean"], attributes: { roast: "medium", size: "250 g" }, image: "◒", crossSellIds: ["p_filter"], subscriptionEligible: true, available: true },
  { id: "p_filter", sku: "NIL-FIL-01", name: "Steel Pour-over Filter", description: "Reusable stainless-steel dripper compatible with standard mugs.", category: "accessories", pricePaise: 39900, costPaise: 11000, inventory: 36, tags: ["coffee", "compatible", "reusable"], attributes: { compatibleWith: "coffee" }, image: "⌁", crossSellIds: ["p_coffee"], subscriptionEligible: false, available: true },
  { id: "p_gift", sku: "NIL-GFT-01", name: "Care Gift Box", description: "A ready-to-gift box with an unscented candle and a handwritten note.", category: "gifts", pricePaise: 79900, costPaise: 30000, inventory: 25, tags: ["gift", "team", "under-1000"], attributes: { giftWrap: "included" }, image: "◇", crossSellIds: [], subscriptionEligible: false, available: true }
];

export function searchCatalog(query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return products.filter((product) => [product.name, product.description, product.category, ...product.tags, ...Object.values(product.attributes)].join(" ").toLowerCase().split(" ").some((word) => terms.some((term) => word.includes(term) || term.includes(word)))).sort((a, b) => b.inventory - a.inventory);
}

export const findProduct = (id: string) => products.find((product) => product.id === id);
