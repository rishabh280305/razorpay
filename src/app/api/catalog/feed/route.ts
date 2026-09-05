import { NextResponse } from "next/server";
import { merchant } from "@/lib/catalog";
import { getCatalogProducts } from "@/db/repository";

export async function GET() {
  const products = await getCatalogProducts();
  return NextResponse.json({ api_version: "2026-04-17", profile: "ACP-compatible catalog representation (implementation profile)", merchant: { id: merchant.id, name: merchant.name }, products: products.map((p) => ({ id: p.id, sku: p.sku, title: p.name, description: p.description, availability: p.available && p.inventory > 0 ? "in_stock" : "out_of_stock", price: { amount: p.pricePaise, currency: "INR", unit: "paise" }, category: p.category, attributes: p.attributes, image: p.image, metadata: { tags: p.tags, subscription_eligible: p.subscriptionEligible } })) });
}
