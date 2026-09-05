# Build state

## Architecture decisions

- Next.js 16 App Router, strict TypeScript, Zod validation, Razorpay Node SDK boundary.
- Neon Postgres is the deployed source of truth for catalog products, sessions, mandates, checkout records, Razorpay entities, webhook replay defense and the append-only audit chain. Money uses integer paise.
- OpenAI Structured Outputs extracts bounded intent. A deterministic parser is the explicit, labeled availability fallback; neither path can authorize payment.
- ACP is an implementation profile against the stable `2026-04-17` specification; AP2 is a compatibility concept, not certification.

## Completed

- [x] Empty requested GitHub repo isolated from unrelated parent repository.
- [x] Premium command center, buyer/growth experience, catalog, policy, protocol, audit, evaluation, chaos and judge surfaces.
- [x] Policy, state-machine, audit hashing, Razorpay signature helpers, ACP session adapter, health/feed endpoints.
- [x] Fixed-seed 500-session benchmark artifact and safety tests.
- [x] Documentation, CI workflow, GitHub push and Vercel production deployment.
- [x] Production Razorpay credentials configured as encrypted server-only values.
- [x] Real TEST Order and Payment Link created; duplicate request returned one Order ID.
- [x] MCP Streamable HTTP server, discovery document and OpenAPI 3.1 endpoint.
- [x] Neon migration applied and production database health verified.
- [x] Durable ACP lifecycle and idempotency moved from process memory to Neon.
- [x] Hosted AI key stored as a sensitive Vercel variable; production Structured Outputs call verified.
- [x] Authenticated catalog API, CSV/JSON validation, 12-product seed and Agent Readiness scorecard.
- [x] Server-side price-drift chaos exercise persists its blocked evidence.
- [x] 14 pure safety/planning tests passing locally.
- [x] Production OpenAI smoke: `gpt-5.4-mini-2026-03-17`, schema-valid intent, authoritative `p_cleanser` + `p_moisturizer`, ₹1,498 total, no fallback.
- [x] Production ACP create/retrieve/replay used one durable checkout ID; chaos denial joined an intact 4/4 audit chain.

## Credentials / manual actions still needed

1. `RAZORPAY_WEBHOOK_SECRET` from the Razorpay **TEST Mode** dashboard to verify real webhook delivery.
2. Configure the test webhook at `https://agentready-beige.vercel.app/api/webhooks/razorpay` for `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`.
3. Complete one manual Razorpay TEST Checkout so payment capture and webhook finality can be honestly marked verified.
4. Optional: set `CATALOG_ADMIN_KEY` to enable authenticated catalog writes (reads and file validation already work).

## Key commands

`npm run typecheck` · `npm test` · `npm run benchmark` · `npm run build`

## Current blocker

Only dashboard webhook configuration and one manual TEST payment block a verified end-to-end receipt. Database, Razorpay TEST Order/Payment Link, and application deployment are active. Public demo: `https://agentready-beige.vercel.app`.
