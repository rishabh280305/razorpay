import { NextRequest, NextResponse } from "next/server";
import { getCheckoutContext, updateCheckoutContext } from "@/db/repository";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const context = await getCheckoutContext(id); if (!context) return NextResponse.json({ error: { code: "not_found" } }, { status: 404 }); if (["RAZORPAY_ORDER_CREATED", "PAYMENT_CAPTURED", "ORDER_CONFIRMED", "COMPLETED"].includes(context.checkout.state)) return NextResponse.json({ error: { code: "cannot_cancel" } }, { status: 409 }); if (context.checkout.state !== "CANCELLED") await updateCheckoutContext(id, { state: "CANCELLED" }); return NextResponse.json({ api_version: "2026-04-17", checkout_session: { id, state: "CANCELLED" } }); }
