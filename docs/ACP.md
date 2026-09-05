# ACP and MCP

ACP is currently beta. AGENTREADY uses the latest stable specification reviewed during build: `2026-04-17` from the official Agentic Commerce Protocol repository.

## Implemented ACP profile

| Operation | Route | Guard |
|---|---|---|
| Create | `POST /api/acp/checkout_sessions` | `Idempotency-Key`, request ID, schema, authoritative policy |
| Retrieve | `GET /api/acp/checkout_sessions/:id` | scoped session lookup |
| Update | `PATCH /api/acp/checkout_sessions/:id` | re-evaluates policy |
| Complete | `POST /api/acp/checkout_sessions/:id/complete` | approval and duplicate guard |
| Cancel | `POST /api/acp/checkout_sessions/:id/cancel` | refuses impossible cancellation |

Every adapter action becomes the same normalized commerce session used by the UI. It is not a disconnected “protocol demo.” Payment remains on merchant rails and is only attempted by the Razorpay boundary after authorization.

## MCP connection model

An external MCP server can safely expose `search_products`, `get_product`, `create_cart`, `recommend_bundle`, `create_checkout_session`, `get_checkout_session`, `request_purchase_approval`, `complete_checkout`, and `cancel_checkout`. Each calls the routes above, with per-merchant authentication and the same policy firewall. No MCP tool may accept an arbitrary price, raw Razorpay credential, generic SQL, or unrestricted payment action.

## AP2 / x402 / UAP scope

The mandate hash and receipt evidence are an AP2-inspired compatibility representation. AGENTREADY is not AP2 certified. x402 is not implemented because it is a crypto payment protocol and not a Razorpay settlement substitute. NPCI UAP is labeled only as a future “UAP-ready policy model” because no sufficiently detailed public merchant implementation spec was relied upon.
