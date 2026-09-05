import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendPersistentAudit, claimIdempotency, completeIdempotency, getCatalogProducts, isMandateApproved } from "@/db/repository";
import { canonicalMandateHash } from "@/lib/mandate";
import { evaluatePolicyWithCatalog } from "@/lib/policy";
import { createTestSubscription, findOrCreateMonthlyTestPlan, findTestSubscriptionByFingerprint } from "@/lib/razorpay";

const schema = z.object({ productId: z.string(), quantity: z.number().int().positive().max(5).default(1), cycles: z.number().int().min(2).max(12).default(3), proposedTotalPaise: z.number().int().positive(), mandate: z.object({ id: z.string(), merchantId: z.string(), maxAmountPaise: z.number().int().positive(), categories: z.array(z.string()), maxQuantity: z.number().int().positive(), expiresAt: z.string().datetime(), recurringAllowed: z.literal(true), approvalThresholdPaise: z.number().int().positive() }) });

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const key = request.headers.get("idempotency-key");
  if (!key || key.length < 10) return NextResponse.json({ error: "Idempotency-Key of at least 10 characters is required", requestId }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid recurring purchase request", requestId }, { status: 400 });
  const canonicalHash = canonicalMandateHash(parsed.data.mandate);
  const mandate = { ...parsed.data.mandate, canonicalHash };
  const [catalog, durableApproval] = await Promise.all([getCatalogProducts([parsed.data.productId]), isMandateApproved(mandate.id, canonicalHash)]);
  const product = catalog[0];
  if (!product || product.id !== parsed.data.productId) return NextResponse.json({ error: "Unknown catalog product", requestId }, { status: 400 });
  if (!product.subscriptionEligible) return NextResponse.json({ error: "Product is not eligible for recurring purchase", code: "RECURRING_PRODUCT_INELIGIBLE", requestId }, { status: 409 });
  const policy = evaluatePolicyWithCatalog({ items: [{ productId: product.id, quantity: parsed.data.quantity }], mandate, catalog, proposedTotalPaise: parsed.data.proposedTotalPaise, controls: { recurringRequested: true, expectedAgentIdentity: "agentready-subscription", actualAgentIdentity: "agentready-subscription" } });
  if (policy.decision === "DENY" || !durableApproval) return NextResponse.json({ state: policy.decision === "DENY" ? "POLICY_BLOCKED" : "AWAITING_APPROVAL", policy, error: "A recurring-enabled durable mandate approval is required", requestId }, { status: 409 });

  const fingerprint = createHash("sha256").update(JSON.stringify({ operation: "subscription", productId: product.id, quantity: parsed.data.quantity, cycles: parsed.data.cycles, canonicalHash })).digest("hex");
  const claim = await claimIdempotency(key, fingerprint);
  if (claim.kind === "unavailable") return NextResponse.json({ error: "Durable idempotency storage is unavailable", requestId }, { status: 503 });
  if (claim.kind === "conflict") return NextResponse.json({ error: "Idempotency-Key was used with a different operation", requestId }, { status: 409 });
  if (claim.kind === "replay") return NextResponse.json({ ...(claim.response as object), idempotentReplay: true, requestId });
  try {
    const existing = await findTestSubscriptionByFingerprint(fingerprint);
    if (claim.kind === "in_progress" && !existing) return NextResponse.json({ error: "An identical subscription request is already in progress", requestId }, { status: 409, headers: { "Retry-After": "2" } });
    const plan = await findOrCreateMonthlyTestPlan({ productId: product.id, name: `${product.name} monthly`, description: product.description.slice(0, 240), amount: product.pricePaise });
    const subscription = existing ?? await createTestSubscription({ planId: plan.id, quantity: parsed.data.quantity, cycles: parsed.data.cycles, mandateHash: canonicalHash, idempotencyFingerprint: fingerprint });
    const response = { subscription: { id: subscription.id, planId: subscription.plan_id, status: subscription.status, quantity: subscription.quantity, cycles: subscription.total_count, shortUrl: subscription.short_url }, policy, mandateHash: canonicalHash, state: "SUBSCRIPTION_AUTHORIZATION_PENDING", testMode: true, idempotentReplay: Boolean(existing), requestId };
    await completeIdempotency(key, subscription.id, response);
    await appendPersistentAudit({ actor: "subscription-executor", actorType: "system", action: existing ? "razorpay.subscription.reused" : "razorpay.subscription.created", evidence: { razorpaySubscriptionId: subscription.id, razorpayPlanId: plan.id, status: subscription.status, cycles: parsed.data.cycles, idempotentReplay: Boolean(existing) }, amountAfterPaise: policy.authoritativeTotalPaise, mandateHash: canonicalHash, requestId });
    return NextResponse.json(response, { status: 201, headers: { "X-Request-ID": requestId } });
  } catch {
    await appendPersistentAudit({ actor: "subscription-executor", actorType: "system", action: "razorpay.subscription.unavailable", evidence: { reason: "TEST_ACCOUNT_CAPABILITY_OR_API_ERROR", policyDecision: policy.decision }, amountAfterPaise: policy.authoritativeTotalPaise, mandateHash: canonicalHash, requestId });
    return NextResponse.json({ error: "Subscription integration unavailable for this Razorpay TEST account", code: "INTEGRATION_UNAVAILABLE", requestId }, { status: 503 });
  }
}
