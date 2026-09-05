import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendPersistentAudit, claimIdempotency, completeIdempotency, getRefundEligibleOrder, markOrderRefunded } from "@/db/repository";
import { evaluateFullRefund } from "@/lib/financial-operations";
import { refundTestPayment } from "@/lib/razorpay";

const schema = z.object({ paymentId: z.string().startsWith("pay_"), confirmation: z.literal("REFUND_FULL_TEST_PAYMENT") });

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[A-Za-z0-9_-]{10,}$/.test(key)) return NextResponse.json({ error: "A Razorpay-compatible Idempotency-Key is required", requestId }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Explicit full-refund confirmation is required", requestId }, { status: 400 });
  const order = await getRefundEligibleOrder(parsed.data.paymentId);
  const eligibility = evaluateFullRefund(order);
  if (!eligibility.eligible) return NextResponse.json({ state: "REFUND_BLOCKED", eligibility, error: "Refund policy rejected this request; no Razorpay action occurred", requestId }, { status: 409 });
  const fingerprint = createHash("sha256").update(JSON.stringify({ operation: "full_refund", paymentId: parsed.data.paymentId, amountPaise: eligibility.amountPaise })).digest("hex");
  const claim = await claimIdempotency(key, fingerprint);
  if (claim.kind === "unavailable") return NextResponse.json({ error: "Durable idempotency storage is unavailable", requestId }, { status: 503 });
  if (claim.kind === "conflict") return NextResponse.json({ error: "Idempotency-Key was used with a different operation", requestId }, { status: 409 });
  if (claim.kind === "replay") return NextResponse.json({ ...(claim.response as object), idempotentReplay: true, requestId });
  if (claim.kind === "in_progress") return NextResponse.json({ error: "An identical refund is already in progress", requestId }, { status: 409, headers: { "Retry-After": "2" } });
  try {
    const refund = await refundTestPayment({ paymentId: parsed.data.paymentId, amount: eligibility.amountPaise, idempotencyKey: key });
    const response = { refund: { id: refund.id, paymentId: parsed.data.paymentId, amountPaise: refund.amount, status: refund.status }, eligibility, state: "REFUNDED", testMode: true, idempotentReplay: false, requestId };
    await markOrderRefunded(parsed.data.paymentId);
    await completeIdempotency(key, refund.id, response);
    await appendPersistentAudit({ actor: "refund-executor", actorType: "system", action: "razorpay.refund.created", evidence: { razorpayRefundId: refund.id, razorpayPaymentId: parsed.data.paymentId, eligibilityCode: eligibility.code, idempotencyKeyPresent: true }, amountBeforePaise: eligibility.amountPaise, amountAfterPaise: 0, mandateHash: order?.mandateHash, requestId });
    return NextResponse.json(response, { status: 201, headers: { "X-Request-ID": requestId } });
  } catch {
    await appendPersistentAudit({ actor: "refund-executor", actorType: "system", action: "razorpay.refund.failed", evidence: { razorpayPaymentId: parsed.data.paymentId, reason: "RAZORPAY_API_REJECTED" }, amountBeforePaise: eligibility.amountPaise, amountAfterPaise: eligibility.amountPaise, mandateHash: order?.mandateHash, requestId });
    return NextResponse.json({ error: "Razorpay TEST refund could not be completed", code: "RAZORPAY_REFUND_FAILED", requestId }, { status: 502 });
  }
}
