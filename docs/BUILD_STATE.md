# Build state

## Architecture decisions

- Next.js 16 App Router, strict TypeScript, Zod validation, Razorpay Node SDK boundary.
- Demo data is source-controlled and server-authoritative. Money uses integer paise.
- No database or paid AI credential has been assumed. Until configured, the app openly runs a deterministic demo and Vercel’s memory-only API state.
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

## Credentials / manual actions still needed

1. `DATABASE_URL` for Neon/Supabase/Postgres durable records and migrations.
2. `RAZORPAY_WEBHOOK_SECRET` from the Razorpay **TEST Mode** dashboard to verify real webhook delivery.
3. Optional `OPENAI_API_KEY` for provider-backed structured intent extraction.
4. After a stable Vercel deployment, configure Razorpay test webhook at `https://<deployment>/api/webhooks/razorpay` for `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`.

## Key commands

`npm run typecheck` · `npm test` · `npm run benchmark` · `npm run build`

## Current blocker

Razorpay TEST Orders and Payment Links are verified. A managed Postgres URL, hosted AI key, and webhook secret/configuration are still needed for durable records, live model reasoning, and webhook-finalized payment evidence. Public demo: `https://agentready-beige.vercel.app`.
