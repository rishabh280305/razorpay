import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const merchants = pgTable("merchants", {
  id: text("id").primaryKey(), name: text("name").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const products = pgTable("products", {
  id: text("id").primaryKey(), merchantId: text("merchant_id").notNull().references(() => merchants.id), sku: text("sku").notNull(), name: text("name").notNull(), description: text("description").notNull(), category: text("category").notNull(), pricePaise: integer("price_paise").notNull(), costPaise: integer("cost_paise").notNull(), inventory: integer("inventory").notNull(), attributes: jsonb("attributes").notNull().default({}), metadata: jsonb("metadata").notNull().default({}), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex("products_merchant_sku_uidx").on(table.merchantId, table.sku), index("products_merchant_category_idx").on(table.merchantId, table.category)]);
export const agentSessions = pgTable("agent_sessions", {
  id: text("id").primaryKey(), merchantId: text("merchant_id").notNull().references(() => merchants.id), state: text("state").notNull(), channel: text("channel").notNull(), requestId: text("request_id").notNull(), buyerPrompt: text("buyer_prompt"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, table => [index("sessions_merchant_created_idx").on(table.merchantId, table.createdAt)]);
export const mandates = pgTable("mandates", {
  id: text("id").primaryKey(), sessionId: text("session_id").references(() => agentSessions.id), canonicalPayload: jsonb("canonical_payload").notNull(), canonicalHash: text("canonical_hash").notNull(), maxAmountPaise: integer("max_amount_paise").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), approved: boolean("approved").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const checkoutSessions = pgTable("checkout_sessions", {
  id: text("id").primaryKey(), agentSessionId: text("agent_session_id").references(() => agentSessions.id), protocol: text("protocol").notNull(), state: text("state").notNull(), lineItems: jsonb("line_items").notNull(), authoritativeTotalPaise: integer("authoritative_total_paise").notNull(), policyDecision: text("policy_decision").notNull(), reasonCodes: jsonb("reason_codes").notNull(), requestId: text("request_id").notNull(), idempotencyKey: text("idempotency_key").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex("checkout_idempotency_uidx").on(table.idempotencyKey)]);
export const commerceOrders = pgTable("commerce_orders", {
  id: text("id").primaryKey(), checkoutSessionId: text("checkout_session_id").references(() => checkoutSessions.id), razorpayOrderId: text("razorpay_order_id").unique(), razorpayPaymentId: text("razorpay_payment_id").unique(), state: text("state").notNull(), amountPaise: integer("amount_paise").notNull(), idempotencyKey: text("idempotency_key").notNull().unique(), mandateHash: text("mandate_hash").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const idempotencyRecords = pgTable("idempotency_records", {
  key: text("key").primaryKey(), fingerprint: text("fingerprint").notNull(), status: text("status").notNull(), response: jsonb("response"), razorpayOrderId: text("razorpay_order_id"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), eventHash: text("event_hash").notNull().unique(), razorpayEvent: text("razorpay_event").notNull(), razorpayEntityId: text("razorpay_entity_id"), signatureVerified: boolean("signature_verified").notNull(), handlingStatus: text("handling_status").notNull(), payload: jsonb("payload").notNull(), receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow()
});
export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(), sessionId: text("session_id"), actor: text("actor").notNull(), actorType: text("actor_type").notNull(), action: text("action").notNull(), evidence: jsonb("evidence").notNull(), amountBeforePaise: integer("amount_before_paise"), amountAfterPaise: integer("amount_after_paise"), mandateHash: text("mandate_hash"), previousHash: text("previous_hash").notNull(), currentHash: text("current_hash").notNull().unique(), requestId: text("request_id").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, table => [index("audit_session_created_idx").on(table.sessionId, table.createdAt)]);
export const benchmarkRuns = pgTable("benchmark_runs", {
  id: text("id").primaryKey(), seed: integer("seed").notNull(), sessions: integer("sessions").notNull(), baselineGmvPaise: integer("baseline_gmv_paise").notNull(), treatmentGmvPaise: integer("treatment_gmv_paise").notNull(), result: jsonb("result").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
