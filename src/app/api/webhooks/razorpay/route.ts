import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { validWebhookSignature } from "@/lib/razorpay";
import { appendPersistentAudit, applyWebhookOrderState, persistWebhook } from "@/db/repository";
import { randomUUID } from "crypto";

const processed = new Set<string>();
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!validWebhookSignature(raw, signature)) return NextResponse.json({ error: "invalid webhook signature" }, { status: 401 });
  const eventHash = createHash("sha256").update(raw).digest("hex");
  if (processed.has(eventHash)) return NextResponse.json({ received: true, idempotent: true });
  let payload: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } }; order?: { entity?: { id?: string } } } };
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const event = payload.event ?? "unknown"; const payment = payload.payload?.payment?.entity; const orderId = payment?.order_id ?? payload.payload?.order?.entity?.id; const entityId = payment?.id ?? orderId;
  const persisted = await persistWebhook({ id: randomUUID(), eventHash, event, entityId, payload: payload as object });
  if (persisted.duplicate) return NextResponse.json({ received: true, idempotent: true, verified: true });
  processed.add(eventHash);
  await applyWebhookOrderState(orderId, event, payment?.id);
  await appendPersistentAudit({ actor: "razorpay-webhook", actorType: "razorpay", action: event, evidence: { entityId, orderId, signatureVerified: true }, requestId: request.headers.get("x-request-id") ?? randomUUID() });
  return NextResponse.json({ received: true, event, verified: true, idempotent: false });
}
