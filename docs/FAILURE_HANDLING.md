# Failure handling

## Primary demo: price drift

1. A buyer approves a ₹1,799 cart with a maximum mandate of ₹2,000.
2. Before execution, a catalog price changes and authoritative recomputation yields ₹2,049.
3. The policy firewall returns `DENY` with `PRICE_CHANGED` and `BUDGET_EXCEEDED`.
4. `POST /api/chaos/price-drift` returns HTTP `409` plus `razorpayActionCreated: false`; the Razorpay client is never constructed.
5. The durable audit records the old amount, fresh amount, mandate hash and reason codes.
6. The buyer can create a new explicit mandate rather than being silently charged.

Other tested guards: duplicate money action requires Neon idempotency and returns the original response; webhook replay hashes deduplicate delivery; malformed/unavailable AI falls back to bounded deterministic parsing; impossible workflow transitions throw; identity, attempt, cooldown, margin, recurring and upsell limits return explicit reason codes.
