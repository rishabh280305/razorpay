import { NextRequest, NextResponse } from "next/server";
import { sessions } from "../route";
import { evaluatePolicy } from "@/lib/policy";

function get(id: string) { return sessions.get(id); }
export function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { return params.then(({ id }) => { const session = get(id); return session ? NextResponse.json({ api_version: "2026-04-17", checkout_session: session }) : NextResponse.json({ error: { code: "not_found" } }, { status: 404 }); }); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const session = get(id); if (!session) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 }); const body = await request.json(); if (!Array.isArray(body.line_items)) return NextResponse.json({ error: { code: "invalid_request" } }, { status: 400 }); const policy = evaluatePolicy({ items: body.line_items.map((i: { product_id: string; quantity: number }) => ({ productId: i.product_id, quantity: i.quantity })), mandate: session.mandate }); session.line_items = body.line_items; session.policy = policy; session.state = policy.decision === "DENY" ? "POLICY_BLOCKED" : policy.decision === "REQUIRE_APPROVAL" ? "AWAITING_APPROVAL" : "AUTHORIZED"; return NextResponse.json({ api_version: "2026-04-17", checkout_session: session }); }
