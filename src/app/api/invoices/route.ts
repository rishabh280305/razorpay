import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendPersistentAudit, claimIdempotency, completeIdempotency, getCatalogProducts, isMandateApproved } from "@/db/repository";
import { canonicalMandateHash } from "@/lib/mandate";
import { evaluatePolicyWithCatalog } from "@/lib/policy";
import { createTestInvoice, findTestInvoiceByReceipt } from "@/lib/razorpay";

const mandateSchema = z.object({ id: z.string(), merchantId: z.string(), maxAmountPaise: z.number().int().positive(), categories: z.array(z.string()), maxQuantity: z.number().int().positive(), expiresAt: z.string().datetime(), recurringAllowed: z.boolean(), approvalThresholdPaise: z.number().int().positive() });
const schema = z.object({ items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().max(10) })).min(1).max(50), mandate: mandateSchema, proposedTotalPaise: z.number().int().positive() });

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const key = request.headers.get("idempotency-key");
  if (!key || key.length < 10) return NextResponse.json({ error: "Idempotency-Key of at least 10 characters is required", requestId }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invoice request", requestId }, { status: 400 });
  const canonicalHash = canonicalMandateHash(parsed.data.mandate);
  const mandate = { ...parsed.data.mandate, canonicalHash };
  const [catalog, durableApproval] = await Promise.all([getCatalogProducts(parsed.data.items.map(item => item.productId)), isMandateApproved(mandate.id, canonicalHash)]);
  let policy;
  try { policy = evaluatePolicyWithCatalog({ items: parsed.data.items, mandate, catalog, proposedTotalPaise: parsed.data.proposedTotalPaise, controls: { expectedAgentIdentity: "agentready-invoice", actualAgentIdentity: "agentready-invoice" } }); }
  catch { return NextResponse.json({ error: "One or more catalog product IDs are invalid", requestId }, { status: 400 }); }
  if (policy.decision === "DENY" || (policy.decision === "REQUIRE_APPROVAL" && !durableApproval)) return NextResponse.json({ state: policy.decision === "DENY" ? "POLICY_BLOCKED" : "AWAITING_APPROVAL", policy, error: "A valid durable mandate approval is required", requestId }, { status: 409 });

  const fingerprint = createHash("sha256").update(JSON.stringify({ operation: "invoice", items: parsed.data.items, canonicalHash })).digest("hex");
  const claim = await claimIdempotency(key, fingerprint);
  if (claim.kind === "unavailable") return NextResponse.json({ error: "Durable idempotency storage is unavailable", requestId }, { status: 503 });
  if (claim.kind === "conflict") return NextResponse.json({ error: "Idempotency-Key was used with a different operation", requestId }, { status: 409 });
  if (claim.kind === "replay") return NextResponse.json({ ...(claim.response as object), idempotentReplay: true, requestId });
  const receipt = `ar_inv_${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
  try {
    const existing = await findTestInvoiceByReceipt(receipt);
    if (claim.kind === "in_progress" && !existing) return NextResponse.json({ error: "An identical invoice request is already in progress", requestId }, { status: 409, headers: { "Retry-After": "2" } });
    const invoice = existing ?? await createTestInvoice({ receipt, mandateHash: canonicalHash, items: parsed.data.items.map(item => { const product = catalog.find(candidate => candidate.id === item.productId)!; return { name: product.name, description: product.description.slice(0, 240), amount: product.pricePaise, quantity: item.quantity }; }) });
    const response = { invoice: { id: invoice.id, orderId: invoice.order_id ?? null, status: invoice.status, amountPaise: invoice.amount, amountDuePaise: invoice.amount_due ?? invoice.amount, shortUrl: invoice.short_url ?? null }, policy, mandateHash: canonicalHash, state: "INVOICE_ISSUED", testMode: true, idempotentReplay: Boolean(existing), requestId };
    await completeIdempotency(key, invoice.id, response);
    await appendPersistentAudit({ actor: "invoice-executor", actorType: "system", action: existing ? "razorpay.invoice.reused" : "razorpay.invoice.created", evidence: { razorpayInvoiceId: invoice.id, status: invoice.status, policyDecision: policy.decision, idempotentReplay: Boolean(existing) }, amountAfterPaise: policy.authoritativeTotalPaise, mandateHash: canonicalHash, requestId });
    return NextResponse.json(response, { status: 201, headers: { "X-Request-ID": requestId } });
  } catch {
    await appendPersistentAudit({ actor: "invoice-executor", actorType: "system", action: "razorpay.invoice.unavailable", evidence: { reason: "TEST_ACCOUNT_CAPABILITY_OR_API_ERROR", policyDecision: policy.decision }, amountAfterPaise: policy.authoritativeTotalPaise, mandateHash: canonicalHash, requestId });
    return NextResponse.json({ error: "Invoice integration unavailable for this Razorpay TEST account", code: "INTEGRATION_UNAVAILABLE", requestId }, { status: 503 });
  }
}
