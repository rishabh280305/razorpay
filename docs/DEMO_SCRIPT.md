# Karatsuba — exact five-minute demo script

Keep the production site open at `https://karatsuba-ai.vercel.app`. Start on **Overview**, use the seeded sensitive-skin prompt, and keep the browser at a readable zoom. Do not spend time explaining every navigation item.

## 0:00–0:25 — Establish the problem

**Show:** Overview hero and execution contract.

**Say:**

> “Online stores are designed for humans, but AI buyers need structured catalogs, explicit authority and machine-verifiable checkout. The unsafe version is just a chatbot with a payment key. Karatsuba is a commerce control plane: AI proposes, authoritative data verifies, deterministic policy authorizes, Razorpay executes, webhooks confirm, and the audit chain records.”

Point briefly to the four proof badges: OpenAI, Neon, Razorpay TEST Mode, ACP and MCP.

## 0:25–0:45 — Separate real and simulated evidence

**Show:** The operational strip and four metric cards.

**Say:**

> “This dashboard deliberately separates real Razorpay TEST-mode entities from synthetic benchmark results. I never represent simulated GMV as merchant revenue. The live counters come from Neon; the growth result comes from a reproducible offline evaluation.”

## 0:45–1:50 — Run the buyer and Growth Agents

**Click:** **Run Live AI Demo**.

Wait for the cart to appear. If the hosted model takes a few seconds, narrate the developer trace.

**Say:**

> “The buyer asks for a fragrance-free sensitive-skin routine under ₹2,000. OpenAI is used where reasoning helps: extracting hard constraints and preferences. Its response is schema-constrained and validated. A timeout, invalid response or provider failure falls back safely—it cannot trigger a payment.”

Point to **Max spend**, **Exclude**, **Category**, **Quantity**, and the model/latency badge. Then point to the cart.

> “The model does not invent price or stock. Product IDs resolve against the authoritative Neon catalog. The Buyer Agent selects the cleanser. The merchant Growth Agent proposes the compatible moisturizer and explains why. It is visibly labeled as a growth proposal, never silently added, and the total stays within the buyer’s mandate.”

Point to **PROPOSED / AUTHORIZED / EXECUTED**.

> “These are three different objects. A proposal is not an authorization, and an authorization is not evidence that money moved.”

## 1:50–2:35 — Demonstrate the money gate

**Click:** **Approve ₹1,498 mandate**.

**Say:**

> “The cart crosses the approval threshold, so policy requires the buyer. This click persists a canonical mandate for this merchant, category, maximum amount, quantity and expiry. The payload is SHA-256 hashed. A browser-supplied `approved: true` is not authority—the server requires the matching, non-expired hash in Neon.”

Point to the mandate hash, maximum and validity time.

**Click:** **Open Razorpay TEST Checkout**. Let the modal appear; do not enter live credentials. If time is tight, close it after the panel sees the Razorpay surface.

> “Only now does the server re-read price and inventory, rerun policy and create a Razorpay TEST Order. The browser cannot choose the amount and never receives the key secret. Checkout signatures are verified server-side; webhook HMAC provides finality.”

## 2:35–3:25 — Break the system on purpose

**Click:** **Chaos Lab**, then **Run server failure demo**.

**Say:**

> “Safe failure is part of the product. Here the buyer approved ₹1,799 with a ₹2,000 ceiling. Before execution, the authoritative price moves and the cart becomes ₹2,049. The executor detects both `PRICE_CHANGED` and `BUDGET_EXCEEDED`, returns `DENY`, and proves `razorpayActionCreated: false`. No financial call occurs.”

Point to the audit event ID.

> “The failure is explicit, recoverable and auditable. The buyer can review the new price and issue a revised mandate; the system never surprises them with a higher charge.”

## 3:25–3:55 — Prove the audit trail

**Click:** **Audit Trail**, then **Verify chain** if the button is visible.

**Say:**

> “Every consequential event includes actor, request ID, policy result, mandate hash, amount evidence and the previous event hash. Recursive canonical JSON plus a database transaction lock produces an append-only SHA-256 chain. The verifier reports every persisted event intact; changing a historical event identifies the exact broken index.”

## 3:55–4:25 — Show interoperability

**Click:** **Protocol Lab**.

**Say:**

> “Karatsuba makes the merchant callable by external agents. ACP checkout sessions and MCP tools normalize into the same catalog, mandate, policy and audit domain. Protocol adapters do not create a bypass. AP2 is represented honestly as a mandate-evidence compatibility concept, not certification; x402 is not misrepresented as Razorpay settlement.”

If asked, open **Developer** and show `/api/openapi`, `/api/mcp`, and the ACP endpoints.

## 4:25–4:45 — Prove merchant growth

**Click:** **Growth Eval**.

**Say:**

> “The revenue claim is measured across 500 deterministic sessions using the same fixed-seed buyer population for baseline and treatment. Acceptance uses an independent utility model combining relevance, compatibility, preference match, price sensitivity and remaining budget. Karatsuba produced ₹80,736 incremental simulated GMV, 10.9% uplift, 32.8% attach rate and zero budget or policy violations.”

## 4:45–5:00 — Close

**Click:** **Integrations** or return to **Overview**.

**Say:**

> “The product already verifies TEST Orders, Payment Links and Invoices. Subscriptions fail closed when the account lacks access, and refunds require a captured stored payment. Karatsuba’s differentiation is not another recommendation chatbot. It is the trust and growth layer that makes a merchant safely buyable by AI.”

## Fast answers if interrupted

- **Why is AI necessary?** Natural-language constraint extraction, preference reasoning and relevant bundle explanations.
- **Where is AI prohibited?** Price, inventory, arithmetic, authorization, signatures, idempotency, state transitions and refunds.
- **How is duplicate charging prevented?** Durable unique idempotency records, payload fingerprints and Razorpay receipt reconciliation.
- **What is actually live?** OpenAI structured output, Neon persistence, Razorpay TEST Orders, Checkout, Payment Links, Invoice creation, webhook signature enforcement, ACP, MCP and audit verification.
- **What is unavailable?** Subscription creation is rejected by this TEST account; successful refund execution awaits a captured TEST payment.
