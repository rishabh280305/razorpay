# Failure handling

## Primary demo: price drift

1. A buyer approves a ₹1,799 cart with a maximum mandate of ₹2,000.
2. Before execution, a catalog price changes and authoritative recomputation yields ₹2,049.
3. The policy firewall returns `DENY` with `PRICE_CHANGED` and `BUDGET_EXCEEDED`.
4. The state becomes `POLICY_BLOCKED`; no Razorpay order is attempted.
5. The audit records the old amount, fresh amount, mandate hash and reason codes.
6. The buyer can create a new explicit mandate rather than being silently charged.

Other tested guards: duplicate money action requires idempotency and returns the original response; webhook replay hashes deduplicate delivery; malformed structured AI output is rejected at schema validation; impossible workflow transitions throw.
