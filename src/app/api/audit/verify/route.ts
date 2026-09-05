import { NextResponse } from "next/server";
import { verifyPersistentAudit } from "@/db/repository";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await verifyPersistentAudit()); }
