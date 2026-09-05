import { NextResponse } from "next/server";
import { getOperationalMetrics, seedCatalog } from "@/db/repository";
import { runBenchmark } from "@/lib/benchmark";

export const dynamic = "force-dynamic";
export async function GET() { await seedCatalog(); const operational = await getOperationalMetrics(); return NextResponse.json({ realTestMode: operational ?? { counts: { testOrders: 0, webhookEvents: 0, auditEvents: 0, testOrderValuePaise: 0 }, orders: [], webhookEvents: [], auditEvents: [] }, synthetic: runBenchmark(), labels: { realTestMode: "REAL RAZORPAY TEST-MODE METRICS", synthetic: "SYNTHETIC BENCHMARK METRICS" } }); }
