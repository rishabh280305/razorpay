import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { evaluatePolicy } from "@/lib/policy";
import { appendAudit } from "@/lib/audit";

const schema = z.object({
  line_items: z.array(z.object({ product_id: z.string(), quantity: z.number().int().positive().max(10) })).min(1),
  mandate: z.object({ id: z.string(), merchantId: z.string(), maxAmountPaise: z.number().int().positive(), categories: z.array(z.string()), maxQuantity: z.number().int().positive(), expiresAt: z.string(), recurringAllowed: z.boolean(), approvalThresholdPaise: z.number().int().positive(), canonicalHash: z.string() }),
  proposed_total_paise: z.number().int().positive().optional()
});
type Session = { id: string; state: string; request_id: string; line_items: { product_id: string; quantity: number }[]; mandate: z.infer<typeof schema>["mandate"]; policy: ReturnType<typeof evaluatePolicy>; audit_id: string };
export const sessions = new Map<string, Session>();
const idempotency = new Map<string, Session>();
const version = "2026-04-17";
function response(session: Session, status = 200) { return NextResponse.json({ api_version: version, checkout_session: session }, { status, headers: { "API-Version": version, "X-Request-ID": session.request_id } }); }

export function GET() { return NextResponse.json({ api_version: version, profile: "AgentReady ACP checkout-session adapter", endpoints: ["POST /api/acp/checkout_sessions", "GET/PATCH /api/acp/checkout_sessions/:id", "POST /api/acp/checkout_sessions/:id/complete", "POST /api/acp/checkout_sessions/:id/cancel"], guarantees: ["authoritative cart totals", "idempotency", "request IDs", "deterministic policy firewall", "same audit pipeline as UI checkout"] }); }
export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const key = request.headers.get("idempotency-key");
  if (!key) return NextResponse.json({ error: { code: "idempotency_key_required" }, request_id: requestId }, { status: 400 });
  const prior = idempotency.get(key); if (prior) return response(prior);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: { code: "invalid_request", message: "line_items and mandate must match the AgentReady schema" }, request_id: requestId }, { status: 400 });
  const lineItems = parsed.data.line_items;
  const policy = evaluatePolicy({ items: lineItems.map(i => ({ productId: i.product_id, quantity: i.quantity })), mandate: parsed.data.mandate, proposedTotalPaise: parsed.data.proposed_total_paise });
  const state = policy.decision === "DENY" ? "POLICY_BLOCKED" : policy.decision === "REQUIRE_APPROVAL" ? "AWAITING_APPROVAL" : "AUTHORIZED";
  const event = appendAudit({ sessionId: "pending", actor: "acp-client", actorType: "agent", action: "checkout_session.created", inputSummary: `${lineItems.length} line items`, outputSummary: state, policyDecision: policy.decision, reasonCodes: policy.reasonCodes, mandateHash: parsed.data.mandate.canonicalHash, requestId, idempotencyKey: key });
  const session: Session = { id: `acs_${randomUUID().replaceAll("-", "").slice(0, 18)}`, state, request_id: requestId, line_items: lineItems, mandate: parsed.data.mandate, policy, audit_id: event.id };
  sessions.set(session.id, session); idempotency.set(key, session);
  return response(session, 201);
}
