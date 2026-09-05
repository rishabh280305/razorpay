import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import { getDb } from "./client";
import { agentSessions, auditEvents, checkoutSessions, commerceOrders, idempotencyRecords, mandates, merchants, products as productsTable, webhookEvents } from "./schema";
import { merchant, products } from "@/lib/catalog";
import type { Product } from "@/lib/types";

function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`; return JSON.stringify(value); }
function persistentAuditHash(payload: object, previousHash: string) { return createHash("sha256").update(`${canonicalJson(payload)}${previousHash}`).digest("hex"); }

export async function claimIdempotency(key: string, fingerprint: string) {
  const db = getDb(); if (!db) return { kind: "unavailable" as const };
  const inserted = await db.insert(idempotencyRecords).values({ key, fingerprint, status: "PENDING" }).onConflictDoNothing().returning();
  if (inserted.length) return { kind: "claimed" as const };
  const [existing] = await db.select().from(idempotencyRecords).where(eq(idempotencyRecords.key, key)).limit(1);
  if (!existing) return { kind: "in_progress" as const };
  if (existing.fingerprint !== fingerprint) return { kind: "conflict" as const };
  if (existing.status === "COMPLETED" && existing.response) return { kind: "replay" as const, response: existing.response };
  return { kind: "in_progress" as const, razorpayOrderId: existing.razorpayOrderId };
}
export async function completeIdempotency(key: string, razorpayOrderId: string, response: object) { const db = getDb(); if (!db) return; await db.update(idempotencyRecords).set({ status: "COMPLETED", razorpayOrderId, response, updatedAt: new Date() }).where(eq(idempotencyRecords.key, key)); }
export async function persistCheckoutContext(input: { key: string; requestId: string; mandate: { id: string; canonicalHash: string; maxAmountPaise: number; expiresAt: string }; mandatePayload: object; items: object[]; totalPaise: number; policyDecision: string; reasonCodes: string[]; channel?: string; approved?: boolean }) { const db = getDb(); if (!db) return null; await seedCatalog(); const stable = createHash("sha256").update(input.key).digest("hex").slice(0, 20); const sessionId = `sess_${stable}`; const checkoutId = `chk_${stable}`; const state = input.policyDecision === "DENY" ? "POLICY_BLOCKED" : input.policyDecision === "REQUIRE_APPROVAL" && input.approved !== true ? "AWAITING_APPROVAL" : "AUTHORIZED"; await db.transaction(async tx => { await tx.insert(agentSessions).values({ id: sessionId, merchantId: merchant.id, state, channel: input.channel ?? "web", requestId: input.requestId }).onConflictDoNothing(); await tx.insert(mandates).values({ id: input.mandate.id, sessionId, canonicalPayload: input.mandatePayload, canonicalHash: input.mandate.canonicalHash, maxAmountPaise: input.mandate.maxAmountPaise, expiresAt: new Date(input.mandate.expiresAt), approved: input.approved === true }).onConflictDoNothing(); await tx.insert(checkoutSessions).values({ id: checkoutId, agentSessionId: sessionId, protocol: input.channel ?? "web", state, lineItems: input.items, authoritativeTotalPaise: input.totalPaise, policyDecision: input.policyDecision, reasonCodes: input.reasonCodes, requestId: input.requestId, idempotencyKey: input.key }).onConflictDoNothing(); }); return { sessionId, checkoutId }; }
export async function getCheckoutContext(id: string) { const db = getDb(); if (!db) return null; const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1); if (!checkout) return null; const [mandate] = checkout.agentSessionId ? await db.select().from(mandates).where(eq(mandates.sessionId, checkout.agentSessionId)).limit(1) : []; return { checkout, mandate }; }
export async function updateCheckoutContext(id: string, input: { state: string; lineItems?: object[]; totalPaise?: number; policyDecision?: string; reasonCodes?: string[]; approved?: boolean }) { const db = getDb(); if (!db) return false; const [updated] = await db.update(checkoutSessions).set({ state: input.state, ...(input.lineItems ? { lineItems: input.lineItems } : {}), ...(input.totalPaise !== undefined ? { authoritativeTotalPaise: input.totalPaise } : {}), ...(input.policyDecision ? { policyDecision: input.policyDecision } : {}), ...(input.reasonCodes ? { reasonCodes: input.reasonCodes } : {}), updatedAt: new Date() }).where(eq(checkoutSessions.id, id)).returning({ agentSessionId: checkoutSessions.agentSessionId }); if (!updated) return false; if (updated.agentSessionId) { await db.update(agentSessions).set({ state: input.state, updatedAt: new Date() }).where(eq(agentSessions.id, updated.agentSessionId)); if (input.approved !== undefined) await db.update(mandates).set({ approved: input.approved }).where(eq(mandates.sessionId, updated.agentSessionId)); } return true; }
export async function persistOrder(input: { razorpayOrderId: string; amountPaise: number; idempotencyKey: string; mandateHash: string; checkoutSessionId?: string }) { const db = getDb(); if (!db) return; await db.insert(commerceOrders).values({ id: `ord_${randomUUID()}`, checkoutSessionId: input.checkoutSessionId, razorpayOrderId: input.razorpayOrderId, state: "RAZORPAY_ORDER_CREATED", amountPaise: input.amountPaise, idempotencyKey: input.idempotencyKey, mandateHash: input.mandateHash }).onConflictDoNothing(); }
export async function persistWebhook(input: { id: string; eventHash: string; event: string; entityId?: string; payload: object }) { const db = getDb(); if (!db) return { duplicate: false }; const inserted = await db.insert(webhookEvents).values({ id: input.id, eventHash: input.eventHash, razorpayEvent: input.event, razorpayEntityId: input.entityId, signatureVerified: true, handlingStatus: "PROCESSED", payload: input.payload }).onConflictDoNothing().returning({ id: webhookEvents.id }); return { duplicate: inserted.length === 0 }; }
export async function seedCatalog() {
  const db = getDb();
  if (!db) return false;
  await db.insert(merchants).values(merchant).onConflictDoNothing();
  await db.insert(productsTable).values(products.map(product => ({
    id: product.id,
    merchantId: merchant.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    pricePaise: product.pricePaise,
    costPaise: product.costPaise,
    inventory: product.inventory,
    attributes: product.attributes,
    metadata: { tags: product.tags, crossSellIds: product.crossSellIds, subscriptionEligible: product.subscriptionEligible, available: product.available, compareAtPaise: product.compareAtPaise, image: product.image },
  }))).onConflictDoNothing();
  return true;
}

function productFromRow(row: typeof productsTable.$inferSelect): Product {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    pricePaise: row.pricePaise,
    compareAtPaise: typeof metadata.compareAtPaise === "number" ? metadata.compareAtPaise : undefined,
    costPaise: row.costPaise,
    inventory: row.inventory,
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === "string") : [],
    attributes: (row.attributes ?? {}) as Record<string, string>,
    image: typeof metadata.image === "string" ? metadata.image : "◈",
    crossSellIds: Array.isArray(metadata.crossSellIds) ? metadata.crossSellIds.filter((id): id is string => typeof id === "string") : [],
    subscriptionEligible: metadata.subscriptionEligible === true,
    available: metadata.available !== false && row.inventory > 0,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getCatalogProducts(ids?: string[]): Promise<Product[]> {
  const db = getDb();
  if (!db) return ids?.length ? products.filter(product => ids.includes(product.id)) : products;
  await seedCatalog();
  const rows = ids?.length
    ? await db.select().from(productsTable).where(inArray(productsTable.id, ids))
    : await db.select().from(productsTable).where(eq(productsTable.merchantId, merchant.id)).orderBy(asc(productsTable.name));
  return rows.map(productFromRow);
}

export async function upsertCatalogProducts(input: Product[]) {
  const db = getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(merchants).values(merchant).onConflictDoNothing();
  for (const product of input) {
    await db.insert(productsTable).values({
      id: product.id,
      merchantId: merchant.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category,
      pricePaise: product.pricePaise,
      costPaise: product.costPaise,
      inventory: product.inventory,
      attributes: product.attributes,
      metadata: { tags: product.tags, crossSellIds: product.crossSellIds, subscriptionEligible: product.subscriptionEligible, available: product.available, compareAtPaise: product.compareAtPaise, image: product.image },
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: productsTable.id,
      set: { sku: product.sku, name: product.name, description: product.description, category: product.category, pricePaise: product.pricePaise, costPaise: product.costPaise, inventory: product.inventory, attributes: product.attributes, metadata: { tags: product.tags, crossSellIds: product.crossSellIds, subscriptionEligible: product.subscriptionEligible, available: product.available, compareAtPaise: product.compareAtPaise, image: product.image }, updatedAt: new Date() },
    });
  }
  return getCatalogProducts(input.map(product => product.id));
}
export async function getOperationalMetrics() { const db = getDb(); if (!db) return null; const orders = await db.select().from(commerceOrders).orderBy(desc(commerceOrders.createdAt)).limit(50); const events = await db.select().from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(50); const audits = await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(100); const sessions = await db.select().from(agentSessions).orderBy(desc(agentSessions.createdAt)).limit(100); const checkouts = await db.select().from(checkoutSessions).orderBy(desc(checkoutSessions.createdAt)).limit(100); const mandateRows = await db.select().from(mandates).orderBy(desc(mandates.createdAt)).limit(100); return { orders, webhookEvents: events, auditEvents: audits, sessions, checkouts, counts: { testOrders: orders.length, successfulTestPayments: orders.filter(order => ["PAYMENT_CAPTURED", "ORDER_CONFIRMED", "COMPLETED"].includes(order.state)).length, failedTransactions: orders.filter(order => order.state === "PAYMENT_FAILED").length, webhookEvents: events.length, auditEvents: audits.length, testOrderValuePaise: orders.reduce((sum, order) => sum + order.amountPaise, 0), shoppingSessions: sessions.length, pendingApprovals: mandateRows.filter(mandate => !mandate.approved && mandate.expiresAt > new Date()).length, policyBlocked: checkouts.filter(checkout => checkout.state === "POLICY_BLOCKED").length, protocolSessions: checkouts.filter(checkout => checkout.protocol === "acp" || checkout.protocol === "mcp").length } }; }
export async function persistAgentPlan(input: { sessionId: string; requestId: string; buyerPrompt: string; state: string }) { const db = getDb(); if (!db) return; await seedCatalog(); await db.insert(agentSessions).values({ id: input.sessionId, merchantId: merchant.id, state: input.state, channel: "buyer-agent", requestId: input.requestId, buyerPrompt: input.buyerPrompt.slice(0, 1500) }).onConflictDoNothing(); }
export async function persistApprovedMandate(input: { sessionId: string; requestId: string; mandate: { id: string; canonicalHash: string; maxAmountPaise: number; expiresAt: string }; canonicalPayload: object }) { const db = getDb(); if (!db) return false; await seedCatalog(); await db.insert(agentSessions).values({ id: input.sessionId, merchantId: merchant.id, state: "AUTHORIZED", channel: "buyer-agent", requestId: input.requestId }).onConflictDoUpdate({ target: agentSessions.id, set: { state: "AUTHORIZED", updatedAt: new Date() } }); await db.insert(mandates).values({ id: input.mandate.id, sessionId: input.sessionId, canonicalPayload: input.canonicalPayload, canonicalHash: input.mandate.canonicalHash, maxAmountPaise: input.mandate.maxAmountPaise, expiresAt: new Date(input.mandate.expiresAt), approved: true }).onConflictDoNothing(); return true; }
export async function isMandateApproved(id: string, canonicalHash: string) { const db = getDb(); if (!db) return false; const [record] = await db.select().from(mandates).where(eq(mandates.id, id)).limit(1); return Boolean(record?.approved && record.canonicalHash === canonicalHash && record.expiresAt > new Date()); }
export async function pingDb() { const db = getDb(); if (!db) return false; try { await db.execute(sql`select 1`); return true; } catch { return false; } }
export async function applyWebhookOrderState(razorpayOrderId: string | undefined, event: string) { const db = getDb(); if (!db || !razorpayOrderId) return; const state = event === "payment.captured" ? "PAYMENT_CAPTURED" : event === "order.paid" ? "ORDER_CONFIRMED" : event === "payment.failed" ? "PAYMENT_FAILED" : event === "payment.authorized" ? "PAYMENT_AUTHORIZED" : null; if (state) await db.update(commerceOrders).set({ state, updatedAt: new Date() }).where(eq(commerceOrders.razorpayOrderId, razorpayOrderId)); }
export async function appendPersistentAudit(input: { sessionId?: string; actor: string; actorType: string; action: string; evidence: object; amountBeforePaise?: number; amountAfterPaise?: number; mandateHash?: string; requestId: string }) {
  const db = getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('agentready_audit_chain'))`);
    const [previous] = await tx.select({ currentHash: auditEvents.currentHash }).from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(1);
    const previousHash = previous?.currentHash ?? "GENESIS";
    const id = randomUUID();
    const createdAt = new Date();
    const payload = { id, sessionId: input.sessionId ?? null, actor: input.actor, actorType: input.actorType, action: input.action, evidence: input.evidence, amountBeforePaise: input.amountBeforePaise ?? null, amountAfterPaise: input.amountAfterPaise ?? null, mandateHash: input.mandateHash ?? null, requestId: input.requestId, createdAt: createdAt.toISOString() };
    const currentHash = persistentAuditHash(payload, previousHash);
    await tx.insert(auditEvents).values({ ...payload, createdAt, previousHash, currentHash });
    return { id, previousHash, currentHash };
  });
}
export async function verifyPersistentAudit() { const db = getDb(); if (!db) return { available: false, total: 0, valid: 0, intact: false }; const events = await db.select().from(auditEvents).orderBy(asc(auditEvents.createdAt)); let previousHash = "GENESIS"; let valid = 0; let tamperedIndex: number | null = null; for (let index = 0; index < events.length; index++) { const event = events[index]; const payload = { id: event.id, sessionId: event.sessionId, actor: event.actor, actorType: event.actorType, action: event.action, evidence: event.evidence, amountBeforePaise: event.amountBeforePaise, amountAfterPaise: event.amountAfterPaise, mandateHash: event.mandateHash, requestId: event.requestId, createdAt: event.createdAt.toISOString() }; let expected = persistentAuditHash(payload, previousHash); if (event.currentHash !== expected) { const source = event.evidence as Record<string, unknown>; const evidence = event.action.startsWith("razorpay.order") ? { razorpayOrderId: source.razorpayOrderId, policyDecision: source.policyDecision, reasonCodes: source.reasonCodes, idempotentReplay: source.idempotentReplay } : { entityId: source.entityId, orderId: source.orderId, signatureVerified: source.signatureVerified }; expected = createHash("sha256").update(`${JSON.stringify({ ...payload, evidence })}${previousHash}`).digest("hex"); } if (event.previousHash !== previousHash || event.currentHash !== expected) { tamperedIndex = index; break; } valid++; previousHash = event.currentHash; } return { available: true, total: events.length, valid, intact: valid === events.length, tamperedIndex }; }
