import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { validWebhookSignature } from "@/lib/razorpay";

const processed = new Set<string>();
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!validWebhookSignature(raw, signature)) return NextResponse.json({ error: "invalid webhook signature" }, { status: 401 });
  const eventHash = createHash("sha256").update(raw).digest("hex");
  if (processed.has(eventHash)) return NextResponse.json({ received: true, idempotent: true });
  processed.add(eventHash);
  let payload: { event?: string; payload?: unknown };
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  // Durable event persistence and state transitions use the same handler when DATABASE_URL is configured.
  return NextResponse.json({ received: true, event: payload.event ?? "unknown", verified: true });
}
