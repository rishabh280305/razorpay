# Growth evaluation

`npm run benchmark` runs a 500-session offline synthetic experiment using seed `20260219`. It emits `evaluation/results.json`.

## Method

Baseline chooses the buyer’s primary product. Treatment considers a narrowly defined compatible add-on only if it fits the same session budget. A deterministic seeded utility model accepts some relevant, compatible proposals; it is explicitly an assumption, not observed conversion. Both arms use identical synthetic sessions, budgets and initial selections.

## Latest artifact

| Metric | Result |
|---|---:|
| Baseline GMV | ₹3,68,600 |
| AgentReady GMV | ₹4,15,924 |
| Incremental simulated GMV | ₹47,324 (+12.8%) |
| Baseline AOV | ₹737.20 |
| Treatment AOV | ₹831.85 |
| Attach / acceptance rate | 15.2% |
| Budget / policy violations | 0.0% / 0.0% |
| Checkout completion proxy | 91.4% |

The results must be regenerated after changing the model. No benchmark creates Razorpay Orders, Payment Links, invoices or subscriptions.
