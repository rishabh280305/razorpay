# Submission answers

## Project Objectives — What does it solve?

Karatsuba turns a conventional online merchant into a storefront that AI agents can safely understand and transact with. Today, an AI assistant can recommend products, but allowing it to execute commerce creates serious problems: the model may use stale prices, hallucinate inventory, exceed a buyer’s budget, duplicate a payment request or provide no evidence for why a transaction was allowed.

Karatsuba separates intelligence from financial authority. A Buyer Agent converts natural-language requests into validated constraints. A merchant-side Growth Agent proposes relevant bundles and cross-sells with explicit rationale while staying inside the buyer’s hard budget. The server then resolves real product IDs from Neon, re-reads price and inventory, calculates money in integer paise and evaluates a deterministic policy firewall. Depending on the result, the transaction is allowed, denied or paused for a hash-bound human approval. Only authorized requests can reach Razorpay TEST Mode.

The product exposes agent-readable catalog, ACP checkout-session and MCP tool surfaces; supports Razorpay Orders, Checkout, Payment Links and Invoices; verifies Checkout and webhook signatures; prevents replay and duplicate execution; persists an explicit commerce state machine; and records consequential decisions in a tamper-evident SHA-256 audit chain. A fixed-seed 500-session evaluation also measures whether the Growth Agent improves merchant outcomes without violating buyer constraints.

## Build Challenges & Technical Obstacles

The first challenge was keeping an LLM useful without allowing it to become a payment authority. Structured model output can still be malformed or use categories that do not match the merchant taxonomy. We constrained output with a schema, validated it with Zod, normalized it into the catalog taxonomy and added timeout, bounded retry and deterministic fallback behavior. The model produces intent and explanations only; all financial calculations remain deterministic.

The second challenge was serverless correctness. In-memory idempotency and ACP session state can disappear or split across Vercel function instances. We moved sessions, mandates and idempotency claims to Neon Postgres, added unique indexes and deterministic IDs, fingerprinted each request payload, and reconciled deterministic receipts with Razorpay before creating another Order. Identical retries return the first result, while reuse with a different payload is rejected.

The third challenge was proving user authorization. A browser boolean such as `approved: true` can be forged. Karatsuba canonicalizes the mandate—including merchant, maximum amount, categories, quantity, recurring permission and expiration—hashes it with SHA-256 and stores the approved payload. Every financial route recomputes the hash and requires the same non-expired database record.

Webhook handling required preserving the exact raw request body for HMAC verification. The endpoint reads raw text before parsing, verifies `X-Razorpay-Signature`, stores a unique body hash to block replay and applies only valid state transitions. Invalid signatures return HTTP 401.

The audit chain exposed another subtle issue: Postgres JSONB can reorder object keys, which initially made persisted events fail hash verification. We introduced recursive canonical JSON serialization and a transaction-scoped Postgres advisory lock so concurrent events cannot create competing chain heads.

Finally, not every Razorpay product is enabled on every TEST account. Instead of faking success, the Invoice flow was production-smoke-tested successfully, while Subscription creation returns a clear `INTEGRATION_UNAVAILABLE` state for this account. Refunds accept no browser amount and remain blocked until a verified captured payment exists. This fail-closed behavior is intentional and visible in the product.
