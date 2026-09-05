# Security model

## Non-negotiable boundaries

- `RAZORPAY_KEY_SECRET` and webhook secret are server-only; they are never returned, logged, committed, or placed in `NEXT_PUBLIC_*` variables.
- Browser amounts are non-authoritative. Checkout takes product IDs/quantities, rehydrates catalog values server-side, and computes paise totals deterministically.
- OpenAI cannot call a generic payment tool. It returns only a Zod-validated intent schema; deterministic code resolves product IDs, constructs a bounded proposal and revalidates all money inputs.
- Every financial action requires an idempotency key and a state-machine-valid transition.
- An `approved: true` browser field is never sufficient authority. Checkout and Payment Links require a non-expired Neon mandate row whose canonical hash exactly matches the recomputed request mandate.

The order adapter atomically claims a unique idempotency record in Neon, derives a deterministic Razorpay receipt, and reconciles with Razorpay before creation. A reused key with a different payload fingerprint is rejected; an identical retry returns the existing Order. Production smoke testing confirmed one Order ID across two identical requests.

## Webhooks and Checkout

The webhook route consumes `request.text()` before JSON parsing, verifies the HMAC against `X-Razorpay-Signature`, rejects bad signatures, and deduplicates the raw-body SHA-256. This preserves Razorpay’s raw-body verification requirement. Checkout signature verification uses the canonical `order_id|payment_id` message.

## Policy engine

Policy returns only `ALLOW`, `DENY`, `REQUIRE_APPROVAL`. It covers transaction/daily spend, item ceiling, price drift, inventory/catalog freshness, approval, duplicates, mandate expiry, categories, quantity, margin, upsell caps, recurring permission, automated attempts, cooldown and agent identity. Price/inventory are queried from Neon immediately before a Razorpay action.

## HTTP and operations

Security headers are set globally. API request IDs are passed through. User-facing errors are generic; structured logs strip key/token/secret/signature/prompt fields. Webhook event hashes and idempotency claims have database uniqueness constraints. The expensive AI route is rate-limited; multi-region production scale would move its short window counter to managed Redis.

Catalog writes require a constant-time checked `x-agentready-admin-key`; the public browser exposes read and validation flows only. OpenAI responses are created with `store: false`, a 12-second timeout and one bounded retry.

## Audit privacy

Audit records store concise evidence summaries, policy result, mandate hash and entity IDs—never LLM chain-of-thought or payment credentials.
The append operation runs inside a Postgres transaction guarded by an advisory lock, so concurrent Vercel functions cannot fork the global hash chain between reading the previous hash and inserting the next event.
