import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validCheckoutSignature } from "@/lib/razorpay";
import { appendPersistentAudit, recordVerifiedPayment } from "@/db/repository";

const schema = z.object({
  razorpay_order_id: z.string().startsWith("order_"),
  razorpay_payment_id: z.string().startsWith("pay_"),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i)
});

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ verified: false, error: "invalid payment confirmation", requestId }, { status: 400 });
  const verified = validCheckoutSignature(parsed.data.razorpay_order_id, parsed.data.razorpay_payment_id, parsed.data.razorpay_signature);
  if (!verified) return NextResponse.json({ verified: false, error: "checkout signature verification failed", requestId }, { status: 401 });
  await recordVerifiedPayment({ razorpayOrderId: parsed.data.razorpay_order_id, razorpayPaymentId: parsed.data.razorpay_payment_id, state: "PAYMENT_AUTHORIZED" });
  await appendPersistentAudit({ actor: "checkout-verifier", actorType: "system", action: "razorpay.checkout.signature_verified", evidence: { razorpayOrderId: parsed.data.razorpay_order_id, razorpayPaymentId: parsed.data.razorpay_payment_id, signatureVerified: true }, requestId });
  return NextResponse.json({ verified: true, state: "PAYMENT_AUTHORIZED", orderId: parsed.data.razorpay_order_id, paymentId: parsed.data.razorpay_payment_id, requestId });
}
