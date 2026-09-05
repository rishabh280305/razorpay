import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendPersistentAudit, getCatalogProducts, persistAgentPlan } from "@/db/repository";
import { planCommerce } from "@/lib/ai";
import { logEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";
const schema = z.object({ prompt: z.string().trim().min(8).max(1_500) });
const windows = new Map<string, { count: number; resetAt: number }>();

function allowRequest(identity: string) {
  const now = Date.now();
  const window = windows.get(identity);
  if (!window || window.resetAt < now) { windows.set(identity, { count: 1, resetAt: now + 60_000 }); return true; }
  if (window.count >= 10) return false;
  window.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const identity = createHash("sha256").update(ip).digest("hex").slice(0, 16);
  if (!allowRequest(identity)) return NextResponse.json({ error: "AI planning rate limit reached. Try again in one minute.", requestId }, { status: 429, headers: { "Retry-After": "60", "X-Request-ID": requestId } });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A shopping prompt between 8 and 1,500 characters is required.", requestId }, { status: 400 });
  const catalog = await getCatalogProducts();
  const plan = await planCommerce(parsed.data.prompt, catalog);
  const sessionId = `sess_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const state = plan.items.length ? "GROWTH_OPTIMIZED" : "CATALOG_SEARCHED";
  await persistAgentPlan({ sessionId, requestId, buyerPrompt: parsed.data.prompt, state });
  await appendPersistentAudit({
    sessionId,
    actor: "buyer-growth-orchestrator",
    actorType: "agent",
    action: "commerce.plan.proposed",
    evidence: { provider: plan.provider, model: plan.model, safeFallback: plan.safeFallback, productIds: plan.items.map(item => item.id), baseTotalPaise: plan.baseTotalPaise, proposedTotalPaise: plan.proposedTotalPaise, growthAmountPaise: plan.growthAmountPaise, latencyMs: plan.latencyMs },
    amountBeforePaise: plan.baseTotalPaise,
    amountAfterPaise: plan.proposedTotalPaise,
    requestId,
  });
  logEvent("info", "ai.plan.completed", { requestId, sessionId, provider: plan.provider, model: plan.model, latencyMs: plan.latencyMs, itemCount: plan.items.length, safeFallback: plan.safeFallback });
  return NextResponse.json({ sessionId, requestId, plan, executionBoundary: "This response proposes product IDs only. Checkout re-reads price and inventory and re-evaluates policy." }, { headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
}
