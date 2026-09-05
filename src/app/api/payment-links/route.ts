import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { razorpayClient } from "@/lib/razorpay";
import { evaluatePolicyWithCatalog } from "@/lib/policy";
import { canonicalMandateHash } from "@/lib/mandate";
import { getCatalogProducts, isMandateApproved } from "@/db/repository";

const schema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().max(10) })).min(1),
  mandate: z.object({ id: z.string(), merchantId: z.string(), maxAmountPaise: z.number().int().positive(), categories: z.array(z.string()), maxQuantity: z.number().int().positive(), expiresAt: z.string().datetime(), recurringAllowed: z.boolean(), approvalThresholdPaise: z.number().int().positive() }),
  proposedTotalPaise: z.number().int().positive(), approved: z.literal(true)
});

export async function POST(request: NextRequest) {
  const key = request.headers.get("idempotency-key");
  if (!key) return NextResponse.json({ error: "Idempotency-Key is required" }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid payment-link request" }, { status: 400 });
  const mandate = { ...parsed.data.mandate, canonicalHash: canonicalMandateHash(parsed.data.mandate) };
  const durableApproval = await isMandateApproved(mandate.id, mandate.canonicalHash);
  const catalog = await getCatalogProducts(parsed.data.items.map(item => item.productId));
  const baseCartTotalPaise = Math.max(...parsed.data.items.map(item => (catalog.find(product => product.id === item.productId)?.pricePaise ?? 0) * item.quantity));
  let policy;
  try { policy = evaluatePolicyWithCatalog({ items: parsed.data.items, mandate, catalog, proposedTotalPaise: parsed.data.proposedTotalPaise, controls: { baseCartTotalPaise, expectedAgentIdentity: "agentready-payment-link", actualAgentIdentity: "agentready-payment-link" } }); }
  catch { return NextResponse.json({ error: "One or more catalog product IDs are invalid" }, { status: 400 }); }
  if (policy.decision === "DENY" || (policy.decision === "REQUIRE_APPROVAL" && !durableApproval)) return NextResponse.json({ policy, state: policy.decision === "DENY" ? "POLICY_BLOCKED" : "AWAITING_APPROVAL", error: policy.decision === "REQUIRE_APPROVAL" ? "A durable matching mandate approval is required." : undefined }, { status: 409 });
  const referenceId = `ar_pl_${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
  const link = await razorpayClient().paymentLink.create({ amount: policy.authoritativeTotalPaise, currency: "INR", accept_partial: false, reference_id: referenceId, description: "AgentReady policy-authorized cart", customer: { name: "AgentReady Demo Buyer", email: "buyer@example.com", contact: "+919000000000" }, notify: { email: false, sms: false, whatsapp: false }, reminder_enable: false, notes: { mandate_hash: mandate.canonicalHash } }) as unknown as { id: string; short_url: string; amount: number; status: string };
  return NextResponse.json({ id: link.id, shortUrl: link.short_url, amountPaise: link.amount, status: link.status, policy, state: "CHECKOUT_PENDING", testMode: true }, { status: 201 });
}
