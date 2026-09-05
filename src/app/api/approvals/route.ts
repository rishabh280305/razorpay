import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendPersistentAudit, getCatalogProducts, persistApprovedMandate } from "@/db/repository";
import { canonicalMandateHash } from "@/lib/mandate";
import { evaluatePolicyWithCatalog } from "@/lib/policy";

const schema = z.object({ sessionId: z.string().min(8), items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().max(10) })).min(1), proposedTotalPaise: z.number().int().positive(), mandate: z.object({ id: z.string(), merchantId: z.string(), maxAmountPaise: z.number().int().positive(), categories: z.array(z.string()), maxQuantity: z.number().int().positive(), expiresAt: z.string().datetime(), recurringAllowed: z.boolean(), approvalThresholdPaise: z.number().int().positive() }) });

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid approval request", requestId }, { status: 400 });
  const catalog = await getCatalogProducts(parsed.data.items.map(item => item.productId));
  const canonicalHash = canonicalMandateHash(parsed.data.mandate);
  const mandate = { ...parsed.data.mandate, canonicalHash };
  let policy;
  try { policy = evaluatePolicyWithCatalog({ items: parsed.data.items, mandate, catalog, proposedTotalPaise: parsed.data.proposedTotalPaise }); }
  catch { return NextResponse.json({ error: "One or more product IDs are invalid", requestId }, { status: 400 }); }
  if (policy.decision === "DENY") return NextResponse.json({ state: "POLICY_BLOCKED", policy, requestId }, { status: 409 });
  await persistApprovedMandate({ sessionId: parsed.data.sessionId, requestId, mandate, canonicalPayload: mandate });
  const audit = await appendPersistentAudit({ sessionId: parsed.data.sessionId, actor: "demo-buyer", actorType: "buyer", action: "mandate.approved", evidence: { productIds: parsed.data.items.map(item => item.productId), policyDecision: policy.decision, reasonCodes: policy.reasonCodes, expiresAt: mandate.expiresAt }, amountAfterPaise: policy.authoritativeTotalPaise, mandateHash: canonicalHash, requestId });
  return NextResponse.json({ state: "AUTHORIZED", mandate, policy, auditEventId: audit?.id ?? null, requestId }, { status: 201, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
}
