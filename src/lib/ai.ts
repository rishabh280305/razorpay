import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { Product } from "./types";

export const buyerIntentSchema = z.object({
  searchQuery: z.string().min(1).max(200),
  budgetPaise: z.number().int().positive().max(10_000_000),
  categories: z.array(z.string().min(1)).max(5),
  excludedTerms: z.array(z.string().min(1)).max(10),
  preferences: z.array(z.string().min(1)).max(10),
  quantity: z.number().int().positive().max(10),
  recurring: z.boolean(),
  clarificationNeeded: z.boolean(),
  clarificationQuestion: z.string().max(240),
  conciseSummary: z.string().min(1).max(300),
});

export type BuyerIntent = z.infer<typeof buyerIntentSchema>;
export type PlannedItem = Product & { quantity: number; role: "intent_match" | "growth_proposal"; rationale: string };
export type CommercePlan = {
  intent: BuyerIntent;
  items: PlannedItem[];
  baseTotalPaise: number;
  proposedTotalPaise: number;
  growthAmountPaise: number;
  growthRationale: string;
  provider: "openai" | "deterministic-fallback";
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number } | null;
  safeFallback: boolean;
};

const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

export function fallbackBuyerIntent(prompt: string): BuyerIntent {
  const lower = prompt.toLowerCase();
  const amount = prompt.match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i) ?? prompt.match(/(?:under|below|max(?:imum)?|budget)\s*(?:of\s*)?([\d,]+)/i);
  const budgetRupees = amount ? Number(amount[1].replaceAll(",", "")) : 2000;
  const categories = lower.includes("skin") ? ["skincare"] : lower.includes("coffee") ? ["pantry", "accessories"] : lower.includes("gift") || lower.includes("employee") ? ["gifts"] : lower.includes("run") ? ["running"] : lower.includes("charger") || lower.includes("usb") ? ["electronics"] : [];
  const quantityWord = Object.entries(numberWords).find(([word]) => new RegExp(`\\b${word}\\b`).test(lower));
  const quantityDigit = lower.match(/\b(\d+)\s*(?:employees?|gifts?|items?|units?)\b/);
  const quantity = Math.min(10, Math.max(1, quantityDigit ? Number(quantityDigit[1]) : quantityWord?.[1] ?? 1));
  const excludedTerms = ["fragrance", "plastic", "dairy", "nuts"].filter(term => lower.includes(`avoid ${term}`) || lower.includes(`no ${term}`) || lower.includes(`${term}-free`));
  const preferences = ["sensitive", "cheapest", "compatible", "neutral", "monthly", "usual"].filter(term => lower.includes(term));
  return {
    searchQuery: prompt.slice(0, 200),
    budgetPaise: Number.isFinite(budgetRupees) && budgetRupees > 0 ? budgetRupees * 100 : 200000,
    categories,
    excludedTerms,
    preferences,
    quantity,
    recurring: /every month|monthly|subscription|recurring/.test(lower),
    clarificationNeeded: false,
    clarificationQuestion: "",
    conciseSummary: `Find ${categories.join(" or ") || "matching"} products within ₹${budgetRupees.toLocaleString("en-IN")}.`,
  };
}

async function extractWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const client = new OpenAI({ apiKey, timeout: 12_000, maxRetries: 1 });
  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  const response = await client.responses.parse({
    model,
    store: false,
    instructions: "You extract bounded shopping intent for an Indian merchant. Never invent products, prices, discounts, tax, inventory, or payment authority. Extract only the buyer's constraints. Monetary output is integer paise. If no budget is stated, use 200000 paise and set clarificationNeeded true only when purchase-safe planning is impossible. Return concise evidence summaries, never hidden reasoning.",
    input: [{ role: "user", content: [{ type: "input_text", text: prompt.slice(0, 1_500) }] }],
    text: { format: zodTextFormat(buyerIntentSchema, "buyer_intent") },
  });
  const parsed = response.output_parsed;
  if (!parsed) throw new Error("Model returned no schema-valid intent");
  return {
    intent: buyerIntentSchema.parse(parsed),
    model: response.model ?? model,
    usage: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null,
  };
}

function searchable(product: Product) {
  return [product.name, product.description, product.category, ...product.tags, ...Object.values(product.attributes)].join(" ").toLowerCase();
}

export function rankCatalog(intent: BuyerIntent, catalog: Product[]) {
  const queryTerms = `${intent.searchQuery} ${intent.preferences.join(" ")}`.toLowerCase().split(/\W+/).filter(term => term.length > 2);
  return catalog
    .filter(product => product.available && product.inventory > 0)
    .filter(product => !intent.categories.length || intent.categories.includes(product.category))
    .filter(product => !intent.excludedTerms.some(term => searchable(product).includes(term) && !searchable(product).includes(`${term}-free`) && product.attributes.fragrance !== "none"))
    .map(product => ({ product, score: queryTerms.reduce((score, term) => score + (searchable(product).includes(term) ? 2 : 0) + (product.name.toLowerCase().includes(term) ? 3 : 0), 0) + (intent.categories.includes(product.category) ? 4 : 0) + Math.min(3, product.crossSellIds.length) + (product.tags.includes("primary") ? 5 : 0) }))
    .sort((a, b) => b.score - a.score || a.product.pricePaise - b.product.pricePaise)
    .map(item => item.product);
}

export function buildBoundedPlan(intent: BuyerIntent, catalog: Product[], meta: Pick<CommercePlan, "provider" | "model" | "latencyMs" | "usage" | "safeFallback">): CommercePlan {
  const ranked = rankCatalog(intent, catalog);
  const base = ranked[0];
  if (!base) return { intent, items: [], baseTotalPaise: 0, proposedTotalPaise: 0, growthAmountPaise: 0, growthRationale: "No authoritative catalog product satisfied the hard constraints.", ...meta };
  const baseQuantity = Math.min(intent.quantity, base.inventory);
  const baseTotalPaise = base.pricePaise * baseQuantity;
  const items: PlannedItem[] = [{ ...base, quantity: baseQuantity, role: "intent_match", rationale: "Resolved from the buyer's stated category, preferences and budget using an authoritative product ID." }];
  const related = base.crossSellIds.map(id => catalog.find(product => product.id === id)).filter((product): product is Product => Boolean(product?.available && product.inventory > 0));
  const candidate = related.find(product => baseTotalPaise + product.pricePaise <= intent.budgetPaise && !intent.excludedTerms.some(term => searchable(product).includes(term) && product.attributes.fragrance !== "none"));
  if (candidate) items.push({ ...candidate, quantity: 1, role: "growth_proposal", rationale: `Compatible with ${base.name}; remains ₹${((intent.budgetPaise - baseTotalPaise - candidate.pricePaise) / 100).toLocaleString("en-IN")} below the hard budget.` });
  const proposedTotalPaise = items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  return {
    intent,
    items,
    baseTotalPaise,
    proposedTotalPaise,
    growthAmountPaise: proposedTotalPaise - baseTotalPaise,
    growthRationale: candidate ? `Proposed one relevant ${candidate.name}; the cart remains within the buyer's hard mandate and nothing was silently added.` : "No relevant add-on fit the remaining budget; the Growth Agent left the cart unchanged.",
    ...meta,
  };
}

export async function planCommerce(prompt: string, catalog: Product[]): Promise<CommercePlan> {
  const startedAt = Date.now();
  try {
    const extracted = await extractWithOpenAI(prompt);
    return buildBoundedPlan(extracted.intent, catalog, { provider: "openai", model: extracted.model, latencyMs: Date.now() - startedAt, usage: extracted.usage, safeFallback: false });
  } catch {
    return buildBoundedPlan(fallbackBuyerIntent(prompt), catalog, { provider: "deterministic-fallback", model: "fallback-v1", latencyMs: Date.now() - startedAt, usage: null, safeFallback: true });
  }
}
