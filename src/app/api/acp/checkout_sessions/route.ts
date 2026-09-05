import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendPersistentAudit, getCatalogProducts, getCheckoutContext, persistCheckoutContext } from "@/db/repository";
import { canonicalMandateHash } from "@/lib/mandate";
import { evaluatePolicyWithCatalog } from "@/lib/policy";

export const dynamic = "force-dynamic";
const version = "2026-04-17";
const schema = z.object({ line_items: z.array(z.object({ product_id: z.string(), quantity: z.number().int().positive().max(10) })).min(1), mandate: z.object({ id: z.string(), merchantId: z.string(), maxAmountPaise: z.number().int().positive(), categories: z.array(z.string()), maxQuantity: z.number().int().positive(), expiresAt: z.string().datetime(), recurringAllowed: z.boolean(), approvalThresholdPaise: z.number().int().positive(), canonicalHash: z.string().optional() }), proposed_total_paise: z.number().int().positive().optional() });
const responseHeaders = (requestId: string) => ({ "API-Version": version, "X-Request-ID": requestId, "Cache-Control": "no-store" });

export function GET() { return NextResponse.json({ api_version: version, profile: "AgentReady ACP checkout-session implementation profile", persistence: "Neon Postgres", endpoints: ["POST /api/acp/checkout_sessions", "GET/PATCH /api/acp/checkout_sessions/:id", "POST /api/acp/checkout_sessions/:id/complete", "POST /api/acp/checkout_sessions/:id/cancel"], guarantees: ["authoritative cart totals", "durable idempotency", "request IDs", "deterministic policy firewall", "same audit pipeline as UI checkout"] }); }

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const key = request.headers.get("idempotency-key");
  if (!key) return NextResponse.json({ error: { code: "idempotency_key_required" }, request_id: requestId }, { status: 400, headers: responseHeaders(requestId) });
  const existingId = `chk_${createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
  const existing = await getCheckoutContext(existingId);
  if (existing) return NextResponse.json({ api_version: version, checkout_session: { id: existing.checkout.id, state: existing.checkout.state, request_id: existing.checkout.requestId, line_items: existing.checkout.lineItems, authoritative_total_paise: existing.checkout.authoritativeTotalPaise, policy: { decision: existing.checkout.policyDecision, reasonCodes: existing.checkout.reasonCodes } }, idempotent_replay: true }, { headers: responseHeaders(requestId) });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "invalid_request", message: "line_items and mandate must match the AgentReady ACP profile" }, request_id: requestId }, { status: 400, headers: responseHeaders(requestId) });
  const catalog = await getCatalogProducts(parsed.data.line_items.map(item => item.product_id));
  const hash = canonicalMandateHash(parsed.data.mandate);
  const mandate = { ...parsed.data.mandate, canonicalHash: hash };
  const baseCartTotalPaise = Math.max(...parsed.data.line_items.map(item => (catalog.find(product => product.id === item.product_id)?.pricePaise ?? 0) * item.quantity));
  let policy;
  try { policy = evaluatePolicyWithCatalog({ items: parsed.data.line_items.map(item => ({ productId: item.product_id, quantity: item.quantity })), mandate, catalog, proposedTotalPaise: parsed.data.proposed_total_paise, controls: { baseCartTotalPaise, expectedAgentIdentity: "acp-client", actualAgentIdentity: "acp-client", recurringRequested: mandate.recurringAllowed } }); }
  catch { return NextResponse.json({ error: { code: "invalid_product_id" }, request_id: requestId }, { status: 400, headers: responseHeaders(requestId) }); }
  const context = await persistCheckoutContext({ key, requestId, mandate, mandatePayload: mandate, items: parsed.data.line_items, totalPaise: policy.authoritativeTotalPaise, policyDecision: policy.decision, reasonCodes: policy.reasonCodes, channel: "acp", approved: false });
  if (!context) return NextResponse.json({ error: { code: "persistence_unavailable" }, request_id: requestId }, { status: 503, headers: responseHeaders(requestId) });
  const state = policy.decision === "DENY" ? "POLICY_BLOCKED" : policy.decision === "REQUIRE_APPROVAL" ? "AWAITING_APPROVAL" : "AUTHORIZED";
  const audit = await appendPersistentAudit({ sessionId: context.sessionId, actor: "acp-client", actorType: "agent", action: "checkout_session.created", evidence: { lineItemCount: parsed.data.line_items.length, state, protocolVersion: version, policyDecision: policy.decision, reasonCodes: policy.reasonCodes }, amountAfterPaise: policy.authoritativeTotalPaise, mandateHash: hash, requestId });
  return NextResponse.json({ api_version: version, checkout_session: { id: context.checkoutId, state, request_id: requestId, line_items: parsed.data.line_items, authoritative_total_paise: policy.authoritativeTotalPaise, mandate_hash: hash, policy, audit_id: audit?.id ?? null } }, { status: 201, headers: responseHeaders(requestId) });
}
