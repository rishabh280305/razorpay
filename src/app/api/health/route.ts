import { NextResponse } from "next/server";
import { integrationStatus, isTestKey } from "@/lib/config";

export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ status: "ok", app: "agentready", demoMode: true, database: integrationStatus.database ? "configured" : "demo-memory", ai: integrationStatus.ai ? "configured" : "deterministic-fallback", razorpay: integrationStatus.razorpay && isTestKey() ? "test-mode-configured" : "not-configured", webhook: integrationStatus.webhook ? "configured" : "not-configured", testMode: true, version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" });
}
