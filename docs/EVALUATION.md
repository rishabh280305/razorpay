# Growth evaluation

`npm run benchmark` runs a 500-session offline synthetic experiment using seed `20260219`. It emits `evaluation/results.json`.

## Method

Baseline chooses the buyer’s primary product. Treatment considers a compatible add-on only if it fits the same session budget. The buyer population spans weighted skincare, coffee replenishment, employee gifting, running and USB-C charging archetypes. For each shopper, a fixed-seed utility function independently combines recommendation relevance, product compatibility, preference match, add-on budget share and price sensitivity. The acceptance draw is not copied from the Growth Agent rule. It is explicitly a simulation assumption, not observed conversion. Both arms use identical shoppers, budgets and initial selections.

## Latest artifact

| Metric | Result |
|---|---:|
| Baseline GMV | ₹7,43,564 |
| AgentReady GMV | ₹8,24,300 |
| Incremental simulated GMV | ₹80,736 (+10.9%) |
| Baseline AOV | ₹1,487.13 |
| Treatment AOV | ₹1,648.60 |
| Attach rate | 32.8% |
| Eligible recommendation acceptance | 42.9% |
| Budget / policy violations | 0.0% / 0.0% |
| Checkout completion proxy | 88.2% |

The results must be regenerated after changing the model. No benchmark creates Razorpay Orders, Payment Links, invoices or subscriptions.
