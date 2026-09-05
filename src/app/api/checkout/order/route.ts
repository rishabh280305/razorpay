import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTestOrder } from "@/lib/razorpay";
import { recomputeCart, evaluatePolicy } from "@/lib/policy";
import { createHash } from "crypto";

const bodySchema = z.object({ items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().max(10) })).min(1), mandate: z.object({ id: z.string(), merchantId: z.string(), maxAmountPaise: z.number().int().positive(), categories: z.array(z.string()), maxQuantity: z.number().int().positive(), expiresAt: z.string(), recurringAllowed: z.boolean(), approvalThresholdPaise: z.number().int().positive(), canonicalHash: z.string() }), proposedTotalPaise: z.number().int().positive(), approved: z.boolean().default(false) });
const idempotency = new Map<string, unknown>();

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const key = request.headers.get("idempotency-key");
  if (!key) return NextResponse.json({ error: "Idempotency-Key is required", requestId }, { status: 400 });
  if (idempotency.has(key)) return NextResponse.json(idempotency.get(key), { headers: { "x-request-id": requestId } });
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid checkout request", requestId }, { status: 400 });
  const policy = evaluatePolicy({ ...parsed.data, previousExecution: false });
  if (policy.decision === "DENY" || (policy.decision === "REQUIRE_APPROVAL" && !parsed.data.approved)) return NextResponse.json({ policy, state: policy.decision === "DENY" ? "POLICY_BLOCKED" : "AWAITING_APPROVAL", requestId }, { status: 409 });
  const order = await createTestOrder({ amount: policy.authoritativeTotalPaise, receipt: `ar_${createHash("sha256").update(key).digest("hex").slice(0, 18)}`, notes: { agentready_request_id: requestId, mandate_hash: parsed.data.mandate.canonicalHash } });
  const response = { order, policy, state: "RAZORPAY_ORDER_CREATED", requestId };
  idempotency.set(key, response);
  return NextResponse.json(response, { status: 201, headers: { "x-request-id": requestId } });
}
