import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { appendPersistentAudit } from "@/db/repository";
import { runPriceDriftScenario } from "@/lib/chaos";

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const result = runPriceDriftScenario();
  const audit = await appendPersistentAudit({
    sessionId: `chaos_${randomUUID().replaceAll("-", "").slice(0, 18)}`,
    actor: "policy-firewall",
    actorType: "policy",
    action: "checkout.price_drift.blocked",
    evidence: { reasonCodes: result.policy.reasonCodes, decision: result.policy.decision, razorpayActionCreated: result.razorpayActionCreated },
    amountBeforePaise: result.approvedTotalPaise,
    amountAfterPaise: result.authoritativeTotalPaise,
    mandateHash: "price-drift-fixture",
    requestId,
  });
  return NextResponse.json({ scenario: "PRICE_DRIFT_DURING_AGENT_CHECKOUT", ...result, auditEventId: audit?.id ?? null, outcome: "Execution stopped before the Razorpay client was invoked.", requestId }, { status: 409, headers: { "X-AgentReady-Safe-Failure": "true", "X-Request-ID": requestId } });
}
