# Security model

## Non-negotiable boundaries

- `RAZORPAY_KEY_SECRET` and webhook secret are server-only; they are never returned, logged, committed, or placed in `NEXT_PUBLIC_*` variables.
- Browser amounts are non-authoritative. Checkout takes product IDs/quantities, rehydrates catalog values server-side, and computes paise totals deterministically.
- An LLM cannot call a generic payment tool. It only produces bounded candidate intent / explanations; Zod validates structured inputs.
- Every financial action requires an idempotency key and a state-machine-valid transition.

The order adapter derives a deterministic Razorpay receipt from the idempotency key and queries Razorpay before creation. A reused key with a different payload fingerprint is rejected; an identical retry returns the existing Order. The production smoke test confirmed one Order ID across two identical requests. A Postgres unique constraint remains the planned first-write reservation for fully atomic multi-instance concurrency.

## Webhooks and Checkout

The webhook route consumes `request.text()` before JSON parsing, verifies the HMAC against `X-Razorpay-Signature`, rejects bad signatures, and deduplicates the raw-body SHA-256. This preserves Razorpay’s raw-body verification requirement. Checkout signature verification uses the canonical `order_id|payment_id` message.

## Policy engine

Policy returns only `ALLOW`, `DENY`, `REQUIRE_APPROVAL`, plus reason codes: `BUDGET_EXCEEDED`, `PRICE_CHANGED`, `INVENTORY_CHANGED`, `HUMAN_APPROVAL_REQUIRED`, `DUPLICATE_REQUEST`, `MANDATE_EXPIRED`, `CATEGORY_BLOCKED`, `QUANTITY_EXCEEDED`. Price/inventory are checked immediately before a Razorpay action.

## HTTP and operations

Security headers are set globally. API request IDs are passed through. User-facing errors are generic; secrets are absent from logs. Add a durable `webhook_event` uniqueness constraint and distributed rate limiter with Postgres/Redis when `DATABASE_URL` is configured; process-memory dedupe is intentionally only a demo fallback.

## Audit privacy

Audit records store concise evidence summaries, policy result, mandate hash and entity IDs—never LLM chain-of-thought or payment credentials.
