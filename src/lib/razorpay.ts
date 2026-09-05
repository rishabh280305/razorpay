import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import { integrationStatus, isTestKey } from "./config";

export function razorpayClient() {
  if (!integrationStatus.razorpay || !isTestKey()) throw new Error("Razorpay TEST MODE is not configured.");
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! });
}

export async function createTestOrder(input: { amount: number; receipt: string; notes: Record<string, string> }) {
  return razorpayClient().orders.create({ amount: input.amount, currency: "INR", receipt: input.receipt, notes: input.notes });
}

export async function findTestOrderByReceipt(receipt: string) {
  const result = await razorpayClient().orders.all({ receipt, count: 10 });
  return result.items.find(order => order.receipt === receipt) ?? null;
}

export async function createTestInvoice(input: { receipt: string; mandateHash: string; items: Array<{ name: string; description: string; amount: number; quantity: number }> }) {
  return razorpayClient().invoices.create({
    type: "invoice",
    description: "Karatsuba policy-authorized B2B cart",
    receipt: input.receipt,
    currency: "INR",
    customer: { name: "Karatsuba Demo Buyer", email: "buyer@example.com", contact: "+919000000000" },
    line_items: input.items.map(item => ({ ...item, currency: "INR" })),
    expire_by: Math.floor(Date.now() / 1000) + 60 * 60,
    sms_notify: false,
    email_notify: false,
    partial_payment: false,
    notes: { mandate_hash: input.mandateHash, environment: "test" },
  });
}

export async function findTestInvoiceByReceipt(receipt: string) {
  const result = await razorpayClient().invoices.all({ count: 100 });
  return result.items.find(invoice => invoice.receipt === receipt) ?? null;
}

export async function findOrCreateMonthlyTestPlan(input: { productId: string; name: string; description: string; amount: number }) {
  const plans = await razorpayClient().plans.all({ count: 100 });
  const existing = plans.items.find(plan => plan.period === "monthly" && plan.interval === 1 && Number(plan.item.amount) === input.amount && plan.notes?.karatsuba_product_id === input.productId);
  return existing ?? razorpayClient().plans.create({ period: "monthly", interval: 1, item: { name: input.name, description: input.description, amount: input.amount, currency: "INR" }, notes: { karatsuba_product_id: input.productId, environment: "test" } });
}

export async function createTestSubscription(input: { planId: string; quantity: number; cycles: number; mandateHash: string; idempotencyFingerprint: string }) {
  return razorpayClient().subscriptions.create({
    plan_id: input.planId,
    quantity: input.quantity,
    total_count: input.cycles,
    customer_notify: false,
    expire_by: Math.floor(Date.now() / 1000) + 20 * 60,
    notes: { mandate_hash: input.mandateHash, idempotency_fingerprint: input.idempotencyFingerprint, environment: "test" },
  });
}

export async function findTestSubscriptionByFingerprint(fingerprint: string) {
  const result = await razorpayClient().subscriptions.all({ count: 100 });
  return result.items.find(subscription => subscription.notes?.idempotency_fingerprint === fingerprint) ?? null;
}

export async function refundTestPayment(input: { paymentId: string; amount: number; idempotencyKey: string }) {
  if (!isTestKey()) throw new Error("Only Razorpay TEST Mode credentials are accepted.");
  const authorization = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`, {
    method: "POST",
    headers: { authorization: `Basic ${authorization}`, "content-type": "application/json", "x-refund-idempotency": input.idempotencyKey },
    body: JSON.stringify({ amount: input.amount, notes: { source: "karatsuba", authorization: "deterministic_full_refund" } }),
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json() as { id?: string; status?: string; amount?: number; error?: { description?: string } };
  if (!response.ok || !payload.id) throw new Error(payload.error?.description ?? "Razorpay refund request failed.");
  return payload as { id: string; status: string; amount: number };
}

export function validWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try { return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex")); } catch { return false; }
}

export function validCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  try { return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex")); } catch { return false; }
}
