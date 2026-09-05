import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCatalogProducts, upsertCatalogProducts } from "@/db/repository";

export const dynamic = "force-dynamic";
const productSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{3,64}$/),
  sku: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(8).max(1_000),
  category: z.string().trim().min(2).max(64),
  pricePaise: z.number().int().nonnegative().max(100_000_000),
  compareAtPaise: z.number().int().nonnegative().max(100_000_000).optional(),
  costPaise: z.number().int().nonnegative().max(100_000_000),
  inventory: z.number().int().nonnegative().max(1_000_000),
  tags: z.array(z.string().trim().min(1).max(64)).max(30),
  attributes: z.record(z.string(), z.string()).refine(value => Object.keys(value).length <= 40),
  image: z.string().max(8).default("◈"),
  crossSellIds: z.array(z.string()).max(30),
  subscriptionEligible: z.boolean(),
  available: z.boolean(),
});
const bodySchema = z.object({ products: z.array(productSchema).min(1).max(250) });

function authorized(request: NextRequest) {
  const expected = process.env.CATALOG_ADMIN_KEY;
  const supplied = request.headers.get("x-karatsuba-admin-key");
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function GET() {
  const products = await getCatalogProducts();
  return NextResponse.json({ source: process.env.DATABASE_URL ? "neon-postgres" : "seed-fallback", authoritative: true, currency: "INR", moneyUnit: "paise", count: products.length, products }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Catalog writes require x-karatsuba-admin-key." }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid catalog payload", issues: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });
  const saved = await upsertCatalogProducts(parsed.data.products);
  return NextResponse.json({ imported: saved.length, products: saved }, { status: 201 });
}
