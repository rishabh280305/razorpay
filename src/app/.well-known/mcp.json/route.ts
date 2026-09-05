import { NextResponse } from "next/server";
export function GET() { return NextResponse.json({ name: "AgentReady", description: "Policy-gated merchant commerce tools", transport: { type: "streamable-http", url: "/api/mcp" }, protocol_version: "2026-07-28", authentication: { production: "Bearer token required per merchant", demo: "read-only tools only" } }); }
