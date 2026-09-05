CREATE TABLE "agent_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"state" text NOT NULL,
	"channel" text NOT NULL,
	"request_id" text NOT NULL,
	"buyer_prompt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"actor" text NOT NULL,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"amount_before_paise" integer,
	"amount_after_paise" integer,
	"mandate_hash" text,
	"previous_hash" text NOT NULL,
	"current_hash" text NOT NULL,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_current_hash_unique" UNIQUE("current_hash")
);
--> statement-breakpoint
CREATE TABLE "benchmark_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"seed" integer NOT NULL,
	"sessions" integer NOT NULL,
	"baseline_gmv_paise" integer NOT NULL,
	"treatment_gmv_paise" integer NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_session_id" text,
	"protocol" text NOT NULL,
	"state" text NOT NULL,
	"line_items" jsonb NOT NULL,
	"authoritative_total_paise" integer NOT NULL,
	"policy_decision" text NOT NULL,
	"reason_codes" jsonb NOT NULL,
	"request_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commerce_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"checkout_session_id" text,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"state" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"mandate_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_orders_razorpay_order_id_unique" UNIQUE("razorpay_order_id"),
	CONSTRAINT "commerce_orders_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id"),
	CONSTRAINT "commerce_orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"key" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"status" text NOT NULL,
	"response" jsonb,
	"razorpay_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"canonical_payload" jsonb NOT NULL,
	"canonical_hash" text NOT NULL,
	"max_amount_paise" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"price_paise" integer NOT NULL,
	"cost_paise" integer NOT NULL,
	"inventory" integer NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_hash" text NOT NULL,
	"razorpay_event" text NOT NULL,
	"razorpay_entity_id" text,
	"signature_verified" boolean NOT NULL,
	"handling_status" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_hash_unique" UNIQUE("event_hash")
);
--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_agent_session_id_agent_sessions_id_fk" FOREIGN KEY ("agent_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_checkout_session_id_checkout_sessions_id_fk" FOREIGN KEY ("checkout_session_id") REFERENCES "public"."checkout_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_merchant_created_idx" ON "agent_sessions" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_session_created_idx" ON "audit_events" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_idempotency_uidx" ON "checkout_sessions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "products_merchant_sku_uidx" ON "products" USING btree ("merchant_id","sku");--> statement-breakpoint
CREATE INDEX "products_merchant_category_idx" ON "products" USING btree ("merchant_id","category");