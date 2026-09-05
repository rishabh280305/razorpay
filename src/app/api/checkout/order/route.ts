import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTestOrder, findTestOrderByReceipt } from "@/lib/razorpay";
import { evaluatePolicyWithCatalog } from "@/lib/policy";
import { createHash } from "crypto";
import { canonicalMandateHash } from "@/lib/mandate";
import { isTestKey } from "@/lib/config";
import { appendPersistentAudit, claimIdempotency, completeIdempotency, getCatalogProducts, isMandateApproved, persistCheckoutContext, persistOrder } from "@/db/repository";

const bodySchema = z.object({ items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().max(10) })).min(1), mandate: z.object({ id: z.string(), merchantId: z.string(), maxAmountPaise: z.number().int().positive(), categories: z.array(z.string()), maxQuantity: z.number().int().positive(), expiresAt: z.string().datetime(), recurringAllowed: z.boolean(), approvalThresholdPaise: z.number().int().positive(), canonicalHash: z.string().optional() }), proposedTotalPaise: z.number().int().positive(), approved: z.boolean().default(false) });
export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const key = request.headers.get("idempotency-key");
  if (!key) return NextResponse.json({ error: "Idempotency-Key is required", requestId }, { status: 400 });
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid checkout request", requestId }, { status: 400 });
  if (!isTestKey()) return NextResponse.json({ error: "Only Razorpay TEST Mode credentials are accepted", requestId }, { status: 503 });
  const canonicalHash = canonicalMandateHash(parsed.data.mandate);
  const mandate = { ...parsed.data.mandate, canonicalHash };
  const durableApproval = await isMandateApproved(mandate.id, canonicalHash);
  const authoritativeCatalog = await getCatalogProducts(parsed.data.items.map(item => item.productId));
  const baseCartTotalPaise = Math.max(...parsed.data.items.map(item => (authoritativeCatalog.find(product => product.id === item.productId)?.pricePaise ?? 0) * item.quantity));
  let policy;
  try { policy = evaluatePolicyWithCatalog({ items: parsed.data.items, mandate, catalog: authoritativeCatalog, proposedTotalPaise: parsed.data.proposedTotalPaise, previousExecution: false, controls: { baseCartTotalPaise, expectedAgentIdentity: "karatsuba-web", actualAgentIdentity: "karatsuba-web" } }); }
  catch { return NextResponse.json({ error: "One or more catalog product IDs are invalid", requestId }, { status: 400 }); }
  if (policy.decision === "DENY" || (policy.decision === "REQUIRE_APPROVAL" && !durableApproval)) return NextResponse.json({ policy, state: policy.decision === "DENY" ? "POLICY_BLOCKED" : "AWAITING_APPROVAL", error: policy.decision === "REQUIRE_APPROVAL" ? "A durable matching mandate approval is required; the browser boolean is not authority." : undefined, requestId }, { status: 409 });
  const receipt = `ar_${createHash("sha256").update(key).digest("hex").slice(0, 18)}`;
  const fingerprint = createHash("sha256").update(JSON.stringify({ items: parsed.data.items, mandate, proposedTotalPaise: parsed.data.proposedTotalPaise })).digest("hex");
  const claim = await claimIdempotency(key, fingerprint);
  if (claim.kind === "conflict") return NextResponse.json({ error: "Idempotency-Key was already used with a different checkout payload", requestId }, { status: 409 });
  if (claim.kind === "replay") return NextResponse.json({ ...(claim.response as object), idempotentReplay: true }, { headers: { "x-request-id": requestId } });
  const existing = await findTestOrderByReceipt(receipt);
  if (claim.kind === "in_progress" && !existing) return NextResponse.json({ error: "An identical checkout is already in progress", requestId }, { status: 409, headers: { "Retry-After": "2" } });
  if (existing && (existing.notes?.idempotency_fingerprint !== fingerprint || Number(existing.amount) !== policy.authoritativeTotalPaise)) return NextResponse.json({ error: "Idempotency-Key was already used with a different checkout payload", requestId }, { status: 409 });
  const order = existing ?? await createTestOrder({ amount: policy.authoritativeTotalPaise, receipt, notes: { karatsuba_request_id: requestId, mandate_hash: canonicalHash, idempotency_fingerprint: fingerprint } });
  const response = { order: { id: order.id, amount: order.amount, currency: order.currency, status: order.status }, keyId: process.env.RAZORPAY_KEY_ID, policy, mandateHash: canonicalHash, state: "RAZORPAY_ORDER_CREATED", idempotentReplay: Boolean(existing), requestId };
  const context = await persistCheckoutContext({ key, requestId, mandate, mandatePayload: mandate, items: parsed.data.items, totalPaise: policy.authoritativeTotalPaise, policyDecision: policy.decision, reasonCodes: policy.reasonCodes, channel: "web", approved: durableApproval });
  await persistOrder({ razorpayOrderId: order.id, amountPaise: policy.authoritativeTotalPaise, idempotencyKey: key, mandateHash: canonicalHash, checkoutSessionId: context?.checkoutId });
  await completeIdempotency(key, order.id, response);
  await appendPersistentAudit({ sessionId: context?.sessionId, actor: "checkout-executor", actorType: "system", action: existing ? "razorpay.order.reused" : "razorpay.order.created", evidence: { razorpayOrderId: order.id, policyDecision: policy.decision, reasonCodes: policy.reasonCodes, idempotentReplay: Boolean(existing) }, amountAfterPaise: policy.authoritativeTotalPaise, mandateHash: canonicalHash, requestId });
  return NextResponse.json(response, { status: 201, headers: { "x-request-id": requestId } });
}
