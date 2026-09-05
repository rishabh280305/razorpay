import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evaluatePolicyWithCatalog } from "@/lib/policy";
import { canonicalMandateHash } from "@/lib/mandate";
import { getCatalogProducts } from "@/db/repository";

export const dynamic = "force-dynamic";
const protocolVersion = "2026-07-28";
const toolDefinitions = [
  { name: "search_products", description: "Search the authoritative merchant catalog. Returned prices are integer paise.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
  { name: "get_product", description: "Retrieve one authoritative product by its catalog ID.", inputSchema: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"], additionalProperties: false } },
  { name: "recommend_bundle", description: "Propose transparent compatible cross-sells without changing a cart.", inputSchema: { type: "object", properties: { product_ids: { type: "array", items: { type: "string" } }, budget_paise: { type: "integer" } }, required: ["product_ids", "budget_paise"], additionalProperties: false } },
  { name: "evaluate_checkout", description: "Evaluate an authoritative cart against a bounded mandate. This never executes payment.", inputSchema: { type: "object", properties: { product_ids: { type: "array", items: { type: "string" } }, max_amount_paise: { type: "integer" }, approved: { type: "boolean" } }, required: ["product_ids", "max_amount_paise"], additionalProperties: false } }
] as const;

function rpc(id: unknown, result: unknown, status = 200) { return NextResponse.json({ jsonrpc: "2.0", id, result }, { status, headers: { "MCP-Protocol-Version": protocolVersion, "Cache-Control": "no-store" } }); }
function error(id: unknown, code: number, message: string, status = 400) { return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status }); }
const envelope = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number()]).optional(), method: z.string(), params: z.record(z.string(), z.unknown()).optional() });

export function GET() { return NextResponse.json({ name: "Karatsuba MCP", protocolVersion, transport: "Streamable HTTP JSON-RPC", endpoint: "/api/mcp", tools: toolDefinitions.map(({ name, description }) => ({ name, description })), safety: "Payment execution is not exposed; checkout evaluation uses the deterministic policy firewall." }); }
export async function POST(request: NextRequest) {
  const parsed = envelope.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(null, -32600, "Invalid JSON-RPC request");
  const { id = null, method, params = {} } = parsed.data;
  if (method === "initialize") return rpc(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "karatsuba", version: "0.2.0" }, instructions: "Use product IDs returned by the authoritative catalog. Payment execution remains policy-gated outside MCP." });
  if (method === "tools/list") return rpc(id, { tools: toolDefinitions });
  if (method !== "tools/call") return error(id, -32601, "Method not found", 404);
  const name = typeof params.name === "string" ? params.name : "";
  const args = typeof params.arguments === "object" && params.arguments ? params.arguments as Record<string, unknown> : {};
  const catalog = await getCatalogProducts();
  const findProduct = (productId: string) => catalog.find(product => product.id === productId);
  let data: unknown;
  if (name === "search_products") { const terms = String(args.query ?? "").toLowerCase().split(/\W+/).filter(Boolean); data = catalog.filter(product => terms.some(term => `${product.name} ${product.description} ${product.category} ${product.tags.join(" ")}`.toLowerCase().includes(term))).slice(0, 6); }
  else if (name === "get_product") data = findProduct(String(args.product_id ?? "")) ?? { error: "product_not_found" };
  else if (name === "recommend_bundle") {
    const ids = Array.isArray(args.product_ids) ? args.product_ids.map(String) : [];
    const budget = Number(args.budget_paise ?? 0); const selected = ids.map(findProduct).filter(Boolean);
    const spent = selected.reduce((sum, product) => sum + (product?.pricePaise ?? 0), 0);
    const candidates = [...new Set(selected.flatMap(product => product?.crossSellIds ?? []))].filter(candidate => !ids.includes(candidate)).map(findProduct).filter(product => product && spent + product.pricePaise <= budget);
    data = { proposed: candidates.slice(0, 2), cart_unchanged: true, rationale: candidates.length ? "Compatible products fit within the buyer's hard budget; explicit acceptance is still required." : "No compatible add-on fits within the remaining mandate." };
  } else if (name === "evaluate_checkout") {
    const ids = Array.isArray(args.product_ids) ? args.product_ids.map(String) : [];
    const max = Number(args.max_amount_paise ?? 0); const expiresAt = new Date(Date.now() + 20 * 60_000).toISOString();
    const base = { id: `mcp_${crypto.randomUUID()}`, merchantId: "m_demo", maxAmountPaise: max, categories: [], maxQuantity: 5, expiresAt, recurringAllowed: false, approvalThresholdPaise: Math.max(1, max) };
    try { data = evaluatePolicyWithCatalog({ items: ids.map(productId => ({ productId, quantity: 1 })), mandate: { ...base, canonicalHash: canonicalMandateHash(base) }, catalog }); }
    catch { return error(id, -32602, "One or more product IDs are invalid"); }
  } else return error(id, -32602, "Unknown or unauthorized tool");
  return rpc(id, { content: [{ type: "text", text: JSON.stringify(data) }], isError: false });
}
