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
