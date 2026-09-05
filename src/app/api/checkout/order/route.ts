import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTestOrder, findTestOrderByReceipt } from "@/lib/razorpay";
import { recomputeCart, evaluatePolicy } from "@/lib/policy";
import { createHash } from "crypto";
import { canonicalMandateHash } from "@/lib/mandate";
import { isTestKey } from "@/lib/config";

const bodySchema = z.object({ items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().max(10) })).min(1), mandate: z.object({ id: z.string(), merchantId: z.string(), maxAmountPaise: z.number().int().positive(), categories: z.array(z.string()), maxQuantity: z.number().int().positive(), expiresAt: z.string().datetime(), recurringAllowed: z.boolean(), approvalThresholdPaise: z.number().int().positive(), canonicalHash: z.string().optional() }), proposedTotalPaise: z.number().int().positive(), approved: z.boolean().default(false) });
const idempotency = new Map<string, unknown>();

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const key = request.headers.get("idempotency-key");
  if (!key) return NextResponse.json({ error: "Idempotency-Key is required", requestId }, { status: 400 });
  if (idempotency.has(key)) return NextResponse.json({ ...(idempotency.get(key) as object), idempotentReplay: true }, { headers: { "x-request-id": requestId } });
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid checkout request", requestId }, { status: 400 });
  if (!isTestKey()) return NextResponse.json({ error: "Only Razorpay TEST Mode credentials are accepted", requestId }, { status: 503 });
  const canonicalHash = canonicalMandateHash(parsed.data.mandate);
  const mandate = { ...parsed.data.mandate, canonicalHash };
  const policy = evaluatePolicy({ items: parsed.data.items, mandate, proposedTotalPaise: parsed.data.proposedTotalPaise, previousExecution: false });
  if (policy.decision === "DENY" || (policy.decision === "REQUIRE_APPROVAL" && !parsed.data.approved)) return NextResponse.json({ policy, state: policy.decision === "DENY" ? "POLICY_BLOCKED" : "AWAITING_APPROVAL", requestId }, { status: 409 });
  const receipt = `ar_${createHash("sha256").update(key).digest("hex").slice(0, 18)}`;
  const fingerprint = createHash("sha256").update(JSON.stringify({ items: parsed.data.items, mandate, proposedTotalPaise: parsed.data.proposedTotalPaise })).digest("hex");
  const existing = await findTestOrderByReceipt(receipt);
  if (existing && (existing.notes?.idempotency_fingerprint !== fingerprint || Number(existing.amount) !== policy.authoritativeTotalPaise)) return NextResponse.json({ error: "Idempotency-Key was already used with a different checkout payload", requestId }, { status: 409 });
  const order = existing ?? await createTestOrder({ amount: policy.authoritativeTotalPaise, receipt, notes: { agentready_request_id: requestId, mandate_hash: canonicalHash, idempotency_fingerprint: fingerprint } });
  const response = { order: { id: order.id, amount: order.amount, currency: order.currency, status: order.status }, keyId: process.env.RAZORPAY_KEY_ID, policy, mandateHash: canonicalHash, state: "RAZORPAY_ORDER_CREATED", idempotentReplay: Boolean(existing), requestId };
  idempotency.set(key, response);
  return NextResponse.json(response, { status: 201, headers: { "x-request-id": requestId } });
}
