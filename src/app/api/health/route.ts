import { NextResponse } from "next/server";
import { integrationStatus, isTestKey } from "@/lib/config";
import { pingDb } from "@/db/repository";

export const dynamic = "force-dynamic";
export async function GET() {
  const databaseConnected = await pingDb();
  return NextResponse.json({ status: databaseConnected || !integrationStatus.database ? "ok" : "degraded", app: "agentready", demoMode: true, database: databaseConnected ? "connected" : integrationStatus.database ? "connection-failed" : "demo-memory", ai: integrationStatus.ai ? "configured" : "deterministic-fallback", razorpay: integrationStatus.razorpay && isTestKey() ? "test-mode-configured" : "not-configured", webhook: integrationStatus.webhook ? "configured" : "not-configured", testMode: true, version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" });
}
