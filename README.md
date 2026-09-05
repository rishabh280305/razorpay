# AGENTREADY

> **Turn any Razorpay merchant into a safe, AI-buyable storefront.**

AGENTREADY is a full-stack agentic-commerce control plane for the Razorpay AI Buildathon, Track 01 — **AI Growth & Agentic Commerce**. It deliberately separates intelligence from authority:

**AI proposes. Authoritative data verifies. Policy authorizes. Razorpay executes. Webhooks confirm. Audit records.**

**Public demo:** https://agentready-beige.vercel.app

![AgentReady control plane](public/agentready-hero.png)

## 30-second walkthrough

1. A buyer describes a bounded intent: “sensitive-skin routine under ₹2,000; no fragrance.”
2. The Buyer Agent turns it into constraints and resolves real catalog IDs; the Growth Agent proposes a complementary product but never adds it silently.
3. Before money moves, the server re-reads price/inventory, evaluates a buyer mandate in deterministic code, then either allows, denies, or requires approval.
4. Only an authorized cart can create a server-side Razorpay **TEST Mode** Order. Checkout signature and raw-body webhook verification complete the evidence chain.
5. The Audit Trail and Chaos Lab make every decision—and a blocked price-drift failure—inspectable.

## Product scope and truthful status

The production deployment uses OpenAI Structured Outputs for intent extraction, a server-side bounded growth planner, Neon Postgres as the authoritative catalog and commerce ledger, Razorpay TEST Orders/Checkout/Payment Links, a durable ACP checkout lifecycle, an MCP tool surface, and a tamper-evident audit chain. Every AI response has a deterministic safe fallback.

Razorpay TEST Orders and Payment Links have been exercised against production. A captured Checkout payment and real webhook delivery still require a manual TEST checkout plus Razorpay dashboard webhook secret. The UI therefore reports zero successful payments and zero verified webhooks until those events actually occur. No fake payment, webhook, protocol certification, or merchant revenue claim is made. See [docs/BUILD_STATE.md](docs/BUILD_STATE.md).

## Architecture

```mermaid
flowchart LR
  B[Buyer / AI Agent] --> I[Structured Intent]
  I --> C[Authoritative Catalog]
  C --> G[Growth Agent Proposal]
  G --> M[Hash-bound Buyer Mandate]
  M --> P{Deterministic Policy Firewall}
  P -->|DENY| A[Append-only Audit]
  P -->|REQUIRE_APPROVAL| H[Human Approval]
  H --> P
  P -->|ALLOW| R[Razorpay TEST Order + Checkout]
  R --> W[Verified raw-body Webhook]
  W --> A
```

### Trust boundary

| Responsibility | AI may do it | Deterministic server code must do it |
|---|---:|---:|
| Extract intent / explain bundle | Yes | Validates output schema |
| Product discovery | Yes | Resolves product IDs from catalog |
| Price, tax, inventory, totals | No | Yes |
| Spend authorization | No | Yes: mandate + policy |
| Razorpay order / checkout | No | Yes, server-side only |
| Signature, idempotency, transitions | No | Yes |

## Features

- Premium responsive command center with clear **synthetic vs. real TEST Mode** labels.
- Authoritative Neon catalog with twelve realistic products, integer-paise money, category/tag/attribute search, cross-sell relationships, authenticated JSON ingestion and client CSV/JSON validation; raw [catalog feed](/api/catalog/feed).
- Live OpenAI buyer intent extraction through schema-constrained Responses API output, timeout/retry bounds, cost metadata and a deterministic parser fallback.
- Growth Agent planner that may propose only authoritative IDs and only within buyer budget; proposed, authorized and executed carts remain visually distinct.
- Deterministic controls for transaction and daily ceilings, item price, categories, quantity, expiry, approval, margin, absolute/relative upsell, inventory/catalog freshness, price drift, recurring permission, identity, cooldown, automated attempts and duplicate execution.
- Hash-bound mandate and append-only SHA-256 audit-chain primitives.
- Explicit finite-state commerce transition guard.
- Razorpay TEST Mode adapter: Orders, Checkout signature utility, HMAC-SHA256 raw webhook verification, replay protection.
- Discoverable MCP Streamable HTTP JSON-RPC tools, OpenAPI 3.1 contract, and protected Payment Links.
- Durable ACP implementation profile: versioned checkout sessions, request IDs, Neon-backed idempotency and lifecycle endpoints; no claim of certification.
- Protocol Lab, Agent Readiness scorecard, Judge Mode, command palette, Audit Trail, and a server-executed Price Drift Chaos Lab.
- Fixed-seed offline evaluation generated into `evaluation/results.json`.

## Razorpay integration

The integration is intentionally TEST MODE only. `POST /api/checkout/order` derives the final amount from product IDs on the server, requires `Idempotency-Key`, evaluates policy, and only then calls Razorpay Orders. The browser never supplies an authoritative amount or uses `KEY_SECRET`.

Production smoke verification created a ₹1,498 TEST Order and ₹1,498 TEST Payment Link. A duplicate request with the same idempotency key returned the same Razorpay Order ID. No payment was captured during this automated smoke test.

Webhook endpoint: `POST /api/webhooks/razorpay`

- reads the unmodified raw request body;
- validates `X-Razorpay-Signature` using HMAC SHA-256 and `RAZORPAY_WEBHOOK_SECRET`;
- deduplicates the body hash before handling;
- rejects bad signatures with `401`.

For standard Checkout, client completion is only a UX signal. Server verification and Razorpay’s webhook are the source of final state. Reference: [Razorpay webhooks](https://razorpay.com/docs/webhooks/).

## Protocols

**ACP.** The adapter follows the current stable ACP checkout-session shape at `/api/acp/checkout_sessions`: create, retrieve, update, complete, cancel, version header, request ID and idempotency. ACP remains beta; AGENTREADY labels this implementation as an **ACP implementation profile**, not a certification. See [docs/ACP.md](docs/ACP.md) and the [official ACP repository](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol).

**AP2.** A canonical intent/mandate hash is linked to policy and payment evidence, inspired by AP2’s Checkout Mandate / Receipt model. This is **AP2 compatibility concept only**, not official certification. [AP2 specification](https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/specification.md).

**MCP.** `/api/mcp` implements Streamable HTTP JSON-RPC discovery plus bounded `search_products`, `get_product`, `recommend_bundle` and `evaluate_checkout` tools. It reads the same Neon catalog; payment execution is deliberately absent. **x402/UAP:** neither is treated as Razorpay settlement; UAP is not claimed as implemented due to insufficient public specification reviewed for this submission.

## Growth evaluation

`npm run benchmark` evaluates 500 synthetic, fixed-seed (`20260219`) sessions. Both baseline and treatment use the same buyer population. The treatment adds only compatible, budget-fitting proposals; simulated acceptance is a documented utility model—not self-reported revenue.

Current generated result: baseline GMV **₹3,68,600**, AgentReady GMV **₹4,15,924**, incremental simulated GMV **₹47,324 (+12.8%)**, attach rate **15.2%**, budget/policy violations **0.0%**. Full methodology: [docs/EVALUATION.md](docs/EVALUATION.md).

## Failure demo

Run **Chaos Lab → Run server failure demo**. The server evaluates an approved ₹1,799 cart after its authoritative value changes to ₹2,049 against a ₹2,000 mandate. It returns HTTP `409`, `DENY`, `PRICE_CHANGED`, `BUDGET_EXCEEDED`, an explicit `razorpayActionCreated: false`, and appends the denial to Neon. More: [docs/FAILURE_HANDLING.md](docs/FAILURE_HANDLING.md).

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

The demo works without credentials. Add TEST credentials only to unlock actual Razorpay calls. Do not add live keys or commit `.env.local`.

## Environment variables

| Variable | Required for | Exposure |
|---|---|---|
| `RAZORPAY_KEY_ID` | TEST Orders | Server only (test key ID may be selectively returned for Checkout) |
| `RAZORPAY_KEY_SECRET` | Orders/signature validation | Server only |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC | Server only |
| `DATABASE_URL` | Durable persistence | Server only |
| `OPENAI_API_KEY` | Hosted structured AI | Server only |
| `OPENAI_MODEL` | Model override; defaults to `gpt-5.4-mini` | Server only |
| `CATALOG_ADMIN_KEY` | Authenticated catalog writes | Server only |
| `NEXT_PUBLIC_APP_URL` | Absolute callback URLs | Public |

## Commands and testing

```bash
npm run typecheck             # strict TypeScript
npm test                      # pure safety tests, mocked integrations
npm run benchmark             # deterministic offline artifact
npm run build                 # CI / Vercel build
```

Fourteen tests cover policy decisions, extended controls, price drift, approval thresholds, mandate canonicalization, authoritative ID resolution, bounded growth, no-upsell behavior, transitions, audit tampering, deterministic evaluation and raw-body webhook verification. External OpenAI and Razorpay APIs are not required for normal CI.

## API surface

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Non-secret readiness state |
| `GET /api/catalog/feed` | Agent-readable catalog |
| `GET /api/catalog` | Authoritative catalog records and source |
| `POST /api/catalog` | Admin-key protected JSON upsert |
| `POST /api/ai/plan` | Schema-validated intent + bounded commerce plan |
| `POST /api/chaos/price-drift` | Server-side safe failure exercise |
| `POST /api/checkout/order` | Policy-gated Razorpay TEST Order |
| `POST /api/checkout/verify` | Verify Checkout success signature server-side |
| `POST /api/payment-links` | Policy-gated Razorpay TEST Payment Link |
| `POST /api/webhooks/razorpay` | Verified, idempotent Razorpay event intake |
| `GET/POST /api/mcp` | Discoverable MCP Streamable HTTP tool server |
| `GET /api/openapi` | OpenAPI 3.1 developer contract |
| `POST /api/acp/checkout_sessions` | ACP-profile create session |
| `GET/PATCH /api/acp/checkout_sessions/:id` | Retrieve/update session |
| `POST /api/acp/checkout_sessions/:id/complete` | Policy-gated completion |
| `POST /api/acp/checkout_sessions/:id/cancel` | Cancel session |

Example ACP create request:

```json
{
  "line_items": [{ "product_id": "p_cleanser", "quantity": 1 }],
  "proposed_total_paise": 59900,
  "mandate": { "id": "mandate_01", "merchantId": "m_demo", "maxAmountPaise": 200000, "categories": ["skincare"], "maxQuantity": 5, "expiresAt": "2030-01-01T00:00:00.000Z", "recurringAllowed": false, "approvalThresholdPaise": 100000, "canonicalHash": "sha256-value" }
}
```

## Repository guide

```text
src/app/api/       versioned adapters and secure routes
src/lib/           policy, state machine, audit, catalog, Razorpay boundary
src/components/    shared product UI
evaluation/        generated offline benchmark artifact
docs/              architecture, security, protocol, demo and pitch material
```

Read [Architecture](docs/ARCHITECTURE.md), [Security](docs/SECURITY.md), [Demo Script](docs/DEMO_SCRIPT.md), and [Pitch](docs/PITCH.md) for judging.

## Limitations and next steps

- The public deployment is a single demo merchant and intentionally omits end-user authentication; catalog mutation is therefore admin-key protected rather than exposed in the browser.
- OpenAI is used for bounded intent extraction, not payment decisions. A model/API failure falls back to deterministic parsing and is labeled in the UI.
- Razorpay subscriptions, invoices and refunds are intentionally not faked. Payment Links are enabled and TEST-account verified; refunds remain approval-gated future scope until a captured TEST payment exists.
- No claim of ACP/AP2 certification, UAP compliance, x402 settlement, or live payment processing is made.

## What broke, and what we fixed

- **Duplicate Vercel execution:** process memory did not protect idempotency across functions. We moved claims to a unique Neon ledger and added Razorpay receipt reconciliation; repeated payloads now return one Order.
- **Audit verification after JSONB persistence:** Postgres reordered nested evidence keys. We replaced shallow serialization with recursive canonical JSON and retained a compatibility verifier for the original smoke event.
- **Serverless ACP sessions:** an in-memory map could disappear between lifecycle calls. ACP create/read/update/complete/cancel now use the same durable checkout tables as web checkout.
- **Scripted AI experience:** the initial UX animated static constraints. The production route now invokes schema-constrained OpenAI output, validates it with Zod, resolves only Neon product IDs, and visibly labels fallback behavior.

## License

MIT. See [LICENSE](LICENSE).
